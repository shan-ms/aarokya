use actix_web::{web, FromRequest, HttpRequest};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

use crate::config::AppConfig;
use crate::infrastructure::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub user_type: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub user_type: String,
}

pub fn encode_token(
    user_id: Uuid,
    user_type: &str,
    secret: &str,
    expiry_hours: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: user_id,
        user_type: user_type.to_string(),
        exp: now + (expiry_hours * 3600),
        iat: now,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn decode_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

impl FromRequest for AuthenticatedUser {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            let config = req
                .app_data::<web::Data<AppConfig>>()
                .ok_or_else(|| AppError::Internal("Config not found".to_string()))?;

            let auth_header = req
                .headers()
                .get("Authorization")
                .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?
                .to_str()
                .map_err(|_| AppError::Unauthorized("Invalid Authorization header".to_string()))?;

            let token = auth_header
                .strip_prefix("Bearer ")
                .ok_or_else(|| {
                    AppError::Unauthorized("Invalid Authorization format".to_string())
                })?;

            let claims = decode_token(token, &config.jwt_secret)
                .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

            Ok(AuthenticatedUser {
                user_id: claims.sub,
                user_type: claims.user_type,
            })
        })
    }
}
