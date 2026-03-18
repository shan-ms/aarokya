use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::config::AppConfig;
use crate::infrastructure::auth::{decode_token, encode_token};
use crate::infrastructure::error::AppError;

#[derive(Debug, Deserialize)]
pub struct SendOtpRequest {
    pub phone: String,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
}

pub async fn send_otp(
    body: web::Json<SendOtpRequest>,
    otp_store: web::Data<Mutex<HashMap<String, String>>>,
) -> Result<HttpResponse, AppError> {
    let phone = body.phone.trim().to_string();
    if phone.len() < 10 {
        return Err(AppError::Validation("Invalid phone number".to_string()));
    }

    // Generate 6-digit OTP
    let otp = format!("{:06}", rand::random::<u32>() % 1_000_000);

    // Store OTP (in production, send via SMS)
    let mut store = otp_store
        .lock()
        .map_err(|_| AppError::Internal("OTP store lock failed".to_string()))?;
    let otp_hint = otp.clone(); // In dev mode, return the OTP
    store.insert(phone.clone(), otp);

    tracing::info!("OTP sent to phone: {}", phone);

    Ok(HttpResponse::Ok().json(SendOtpResponse {
        message: "OTP sent successfully".to_string(),
        otp_hint: Some(otp_hint), // Remove in production
    }))
}

pub async fn verify_otp(
    body: web::Json<VerifyOtpRequest>,
    pool: web::Data<PgPool>,
    config: web::Data<AppConfig>,
    otp_store: web::Data<Mutex<HashMap<String, String>>>,
) -> Result<HttpResponse, AppError> {
    let phone = body.phone.trim().to_string();
    let otp = body.otp.trim().to_string();

    // Verify OTP
    {
        let mut store = otp_store
            .lock()
            .map_err(|_| AppError::Internal("OTP store lock failed".to_string()))?;
        let stored_otp = store
            .get(&phone)
            .ok_or_else(|| AppError::Unauthorized("No OTP found for this phone".to_string()))?;
        if *stored_otp != otp {
            return Err(AppError::Unauthorized("Invalid OTP".to_string()));
        }
        store.remove(&phone);
    }

    let user_type = body
        .user_type
        .as_deref()
        .unwrap_or("customer")
        .to_string();

    // Upsert user
    let existing_user = sqlx::query_as::<_, crate::domain::user::User>(
        "SELECT * FROM users WHERE phone = $1",
    )
    .bind(&phone)
    .fetch_optional(pool.get_ref())
    .await?;

    let (user_id, is_new_user, final_user_type) = match existing_user {
        Some(user) => (user.id, false, user.user_type),
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

    // Refresh token with longer expiry (7 days)
    let refresh_token = encode_token(user_id, &final_user_type, &config.jwt_secret, 24 * 7)
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

    let access_token = encode_token(
        claims.sub,
        &claims.user_type,
        &config.jwt_secret,
        config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    Ok(HttpResponse::Ok().json(RefreshResponse { access_token }))
}
