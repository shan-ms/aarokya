use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Partner {
    pub id: Uuid,
    pub user_id: Uuid,
    pub company_name: String,
    pub partner_type: String,
    pub gstin: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPartnerRequest {
    pub company_name: String,
    pub partner_type: String,
    pub gstin: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PartnerWorker {
    pub id: Uuid,
    pub partner_id: Uuid,
    pub worker_user_id: Uuid,
    pub external_worker_id: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct AddWorkerRequest {
    pub worker_phone: String,
    pub external_worker_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkContributionItem {
    pub worker_phone: String,
    pub amount_paise: i64,
    pub idempotency_key: String,
}

#[derive(Debug, Deserialize)]
pub struct BulkContributionRequest {
    pub contributions: Vec<BulkContributionItem>,
}

#[derive(Debug, Serialize)]
pub struct BulkContributionResult {
    pub succeeded: i64,
    pub failed: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PartnerDashboard {
    pub total_workers: i64,
    pub total_contributed_paise: i64,
    pub contribution_count: i64,
}
