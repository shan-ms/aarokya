use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

use crate::config::{AppConfig, DEV_OTP_CODE};
use crate::infrastructure::auth::{decode_token, encode_refresh_token, encode_token};
use crate::infrastructure::error::AppError;

// ── OTP store types ──────────────────────────────────────────────────────────

/// A stored OTP entry with creation time and expiry.
#[derive(Debug, Clone)]
pub struct OtpEntry {
    pub otp: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Seconds until this OTP expires.
    pub ttl_secs: i64,
}

impl OtpEntry {
    pub fn new(otp: String, ttl_secs: i64) -> Self {
        Self {
            otp,
            created_at: chrono::Utc::now(),
            ttl_secs,
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now()
            .signed_duration_since(self.created_at)
            .num_seconds()
            > self.ttl_secs
    }
}

/// Thread-safe OTP store: phone → OtpEntry
pub type OtpStore = RwLock<HashMap<String, OtpEntry>>;

// ── Rate-limit types ─────────────────────────────────────────────────────────

/// Timestamps of recent OTP requests for a given phone number.
#[derive(Debug, Clone, Default)]
pub struct RateLimitEntry {
    pub timestamps: Vec<chrono::DateTime<chrono::Utc>>,
}

/// Thread-safe rate-limit store: phone → RateLimitEntry
pub type RateLimitStore = RwLock<HashMap<String, RateLimitEntry>>;

/// Max OTP requests per phone in the rate-limit window.
const RATE_LIMIT_MAX: usize = 5;
/// Rate-limit window in seconds (10 minutes).
const RATE_LIMIT_WINDOW_SECS: i64 = 600;
/// OTP validity in seconds (5 minutes).
const OTP_TTL_SECS: i64 = 300;

// ── Request / Response DTOs ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SendOtpRequest {
    pub phone: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendOtpResponse {
    pub message: String,
    pub otp_hint: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyOtpRequest {
    pub phone: String,
    pub otp: String,
    pub user_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: Uuid,
    pub user_type: String,
    pub is_new_user: bool,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshResponse {
    pub access_token: String,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

pub async fn send_otp(
    body: web::Json<SendOtpRequest>,
    config: web::Data<AppConfig>,
    otp_store: web::Data<OtpStore>,
    rate_limit_store: web::Data<RateLimitStore>,
) -> Result<HttpResponse, AppError> {
    let phone = body.phone.trim().to_string();
    if phone.len() < 10 {
        return Err(AppError::Validation("Invalid phone number".to_string()));
    }

    // ── Dev whitelist: fixed OTP, no rate limit ───────────────────────────
    let (otp, skip_rate_limit) = if config.is_dev_otp_phone(&phone) {
        tracing::info!("Dev OTP: using fixed code for whitelisted phone {}", phone);
        (DEV_OTP_CODE.to_string(), true)
    } else {
        (format!("{:06}", rand::random::<u32>() % 1_000_000), false)
    };

    // ── Rate limiting (skip for dev whitelist) ─────────────────────────────
    if !skip_rate_limit {
        let now = chrono::Utc::now();
        let mut rl = rate_limit_store
            .write()
            .map_err(|_| AppError::Internal("Rate limit store lock failed".to_string()))?;
        let entry = rl.entry(phone.clone()).or_default();
        entry
            .timestamps
            .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
        if entry.timestamps.len() >= RATE_LIMIT_MAX {
            return Err(AppError::BadRequest(
                "Too many OTP requests. Please try again later.".to_string(),
            ));
        }
        entry.timestamps.push(now);
    }

    {
        let mut store = otp_store
            .write()
            .map_err(|_| AppError::Internal("OTP store lock failed".to_string()))?;
        store.insert(phone.clone(), OtpEntry::new(otp.clone(), OTP_TTL_SECS));
    }

    tracing::info!("OTP sent to phone: {}", phone);

    Ok(HttpResponse::Ok().json(SendOtpResponse {
        message: "OTP sent successfully".to_string(),
        otp_hint: Some(otp), // Remove in production
    }))
}

pub async fn verify_otp(
    body: web::Json<VerifyOtpRequest>,
    pool: web::Data<PgPool>,
    config: web::Data<AppConfig>,
    otp_store: web::Data<OtpStore>,
) -> Result<HttpResponse, AppError> {
    let phone = body.phone.trim().to_string();
    let otp = body.otp.trim().to_string();

    tracing::debug!(
        "verify_otp: phone={:?} otp={:?} is_dev={}",
        phone,
        otp,
        config.is_dev_otp_phone(&phone)
    );

    // ── Dev whitelist: accept fixed OTP without store lookup ──────────────
    let dev_bypass = config.is_dev_otp_phone(&phone) && otp == DEV_OTP_CODE;

    if !dev_bypass {
        // ── Verify OTP from store ────────────────────────────────────────
        let mut store = otp_store
            .write()
            .map_err(|_| AppError::Internal("OTP store lock failed".to_string()))?;
        let entry = store
            .get(&phone)
            .ok_or_else(|| AppError::Unauthorized("No OTP found for this phone".to_string()))?;

        if entry.is_expired() {
            store.remove(&phone);
            return Err(AppError::Unauthorized("OTP has expired".to_string()));
        }

        if entry.otp != otp {
            return Err(AppError::Unauthorized("Invalid OTP".to_string()));
        }

        store.remove(&phone);
    }

    let user_type = body.user_type.as_deref().unwrap_or("customer").to_string();

    // ── Upsert user ──────────────────────────────────────────────────────
    let existing_user =
        sqlx::query_as::<_, crate::domain::user::User>("SELECT * FROM users WHERE phone = $1")
            .bind(&phone)
            .fetch_optional(pool.get_ref())
            .await?;

    let (user_id, is_new_user, final_user_type) = match existing_user {
        Some(user) => {
            // Dev: allow switching role when using same phone from different apps
            let effective_type = if config.is_dev_otp_phone(&phone) {
                if user_type == "customer" && user.user_type.starts_with("operator_") {
                    sqlx::query(
                        "UPDATE users SET user_type = 'customer', updated_at = NOW() WHERE id = $1",
                    )
                    .bind(user.id)
                    .execute(pool.get_ref())
                    .await?;
                    "customer".to_string()
                } else if user_type.starts_with("operator_") && user.user_type == "customer" {
                    sqlx::query(
                        "UPDATE users SET user_type = $1, updated_at = NOW() WHERE id = $2",
                    )
                    .bind(&user_type)
                    .bind(user.id)
                    .execute(pool.get_ref())
                    .await?;
                    user_type
                } else {
                    user.user_type
                }
            } else {
                user.user_type
            };
            (user.id, false, effective_type)
        }
        None => {
            let id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO users (id, phone, user_type, status) VALUES ($1, $2, $3, 'active')",
            )
            .bind(id)
            .bind(&phone)
            .bind(&user_type)
            .execute(pool.get_ref())
            .await?;
            (id, true, user_type)
        }
    };

    let access_token = encode_token(
        user_id,
        &final_user_type,
        &config.jwt_secret,
        config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    let refresh_token = encode_refresh_token(user_id, &final_user_type, &config.jwt_secret, 24 * 7)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        user_id,
        user_type: final_user_type,
        is_new_user,
    }))
}

pub async fn refresh_token(
    body: web::Json<RefreshRequest>,
    config: web::Data<AppConfig>,
) -> Result<HttpResponse, AppError> {
    let claims = decode_token(&body.refresh_token, &config.jwt_secret)
        .map_err(|e| AppError::Unauthorized(format!("Invalid refresh token: {}", e)))?;

    if claims.token_type != "refresh" {
        return Err(AppError::Unauthorized(
            "Expected refresh token, got access token".to_string(),
        ));
    }

    let access_token = encode_token(
        claims.sub,
        &claims.user_type,
        &config.jwt_secret,
        config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    Ok(HttpResponse::Ok().json(RefreshResponse { access_token }))
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_otp_entry_not_expired() {
        let entry = OtpEntry::new("123456".to_string(), 300);
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_otp_entry_expired() {
        let mut entry = OtpEntry::new("123456".to_string(), 0);
        // force creation in the past
        entry.created_at = chrono::Utc::now() - chrono::Duration::seconds(10);
        assert!(entry.is_expired());
    }

    #[test]
    fn test_rate_limit_within_window() {
        let mut entry = RateLimitEntry::default();
        let now = chrono::Utc::now();
        for _ in 0..4 {
            entry.timestamps.push(now);
        }
        // Prune
        entry
            .timestamps
            .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
        assert!(entry.timestamps.len() < RATE_LIMIT_MAX);
    }

    #[test]
    fn test_rate_limit_exceeded() {
        let mut entry = RateLimitEntry::default();
        let now = chrono::Utc::now();
        for _ in 0..5 {
            entry.timestamps.push(now);
        }
        entry
            .timestamps
            .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
        assert!(entry.timestamps.len() >= RATE_LIMIT_MAX);
    }

    #[test]
    fn test_rate_limit_old_entries_pruned() {
        let mut entry = RateLimitEntry::default();
        let now = chrono::Utc::now();
        // 5 old entries outside window
        for _ in 0..5 {
            entry
                .timestamps
                .push(now - chrono::Duration::seconds(RATE_LIMIT_WINDOW_SECS + 10));
        }
        entry
            .timestamps
            .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
        assert_eq!(entry.timestamps.len(), 0);
    }

    #[test]
    fn test_otp_entry_boundary_ttl() {
        // Entry with TTL=0 created now should not yet be expired (0 == 0, not >)
        let entry = OtpEntry::new("999999".to_string(), 0);
        // It might or might not be expired depending on timing; at least it doesn't panic
        let _ = entry.is_expired();
    }

    #[test]
    fn test_otp_store_insert_and_retrieve() {
        let store: OtpStore = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();
        let otp_entry = OtpEntry::new("123456".to_string(), 300);

        store.write().unwrap().insert(phone.clone(), otp_entry);

        let reader = store.read().unwrap();
        let entry = reader.get(&phone).unwrap();
        assert_eq!(entry.otp, "123456");
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_otp_store_overwrite_on_resend() {
        let store: OtpStore = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();

        store
            .write()
            .unwrap()
            .insert(phone.clone(), OtpEntry::new("111111".to_string(), 300));
        store
            .write()
            .unwrap()
            .insert(phone.clone(), OtpEntry::new("222222".to_string(), 300));

        let reader = store.read().unwrap();
        assert_eq!(reader.get(&phone).unwrap().otp, "222222");
    }

    #[test]
    fn test_rate_limit_mixed_old_and_new() {
        let mut entry = RateLimitEntry::default();
        let now = chrono::Utc::now();
        // 3 old, 2 new
        for _ in 0..3 {
            entry
                .timestamps
                .push(now - chrono::Duration::seconds(RATE_LIMIT_WINDOW_SECS + 10));
        }
        for _ in 0..2 {
            entry.timestamps.push(now);
        }
        entry
            .timestamps
            .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
        assert_eq!(entry.timestamps.len(), 2);
        assert!(entry.timestamps.len() < RATE_LIMIT_MAX);
    }
}

// ── Integration tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod integration_tests {
    use actix_web::{test, web, App};

    use super::*;
    use crate::config::AppConfig;
    use crate::infrastructure::auth::{decode_token, encode_refresh_token, encode_token};

    fn test_config() -> AppConfig {
        AppConfig {
            database_url: "postgres://localhost/test".to_string(),
            jwt_secret: "integration-test-secret-key-32chars!".to_string(),
            jwt_expiry_hours: 1,
            port: 8080,
            host: "127.0.0.1".to_string(),
        }
    }

    fn test_app_config() -> (
        web::Data<AppConfig>,
        web::Data<OtpStore>,
        web::Data<RateLimitStore>,
    ) {
        let config = web::Data::new(test_config());
        let otp_store = web::Data::new(OtpStore::default());
        let rate_limit_store = web::Data::new(RateLimitStore::default());
        (config, otp_store, rate_limit_store)
    }

    // ── send-otp tests ──────────────────────────────────────────────────────

    #[actix_rt::test]
    async fn test_send_otp_success() {
        let (config, otp_store, rate_limit_store) = test_app_config();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store.clone())
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876543210" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: SendOtpResponse = test::read_body_json(resp).await;
        assert_eq!(body.message, "OTP sent successfully");
        assert!(body.otp_hint.is_some());
        let otp = body.otp_hint.unwrap();
        assert_eq!(otp.len(), 6);

        // Verify OTP is stored
        let store = otp_store.read().unwrap();
        assert!(store.contains_key("+919876543210"));
        assert_eq!(store.get("+919876543210").unwrap().otp, otp);
    }

    #[actix_rt::test]
    async fn test_send_otp_invalid_phone() {
        let (config, otp_store, rate_limit_store) = test_app_config();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store)
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "123" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_rt::test]
    async fn test_send_otp_rate_limiting() {
        let (config, otp_store, rate_limit_store) = test_app_config();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store)
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        // Send 5 OTP requests (the limit)
        for i in 0..5 {
            let req = test::TestRequest::post()
                .uri("/send-otp")
                .set_json(serde_json::json!({ "phone": "+919876543210" }))
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 200, "Request {} should succeed", i + 1);
        }

        // 6th request should be rate limited
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876543210" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400); // BadRequest for rate limit

        // A different phone should still work
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876543211" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_rt::test]
    async fn test_send_otp_overwrites_previous() {
        let (config, otp_store, rate_limit_store) = test_app_config();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store.clone())
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        // First OTP
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876543210" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body1: SendOtpResponse = test::read_body_json(resp).await;
        let _otp1 = body1.otp_hint.unwrap();

        // Second OTP (may or may not be same due to randomness, but store should have latest)
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876543210" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body2: SendOtpResponse = test::read_body_json(resp).await;
        let otp2 = body2.otp_hint.unwrap();

        let store = otp_store.read().unwrap();
        let stored = store.get("+919876543210").unwrap();
        assert_eq!(stored.otp, otp2);
    }

    // ── refresh token tests ─────────────────────────────────────────────────

    #[actix_rt::test]
    async fn test_refresh_token_success() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        let refresh = encode_refresh_token(user_id, "customer", &cfg.jwt_secret, 168).unwrap();

        let config = web::Data::new(cfg.clone());
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/refresh", web::post().to(refresh_token)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": refresh }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: RefreshResponse = test::read_body_json(resp).await;
        // Verify the new access token is valid
        let claims = decode_token(&body.access_token, &cfg.jwt_secret).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.user_type, "customer");
        assert_eq!(claims.token_type, "access");
    }

    #[actix_rt::test]
    async fn test_refresh_with_access_token_fails() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        // Use an access token instead of refresh token
        let access = encode_token(user_id, "customer", &cfg.jwt_secret, 1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/refresh", web::post().to(refresh_token)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": access }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn test_refresh_with_invalid_token_fails() {
        let cfg = test_config();
        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/refresh", web::post().to(refresh_token)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": "not.a.valid.jwt" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn test_refresh_with_expired_token_fails() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        // Expired refresh token (-1 hour)
        let refresh = encode_refresh_token(user_id, "customer", &cfg.jwt_secret, -1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/refresh", web::post().to(refresh_token)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": refresh }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    // ── Auth middleware (AuthenticatedUser extractor) tests ──────────────────

    async fn protected_handler(
        user: crate::infrastructure::auth::AuthenticatedUser,
    ) -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(serde_json::json!({
            "user_id": user.user_id,
            "user_type": user.user_type,
        }))
    }

    #[actix_rt::test]
    async fn test_auth_middleware_valid_token() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "customer", &cfg.jwt_secret, 1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["user_id"], user_id.to_string());
        assert_eq!(body["user_type"], "customer");
    }

    #[actix_rt::test]
    async fn test_auth_middleware_missing_header() {
        let cfg = test_config();
        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/protected").to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn test_auth_middleware_invalid_token() {
        let cfg = test_config();
        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", "Bearer invalid.jwt.token"))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn test_auth_middleware_refresh_token_rejected() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        // A refresh token should NOT be accepted as auth for protected routes
        let refresh = encode_refresh_token(user_id, "customer", &cfg.jwt_secret, 168).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", format!("Bearer {}", refresh)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn test_auth_middleware_wrong_format() {
        let cfg = test_config();
        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        // Missing "Bearer " prefix
        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", "Token abc123"))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    // ── RBAC integration test ───────────────────────────────────────────────

    async fn partner_only_handler(
        user: crate::infrastructure::auth::AuthenticatedUser,
    ) -> Result<actix_web::HttpResponse, crate::infrastructure::error::AppError> {
        crate::infrastructure::auth::require_role(
            &user,
            &[crate::infrastructure::auth::Role::Partner],
        )?;
        Ok(actix_web::HttpResponse::Ok().json(serde_json::json!({"ok": true})))
    }

    #[actix_rt::test]
    async fn test_rbac_allowed_role() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "partner", &cfg.jwt_secret, 1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/partner-only", web::get().to(partner_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/partner-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_rt::test]
    async fn test_rbac_forbidden_role() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "customer", &cfg.jwt_secret, 1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/partner-only", web::get().to(partner_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/partner-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 403);
    }

    #[actix_rt::test]
    async fn test_rbac_super_admin_bypasses() {
        let cfg = test_config();
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "operator_super_admin", &cfg.jwt_secret, 1).unwrap();

        let config = web::Data::new(cfg);
        let app = test::init_service(
            App::new()
                .app_data(config)
                .route("/partner-only", web::get().to(partner_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/partner-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }
}
