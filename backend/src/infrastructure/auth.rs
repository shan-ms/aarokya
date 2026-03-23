use actix_web::{web, FromRequest, HttpRequest, HttpResponse, ResponseError};
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
    /// "access" or "refresh"
    pub token_type: String,
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
    encode_token_with_type(user_id, user_type, secret, expiry_hours, "access")
}

pub fn encode_refresh_token(
    user_id: Uuid,
    user_type: &str,
    secret: &str,
    expiry_hours: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    encode_token_with_type(user_id, user_type, secret, expiry_hours, "refresh")
}

pub fn encode_token_with_type(
    user_id: Uuid,
    user_type: &str,
    secret: &str,
    expiry_hours: i64,
    token_type: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: user_id,
        user_type: user_type.to_string(),
        exp: now + (expiry_hours * 3600),
        iat: now,
        token_type: token_type.to_string(),
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

            let token = auth_header.strip_prefix("Bearer ").ok_or_else(|| {
                AppError::Unauthorized("Invalid Authorization format".to_string())
            })?;

            let claims = decode_token(token, &config.jwt_secret)
                .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

            if claims.token_type != "access" {
                return Err(AppError::Unauthorized(
                    "Expected access token, got refresh token".to_string(),
                ));
            }

            Ok(AuthenticatedUser {
                user_id: claims.sub,
                user_type: claims.user_type,
            })
        })
    }
}

// ── RBAC ─────────────────────────────────────────────────────────────────────

/// All recognised roles in the system.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Role {
    Customer,
    Partner,
    OperatorSuperAdmin,
    OperatorInsuranceOps,
    OperatorSupport,
    OperatorAnalytics,
    OperatorPartnerManager,
}

impl Role {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "customer" => Some(Role::Customer),
            "partner" => Some(Role::Partner),
            "operator_super_admin" => Some(Role::OperatorSuperAdmin),
            "operator_insurance_ops" => Some(Role::OperatorInsuranceOps),
            "operator_support" => Some(Role::OperatorSupport),
            "operator_analytics" => Some(Role::OperatorAnalytics),
            "operator_partner_manager" => Some(Role::OperatorPartnerManager),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Customer => "customer",
            Role::Partner => "partner",
            Role::OperatorSuperAdmin => "operator_super_admin",
            Role::OperatorInsuranceOps => "operator_insurance_ops",
            Role::OperatorSupport => "operator_support",
            Role::OperatorAnalytics => "operator_analytics",
            Role::OperatorPartnerManager => "operator_partner_manager",
        }
    }
}

/// Check whether the authenticated user has one of the `allowed` roles.
/// Returns `Ok(())` or an `AppError::Forbidden`.
pub fn require_role(user: &AuthenticatedUser, allowed: &[Role]) -> Result<(), AppError> {
    let user_role = Role::from_str(&user.user_type)
        .ok_or_else(|| AppError::Forbidden(format!("Unknown role: {}", user.user_type)))?;

    // super_admin can do everything
    if user_role == Role::OperatorSuperAdmin {
        return Ok(());
    }

    if allowed.contains(&user_role) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "Role '{}' is not permitted for this action",
            user.user_type
        )))
    }
}

/// Helper that produces an `HttpResponse` wrapping a `Forbidden` error when the
/// role check fails.  Use in handler code:
///
/// ```ignore
/// require_role_or_respond(&user, &[Role::Partner])?;
/// ```
#[allow(dead_code)]
pub fn require_role_or_respond(
    user: &AuthenticatedUser,
    allowed: &[Role],
) -> Result<(), HttpResponse> {
    require_role(user, allowed).map_err(|e| e.error_response())
}

// ── tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-jwt-secret-key-for-unit-tests";

    #[test]
    fn test_encode_decode_access_token() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "customer", SECRET, 1).unwrap();
        let claims = decode_token(&token, SECRET).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.user_type, "customer");
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn test_encode_decode_refresh_token() {
        let uid = Uuid::new_v4();
        let token = encode_refresh_token(uid, "partner", SECRET, 168).unwrap();
        let claims = decode_token(&token, SECRET).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.user_type, "partner");
        assert_eq!(claims.token_type, "refresh");
    }

    #[test]
    fn test_decode_with_wrong_secret_fails() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "customer", SECRET, 1).unwrap();
        let result = decode_token(&token, "wrong-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_expired_token_fails() {
        let uid = Uuid::new_v4();
        // -1 hour → already expired
        let token = encode_token_with_type(uid, "customer", SECRET, -1, "access").unwrap();
        let result = decode_token(&token, SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn test_role_from_str() {
        assert_eq!(Role::from_str("customer"), Some(Role::Customer));
        assert_eq!(Role::from_str("partner"), Some(Role::Partner));
        assert_eq!(
            Role::from_str("operator_super_admin"),
            Some(Role::OperatorSuperAdmin)
        );
        assert_eq!(
            Role::from_str("operator_insurance_ops"),
            Some(Role::OperatorInsuranceOps)
        );
        assert_eq!(
            Role::from_str("operator_support"),
            Some(Role::OperatorSupport)
        );
        assert_eq!(
            Role::from_str("operator_analytics"),
            Some(Role::OperatorAnalytics)
        );
        assert_eq!(
            Role::from_str("operator_partner_manager"),
            Some(Role::OperatorPartnerManager)
        );
        assert_eq!(Role::from_str("bogus"), None);
    }

    #[test]
    fn test_require_role_allowed() {
        let user = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "customer".to_string(),
        };
        assert!(require_role(&user, &[Role::Customer]).is_ok());
        assert!(require_role(&user, &[Role::Customer, Role::Partner]).is_ok());
    }

    #[test]
    fn test_require_role_forbidden() {
        let user = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "customer".to_string(),
        };
        let result = require_role(&user, &[Role::Partner]);
        assert!(result.is_err());
    }

    #[test]
    fn test_super_admin_bypasses_all() {
        let user = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "operator_super_admin".to_string(),
        };
        // super_admin should be allowed even when only Partner is listed
        assert!(require_role(&user, &[Role::Partner]).is_ok());
        assert!(require_role(&user, &[Role::Customer]).is_ok());
        assert!(require_role(&user, &[Role::OperatorInsuranceOps]).is_ok());
    }

    #[test]
    fn test_unknown_role_is_forbidden() {
        let user = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "alien".to_string(),
        };
        assert!(require_role(&user, &[Role::Customer]).is_err());
    }

    #[test]
    fn test_role_as_str_roundtrip() {
        let roles = vec![
            Role::Customer,
            Role::Partner,
            Role::OperatorSuperAdmin,
            Role::OperatorInsuranceOps,
            Role::OperatorSupport,
            Role::OperatorAnalytics,
            Role::OperatorPartnerManager,
        ];
        for role in roles {
            let s = role.as_str();
            assert_eq!(Role::from_str(s), Some(role));
        }
    }
}
