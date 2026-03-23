use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HealthDocument {
    pub id: Uuid,
    pub user_id: Uuid,
    pub family_member_id: Option<Uuid>,
    pub document_type: String,
    pub title: String,
    pub description: Option<String>,
    pub file_url: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub tags: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDocumentRequest {
    #[validate(length(min = 1, max = 50))]
    pub document_type: String,
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    pub description: Option<String>,
    pub file_url: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub family_member_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RecordSharingLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub document_id: Option<Uuid>,
    pub shared_with: String,
    pub purpose: Option<String>,
    pub consent_id: Option<Uuid>,
    pub shared_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ShareDocumentRequest {
    pub document_id: Uuid,
    #[validate(length(min = 1, max = 255))]
    pub shared_with: String,
    pub purpose: Option<String>,
    pub expires_in_hours: Option<i64>,
}
