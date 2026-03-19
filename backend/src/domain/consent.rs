use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConsentRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub purpose: String,
    pub scope: Option<String>,
    pub granted_at: DateTime<Utc>,
    pub withdrawn_at: Option<DateTime<Utc>>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct GrantConsentRequest {
    #[validate(length(min = 1, max = 100))]
    pub purpose: String,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawConsentRequest {
    pub purpose: String,
}
