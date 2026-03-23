//! Security middleware for the Aarokya backend.
//!
//! Provides:
//! - Input sanitization (XSS and SQL injection pattern detection)
//! - Request ID generation (X-Request-Id header)
//! - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
//! - Request body size limiting
//! - IP-based rate limiting (configurable per endpoint)

use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::{web, Error, HttpResponse};
use std::collections::HashMap;
use std::future::{self, Future, Ready};
use std::pin::Pin;
use std::sync::RwLock;
use uuid::Uuid;

// ── Input Sanitization ──────────────────────────────────────────────────────

/// Strip common XSS payloads from a string.
/// Removes `<script>` tags, event handler attributes, `javascript:` URIs,
/// and other dangerous HTML constructs.
#[allow(dead_code)]
pub fn sanitize_input(input: &str) -> String {
    let mut result = input.to_string();

    // Remove <script>...</script> blocks (case-insensitive)
    let script_re = regex_lite::Regex::new(r"(?i)<\s*script[^>]*>.*?<\s*/\s*script\s*>").unwrap();
    result = script_re.replace_all(&result, "").to_string();

    // Remove standalone <script> or </script> tags
    let script_tag_re = regex_lite::Regex::new(r"(?i)<\s*/?\s*script[^>]*>").unwrap();
    result = script_tag_re.replace_all(&result, "").to_string();

    // Remove event handler attributes (onerror, onclick, onload, etc.)
    let event_re = regex_lite::Regex::new(r#"(?i)\bon\w+\s*=\s*["'][^"']*["']"#).unwrap();
    result = event_re.replace_all(&result, "").to_string();

    // Remove javascript: URIs
    let js_uri_re = regex_lite::Regex::new(r"(?i)javascript\s*:").unwrap();
    result = js_uri_re.replace_all(&result, "").to_string();

    // Remove data: URIs with script content
    let data_uri_re = regex_lite::Regex::new(r"(?i)data\s*:\s*text/html").unwrap();
    result = data_uri_re.replace_all(&result, "").to_string();

    // Remove <iframe>, <object>, <embed>, <form> tags
    let dangerous_tags_re =
        regex_lite::Regex::new(r"(?i)<\s*/?\s*(iframe|object|embed|form)[^>]*>").unwrap();
    result = dangerous_tags_re.replace_all(&result, "").to_string();

    result
}

/// Detect common SQL injection patterns. Returns `true` if the input looks
/// like it contains a SQL injection attempt.
#[allow(dead_code)]
pub fn contains_sql_injection(input: &str) -> bool {
    let lower = input.to_lowercase();

    let patterns = [
        "' or '1'='1",
        "' or 1=1",
        "'; drop table",
        "'; delete from",
        "'; update ",
        "'; insert into",
        "union select",
        "union all select",
        "' or ''='",
        "1' or '1'='1",
        "' or 'a'='a",
        "'; exec ",
        "'; execute ",
        "--",
        "/*",
        "*/",
        "xp_cmdshell",
        "information_schema",
        "' or true--",
        "' or 1=1--",
        "'; shutdown--",
    ];

    for pattern in &patterns {
        if lower.contains(pattern) {
            return true;
        }
    }

    false
}

// ── Request ID Middleware ────────────────────────────────────────────────────

/// Middleware that adds a unique `X-Request-Id` header to every response.
/// If the request already carries the header, its value is forwarded.
pub struct RequestId;

impl<S, B> Transform<S, ServiceRequest> for RequestId
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RequestIdMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        future::ready(Ok(RequestIdMiddleware { service }))
    }
}

pub struct RequestIdMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RequestIdMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Reuse existing request ID or generate a new one
        let request_id = req
            .headers()
            .get("X-Request-Id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let fut = self.service.call(req);

        Box::pin(async move {
            let mut res = fut.await?;
            res.headers_mut().insert(
                HeaderName::from_static("x-request-id"),
                HeaderValue::from_str(&request_id)
                    .unwrap_or_else(|_| HeaderValue::from_static("unknown")),
            );
            Ok(res)
        })
    }
}

// ── Security Headers Middleware ──────────────────────────────────────────────

/// Middleware that adds standard security headers to every response.
pub struct SecurityHeaders;

impl<S, B> Transform<S, ServiceRequest> for SecurityHeaders
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = SecurityHeadersMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        future::ready(Ok(SecurityHeadersMiddleware { service }))
    }
}

pub struct SecurityHeadersMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for SecurityHeadersMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let fut = self.service.call(req);

        Box::pin(async move {
            let mut res = fut.await?;
            let headers = res.headers_mut();

            headers.insert(
                HeaderName::from_static("x-content-type-options"),
                HeaderValue::from_static("nosniff"),
            );
            headers.insert(
                HeaderName::from_static("x-frame-options"),
                HeaderValue::from_static("DENY"),
            );
            headers.insert(
                HeaderName::from_static("strict-transport-security"),
                HeaderValue::from_static("max-age=31536000; includeSubDomains"),
            );
            headers.insert(
                HeaderName::from_static("x-xss-protection"),
                HeaderValue::from_static("1; mode=block"),
            );
            headers.insert(
                HeaderName::from_static("content-security-policy"),
                HeaderValue::from_static("default-src 'self'; frame-ancestors 'none'"),
            );

            Ok(res)
        })
    }
}

// ── Body Size Limiter ───────────────────────────────────────────────────────

/// Default max body size: 1 MB.
pub const DEFAULT_BODY_LIMIT: usize = 1_048_576;
/// Max body size for file upload endpoints: 10 MB.
#[allow(dead_code)]
pub const FILE_UPLOAD_BODY_LIMIT: usize = 10_485_760;

/// Returns an `actix_web::web::JsonConfig` with the given byte limit and a
/// custom error handler that returns a structured JSON error response.
pub fn json_body_config(limit: usize) -> web::JsonConfig {
    web::JsonConfig::default()
        .limit(limit)
        .error_handler(|err, _req| {
            let detail = err.to_string();
            let response = HttpResponse::PayloadTooLarge().json(serde_json::json!({
                "error": "payload_too_large",
                "message": format!("Request body too large or malformed: {}", detail),
            }));
            actix_web::error::InternalError::from_response(err, response).into()
        })
}

// ── IP-based Rate Limiter ───────────────────────────────────────────────────

/// Per-endpoint rate-limit configuration.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Max requests allowed within the window.
    pub max_requests: usize,
    /// Window duration in seconds.
    pub window_secs: i64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_requests: 100,
            window_secs: 60,
        }
    }
}

/// Thread-safe store for IP-based rate limiting.
/// Maps `(ip, endpoint_prefix)` to a list of request timestamps.
pub type IpRateLimitStore = RwLock<HashMap<String, Vec<chrono::DateTime<chrono::Utc>>>>;

/// Check whether the given IP + endpoint key should be rate-limited.
/// Returns `Ok(())` if the request is allowed, or `Err(retry_after_secs)` if
/// the caller should be throttled.
#[allow(dead_code)]
pub fn check_ip_rate_limit(
    store: &IpRateLimitStore,
    key: &str,
    config: &RateLimitConfig,
) -> Result<(), i64> {
    let now = chrono::Utc::now();
    let mut guard = store.write().map_err(|_| config.window_secs)?;
    let timestamps = guard.entry(key.to_string()).or_default();

    // Prune old entries
    timestamps.retain(|ts| now.signed_duration_since(*ts).num_seconds() < config.window_secs);

    if timestamps.len() >= config.max_requests {
        // Calculate retry-after from the oldest timestamp in the window
        let oldest = timestamps.first().copied().unwrap_or(now);
        let retry_after = config.window_secs - now.signed_duration_since(oldest).num_seconds();
        return Err(retry_after.max(1));
    }

    timestamps.push(now);
    Ok(())
}

/// Build a rate-limit key from the client IP and an endpoint tag.
#[allow(dead_code)]
pub fn rate_limit_key(ip: &str, endpoint: &str) -> String {
    format!("{}:{}", ip, endpoint)
}

/// Extract the client IP address from the request, respecting X-Forwarded-For
/// if present.
#[allow(dead_code)]
pub fn client_ip(req: &actix_web::HttpRequest) -> String {
    req.headers()
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| {
            req.peer_addr()
                .map(|addr| addr.ip().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        })
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── sanitize_input ──────────────────────────────────────────────────

    #[test]
    fn test_sanitize_removes_script_tags() {
        let input = "Hello <script>alert('xss')</script> World";
        let result = sanitize_input(input);
        assert!(!result.contains("<script>"));
        assert!(!result.contains("</script>"));
        assert!(result.contains("Hello"));
        assert!(result.contains("World"));
    }

    #[test]
    fn test_sanitize_removes_event_handlers() {
        let input = r#"<img src="x" onerror="alert(1)">"#;
        let result = sanitize_input(input);
        assert!(!result.contains("onerror"));
    }

    #[test]
    fn test_sanitize_removes_javascript_uri() {
        let input = r#"<a href="javascript:alert(1)">click</a>"#;
        let result = sanitize_input(input);
        assert!(!result.contains("javascript:"));
    }

    #[test]
    fn test_sanitize_removes_iframe() {
        let input = r#"<iframe src="https://evil.com"></iframe>"#;
        let result = sanitize_input(input);
        assert!(!result.contains("<iframe"));
        assert!(!result.contains("</iframe>"));
    }

    #[test]
    fn test_sanitize_preserves_normal_text() {
        let input = "Just a normal string with <b>bold</b> text";
        let result = sanitize_input(input);
        assert_eq!(result, input);
    }

    #[test]
    fn test_sanitize_case_insensitive() {
        let input = "<SCRIPT>alert('xss')</SCRIPT>";
        let result = sanitize_input(input);
        assert!(!result.to_lowercase().contains("script"));
    }

    // ── contains_sql_injection ──────────────────────────────────────────

    #[test]
    fn test_sql_injection_classic_or() {
        assert!(contains_sql_injection("' OR '1'='1"));
        assert!(contains_sql_injection("' or 1=1"));
    }

    #[test]
    fn test_sql_injection_drop_table() {
        assert!(contains_sql_injection("'; DROP TABLE users"));
    }

    #[test]
    fn test_sql_injection_union_select() {
        assert!(contains_sql_injection("1 UNION SELECT * FROM users"));
    }

    #[test]
    fn test_sql_injection_comment() {
        assert!(contains_sql_injection("admin'--"));
    }

    #[test]
    fn test_no_sql_injection_normal_input() {
        assert!(!contains_sql_injection("John O'Brien"));
        // Single apostrophe without injection pattern is fine
        assert!(!contains_sql_injection("Hello world"));
        assert!(!contains_sql_injection("test@email.com"));
    }

    // ── rate limiter ────────────────────────────────────────────────────

    #[test]
    fn test_rate_limit_allows_within_limit() {
        let store = IpRateLimitStore::default();
        let config = RateLimitConfig {
            max_requests: 3,
            window_secs: 60,
        };

        for _ in 0..3 {
            assert!(check_ip_rate_limit(&store, "127.0.0.1:api", &config).is_ok());
        }
    }

    #[test]
    fn test_rate_limit_blocks_over_limit() {
        let store = IpRateLimitStore::default();
        let config = RateLimitConfig {
            max_requests: 2,
            window_secs: 60,
        };

        assert!(check_ip_rate_limit(&store, "127.0.0.1:api", &config).is_ok());
        assert!(check_ip_rate_limit(&store, "127.0.0.1:api", &config).is_ok());
        assert!(check_ip_rate_limit(&store, "127.0.0.1:api", &config).is_err());
    }

    #[test]
    fn test_rate_limit_different_keys_independent() {
        let store = IpRateLimitStore::default();
        let config = RateLimitConfig {
            max_requests: 1,
            window_secs: 60,
        };

        assert!(check_ip_rate_limit(&store, "10.0.0.1:api", &config).is_ok());
        assert!(check_ip_rate_limit(&store, "10.0.0.2:api", &config).is_ok());
        // First IP is now rate-limited
        assert!(check_ip_rate_limit(&store, "10.0.0.1:api", &config).is_err());
        // Second IP is also rate-limited
        assert!(check_ip_rate_limit(&store, "10.0.0.2:api", &config).is_err());
    }

    #[test]
    fn test_rate_limit_key_format() {
        let key = rate_limit_key("192.168.1.1", "/api/v1/auth");
        assert_eq!(key, "192.168.1.1:/api/v1/auth");
    }

    // ── body limit configs ──────────────────────────────────────────────

    #[test]
    fn test_default_body_limit_is_1mb() {
        assert_eq!(DEFAULT_BODY_LIMIT, 1_048_576);
    }

    #[test]
    fn test_file_upload_body_limit_is_10mb() {
        assert_eq!(FILE_UPLOAD_BODY_LIMIT, 10_485_760);
    }
}
