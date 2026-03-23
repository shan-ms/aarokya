use chrono::{DateTime, NaiveDate, Utc};
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

pub const VALID_SOURCE_TYPES: &[&str] = &[
    "self",
    "employer",
    "platform",
    "family",
    "tip",
    "csr",
    "community",
    "government",
];

#[derive(Debug, Deserialize, Validate)]
pub struct CreateContributionRequest {
    #[validate(length(min = 1, message = "source_type must not be empty"))]
    pub source_type: String,
    pub source_id: Option<Uuid>,
    #[validate(range(
        min = 1,
        max = 100_000_000,
        message = "amount_paise must be between 1 and 100000000"
    ))]
    pub amount_paise: i64,
    #[validate(length(
        min = 1,
        max = 255,
        message = "idempotency_key must be between 1 and 255 characters"
    ))]
    pub idempotency_key: String,
    pub metadata: Option<serde_json::Value>,
}

impl CreateContributionRequest {
    /// Validate source_type against the allowed list
    pub fn validate_source_type(&self) -> Result<(), String> {
        if !VALID_SOURCE_TYPES.contains(&self.source_type.as_str()) {
            return Err(format!(
                "Invalid source_type '{}'. Must be one of: {}",
                self.source_type,
                VALID_SOURCE_TYPES.join(", ")
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, FromRow)]
pub struct ContributionSummary {
    pub source_type: String,
    pub total_paise: Option<i64>,
    pub count: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MonthlySummary {
    pub month: Option<String>,
    pub total_paise: Option<i64>,
    pub count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ContributionSummaryResponse {
    pub by_source: Vec<ContributionSummary>,
    pub by_month: Vec<MonthlySummary>,
    pub grand_total_paise: i64,
    pub grand_total_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct ContributionListParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub source_type: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_valid_contribution_request() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 10000,
            idempotency_key: "test-key-123".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_source_type().is_ok());
    }

    #[test]
    fn test_invalid_source_type() {
        let req = CreateContributionRequest {
            source_type: "invalid".to_string(),
            source_id: None,
            amount_paise: 10000,
            idempotency_key: "test-key-123".to_string(),
            metadata: None,
        };
        assert!(req.validate_source_type().is_err());
    }

    #[test]
    fn test_empty_source_type() {
        let req = CreateContributionRequest {
            source_type: "".to_string(),
            source_id: None,
            amount_paise: 10000,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_zero_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 0,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_negative_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: -100,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_excessive_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_001,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_empty_idempotency_key() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1000,
            idempotency_key: "".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_all_valid_source_types() {
        for st in VALID_SOURCE_TYPES {
            let req = CreateContributionRequest {
                source_type: st.to_string(),
                source_id: None,
                amount_paise: 1000,
                idempotency_key: "key".to_string(),
                metadata: None,
            };
            assert!(
                req.validate_source_type().is_ok(),
                "Expected '{}' to be valid",
                st
            );
        }
    }

    #[test]
    fn test_max_valid_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_000,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_min_valid_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());
    }
}
