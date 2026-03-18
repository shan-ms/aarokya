use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Claim {
    pub id: Uuid,
    pub policy_id: Uuid,
    pub hsa_id: Uuid,
    pub claim_type: String,
    pub amount_paise: i64,
    pub description: Option<String>,
    pub status: Option<String>,
    pub reviewed_by: Option<Uuid>,
    pub review_notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitClaimRequest {
    pub policy_id: Uuid,
    pub claim_type: String,
    pub amount_paise: i64,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewClaimRequest {
    pub status: String,
    pub review_notes: Option<String>,
}
