use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contribution {
    pub id: Uuid,
    pub hsa_id: Uuid,
    pub source_type: String,
    pub source_id: Option<Uuid>,
    pub amount_paise: i64,
    pub currency: Option<String>,
    pub reference_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub status: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateContributionRequest {
    #[validate(length(min = 1))]
    pub source_type: String,
    pub source_id: Option<Uuid>,
    #[validate(range(min = 1))]
    pub amount_paise: i64,
    #[validate(length(min = 1))]
    pub idempotency_key: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ContributionSummary {
    pub source_type: String,
    pub total_paise: Option<i64>,
    pub count: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ContributionListParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub source_type: Option<String>,
}
