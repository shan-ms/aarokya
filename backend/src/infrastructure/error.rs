use actix_web::{HttpResponse, ResponseError};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Too many requests: {0}")]
    TooManyRequests(String),
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_type) = match self {
            AppError::NotFound(_) => (actix_web::http::StatusCode::NOT_FOUND, "not_found"),
            AppError::BadRequest(_) => (actix_web::http::StatusCode::BAD_REQUEST, "bad_request"),
            AppError::Unauthorized(_) => {
                (actix_web::http::StatusCode::UNAUTHORIZED, "unauthorized")
            }
            AppError::Forbidden(_) => (actix_web::http::StatusCode::FORBIDDEN, "forbidden"),
            AppError::Conflict(_) => (actix_web::http::StatusCode::CONFLICT, "conflict"),
            AppError::Validation(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "validation_error")
            }
            AppError::TooManyRequests(_) => (
                actix_web::http::StatusCode::TOO_MANY_REQUESTS,
                "too_many_requests",
            ),
            AppError::Internal(_) | AppError::Database(_) => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
            ),
        };
        HttpResponse::build(status).json(ErrorResponse {
            error: error_type.to_string(),
            message: self.to_string(),
        })
    }
}
