use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FamilyProfile {
    pub id: Uuid,
    pub caregiver_user_id: Uuid,
    pub member_name: String,
    pub relationship: String,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub blood_group: Option<String>,
    pub allergies: Option<serde_json::Value>,
    pub chronic_conditions: Option<serde_json::Value>,
    pub emergency_contact: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFamilyMemberRequest {
    #[validate(length(min = 1, max = 255))]
    pub member_name: String,
    #[validate(length(min = 1, max = 50))]
    pub relationship: String,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub blood_group: Option<String>,
    pub allergies: Option<Vec<String>>,
    pub chronic_conditions: Option<Vec<String>>,
    pub emergency_contact: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateFamilyMemberRequest {
    #[validate(length(min = 1, max = 255))]
    pub member_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub blood_group: Option<String>,
    pub allergies: Option<Vec<String>>,
    pub chronic_conditions: Option<Vec<String>>,
    pub emergency_contact: Option<String>,
}
