use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HealthProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub blood_group: Option<String>,
    pub allergies: Option<serde_json::Value>,
    pub chronic_conditions: Option<serde_json::Value>,
    pub emergency_contact: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
