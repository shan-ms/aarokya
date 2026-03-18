use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsurancePlan {
    pub id: String,
    pub name: String,
    pub description: String,
    pub premium_paise: i64,
    pub coverage_paise: i64,
    pub min_balance_paise: i64,
    pub plan_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InsurancePolicy {
    pub id: Uuid,
    pub hsa_id: Uuid,
    pub plan_id: String,
    pub plan_name: String,
    pub premium_paise: i64,
    pub coverage_paise: i64,
    pub status: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    pub plan_id: String,
}
