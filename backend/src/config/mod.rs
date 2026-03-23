use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub port: u16,
    pub host: String,
}

/// Dev-only: whitelisted phone gets fixed OTP 123456 (no SMS, no rate limit).
/// Set DEV_OTP_PHONE=+919876543210 in .env for local testing.
pub const DEFAULT_DEV_OTP_PHONE: &str = "+919876543210";
pub const DEV_OTP_CODE: &str = "123456";

/// Normalize phone to last 10 digits for comparison (handles +91, 91, etc.)
fn normalize_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 10 {
        digits[digits.len() - 10..].to_string()
    } else {
        digits
    }
}

impl AppConfig {
    /// Returns true if phone is whitelisted for dev OTP (fixed code 123456).
    pub fn is_dev_otp_phone(&self, phone: &str) -> bool {
        let dev_phone =
            std::env::var("DEV_OTP_PHONE").unwrap_or_else(|_| DEFAULT_DEV_OTP_PHONE.to_string());
        if dev_phone.is_empty() {
            return false;
        }
        normalize_phone(&dev_phone) == normalize_phone(phone)
    }

    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-prod".to_string()),
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()?,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
        })
    }
}
