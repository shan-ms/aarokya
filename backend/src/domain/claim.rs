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
    pub hospital_name: Option<String>,
    pub diagnosis: Option<String>,
    pub document_urls: Option<serde_json::Value>,
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
    pub hospital_name: Option<String>,
    pub diagnosis: Option<String>,
    pub document_urls: Option<Vec<String>>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewClaimRequest {
    pub status: String,
    pub review_notes: Option<String>,
}

// ── Domain logic ─────────────────────────────────────────────────────────────

/// Validate that the claim amount is positive and within coverage limits.
pub fn validate_claim_amount(amount_paise: i64, coverage_paise: i64) -> Result<(), String> {
    if amount_paise <= 0 {
        return Err("Claim amount must be positive".to_string());
    }
    if amount_paise > coverage_paise {
        return Err(format!(
            "Claim amount {} exceeds coverage {}",
            amount_paise, coverage_paise
        ));
    }
    Ok(())
}

/// Check if a claim status transition is valid.
pub fn is_valid_review_status(status: &str) -> bool {
    matches!(status, "approved" | "rejected" | "under_review")
}

/// Check if a claim has already been finalized.
pub fn is_claim_finalized(status: Option<&str>) -> bool {
    matches!(status, Some("approved") | Some("rejected"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_claim_amount_valid() {
        assert!(validate_claim_amount(50_000, 10_000_000).is_ok());
    }

    #[test]
    fn test_validate_claim_amount_zero() {
        assert!(validate_claim_amount(0, 10_000_000).is_err());
    }

    #[test]
    fn test_validate_claim_amount_negative() {
        assert!(validate_claim_amount(-100, 10_000_000).is_err());
    }

    #[test]
    fn test_validate_claim_amount_exceeds_coverage() {
        let result = validate_claim_amount(20_000_000, 10_000_000);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("exceeds coverage"));
    }

    #[test]
    fn test_validate_claim_amount_exact_coverage() {
        assert!(validate_claim_amount(10_000_000, 10_000_000).is_ok());
    }

    #[test]
    fn test_is_valid_review_status() {
        assert!(is_valid_review_status("approved"));
        assert!(is_valid_review_status("rejected"));
        assert!(is_valid_review_status("under_review"));
        assert!(!is_valid_review_status("submitted"));
        assert!(!is_valid_review_status("pending"));
        assert!(!is_valid_review_status(""));
    }

    #[test]
    fn test_is_claim_finalized() {
        assert!(is_claim_finalized(Some("approved")));
        assert!(is_claim_finalized(Some("rejected")));
        assert!(!is_claim_finalized(Some("submitted")));
        assert!(!is_claim_finalized(Some("under_review")));
        assert!(!is_claim_finalized(None));
    }
}
