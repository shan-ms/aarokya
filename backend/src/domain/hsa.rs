use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HealthSavingsAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub abha_id: String,
    pub balance_paise: i64,
    pub total_contributed_paise: i64,
    pub insurance_eligible: Option<bool>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHsaRequest {
    pub abha_id: String,
}

#[derive(Debug, Serialize)]
pub struct HsaDashboard {
    pub balance_paise: i64,
    pub total_contributed_paise: i64,
    pub insurance_eligible: bool,
    pub basic_insurance_progress: f64,
    pub premium_insurance_progress: f64,
    pub contribution_count: i64,
}
