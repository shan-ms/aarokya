use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

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

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterPartnerRequest {
    #[validate(length(
        min = 1,
        max = 255,
        message = "company_name must be between 1 and 255 characters"
    ))]
    pub company_name: String,
    #[validate(length(
        min = 1,
        max = 50,
        message = "partner_type must be between 1 and 50 characters"
    ))]
    pub partner_type: String,
    pub gstin: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
}

pub const VALID_PARTNER_TYPES: &[&str] = &["employer", "platform", "ngo", "csr", "government"];

impl RegisterPartnerRequest {
    pub fn validate_partner_type(&self) -> Result<(), String> {
        if !VALID_PARTNER_TYPES.contains(&self.partner_type.as_str()) {
            return Err(format!(
                "Invalid partner_type '{}'. Must be one of: {}",
                self.partner_type,
                VALID_PARTNER_TYPES.join(", ")
            ));
        }
        Ok(())
    }
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

/// Worker info enriched with HSA status for the list_workers endpoint.
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkerWithHsaStatus {
    pub id: Uuid,
    pub partner_id: Uuid,
    pub worker_user_id: Uuid,
    pub external_worker_id: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub worker_phone: Option<String>,
    pub worker_name: Option<String>,
    pub has_hsa: bool,
    pub hsa_balance_paise: Option<i64>,
    pub hsa_total_contributed_paise: Option<i64>,
    pub insurance_eligible: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AddWorkerRequest {
    /// Phone number to look up the worker. At least one of worker_phone or abha_id must be provided.
    pub worker_phone: Option<String>,
    /// ABHA ID to look up the worker.
    pub abha_id: Option<String>,
    pub external_worker_id: Option<String>,
}

impl AddWorkerRequest {
    /// Validate that at least one lookup field is provided.
    pub fn validate_lookup(&self) -> Result<(), String> {
        if self.worker_phone.is_none() && self.abha_id.is_none() {
            return Err("At least one of worker_phone or abha_id must be provided".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct BulkContributionItem {
    pub worker_phone: String,
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
}

#[derive(Debug, Deserialize)]
pub struct BulkContributionRequest {
    pub contributions: Vec<BulkContributionItem>,
}

impl BulkContributionRequest {
    /// Validate that there is at least one contribution and not too many.
    pub fn validate_items(&self) -> Result<(), String> {
        if self.contributions.is_empty() {
            return Err("At least one contribution is required".to_string());
        }
        if self.contributions.len() > 1000 {
            return Err("Maximum 1000 contributions per bulk request".to_string());
        }
        for (i, item) in self.contributions.iter().enumerate() {
            if item.amount_paise < 1 {
                return Err(format!(
                    "Contribution {} has invalid amount_paise: must be >= 1",
                    i
                ));
            }
            if item.idempotency_key.is_empty() {
                return Err(format!("Contribution {} has empty idempotency_key", i));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BulkContributionResult {
    pub succeeded: i64,
    pub failed: i64,
    pub errors: Vec<String>,
}

/// Partner profile enriched with stats.
#[derive(Debug, Serialize)]
pub struct PartnerProfile {
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
    pub total_workers: i64,
    pub total_contributed_paise: i64,
    pub contribution_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PartnerDashboard {
    pub total_workers: i64,
    pub total_contributed_paise: i64,
    pub contribution_count: i64,
    pub coverage_rate: f64,
}

/// Compute the coverage rate: fraction of workers that are insurance-eligible.
pub fn compute_coverage_rate(eligible_workers: i64, total_workers: i64) -> f64 {
    if total_workers == 0 {
        return 0.0;
    }
    eligible_workers as f64 / total_workers as f64
}

#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

/// A single row in the contribution report.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ContributionReportRow {
    pub contribution_id: Uuid,
    pub worker_phone: String,
    pub worker_name: Option<String>,
    pub amount_paise: i64,
    pub currency: Option<String>,
    pub status: Option<String>,
    pub idempotency_key: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Report response with summary.
#[derive(Debug, Serialize, Deserialize)]
pub struct ContributionReport {
    pub rows: Vec<ContributionReportRow>,
    pub total_amount_paise: i64,
    pub total_count: i64,
    pub page: i64,
    pub per_page: i64,
}

// ── tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    // ── RegisterPartnerRequest ───────────────────────────────────────────

    #[test]
    fn test_register_partner_valid() {
        let req = RegisterPartnerRequest {
            company_name: "Acme Corp".to_string(),
            partner_type: "employer".to_string(),
            gstin: Some("22AAAAA0000A1Z5".to_string()),
            contact_email: Some("admin@acme.com".to_string()),
            contact_phone: Some("+919876543210".to_string()),
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_partner_type().is_ok());
    }

    #[test]
    fn test_register_partner_empty_company_name() {
        let req = RegisterPartnerRequest {
            company_name: "".to_string(),
            partner_type: "employer".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_register_partner_invalid_type() {
        let req = RegisterPartnerRequest {
            company_name: "Test".to_string(),
            partner_type: "invalid_type".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        assert!(req.validate_partner_type().is_err());
    }

    #[test]
    fn test_all_valid_partner_types() {
        for pt in VALID_PARTNER_TYPES {
            let req = RegisterPartnerRequest {
                company_name: "Test".to_string(),
                partner_type: pt.to_string(),
                gstin: None,
                contact_email: None,
                contact_phone: None,
            };
            assert!(
                req.validate_partner_type().is_ok(),
                "Expected '{}' to be valid",
                pt
            );
        }
    }

    // ── AddWorkerRequest ─────────────────────────────────────────────────

    #[test]
    fn test_add_worker_with_phone() {
        let req = AddWorkerRequest {
            worker_phone: Some("+919876543210".to_string()),
            abha_id: None,
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn test_add_worker_with_abha() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: Some("1234567890ABCD".to_string()),
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn test_add_worker_with_both() {
        let req = AddWorkerRequest {
            worker_phone: Some("+919876543210".to_string()),
            abha_id: Some("1234567890ABCD".to_string()),
            external_worker_id: Some("EXT-001".to_string()),
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn test_add_worker_neither_phone_nor_abha() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: None,
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_err());
    }

    // ── BulkContributionRequest ──────────────────────────────────────────

    #[test]
    fn test_bulk_contribution_valid() {
        let req = BulkContributionRequest {
            contributions: vec![
                BulkContributionItem {
                    worker_phone: "+919876543210".to_string(),
                    amount_paise: 10000,
                    idempotency_key: "key1".to_string(),
                },
                BulkContributionItem {
                    worker_phone: "+919876543211".to_string(),
                    amount_paise: 20000,
                    idempotency_key: "key2".to_string(),
                },
            ],
        };
        assert!(req.validate_items().is_ok());
    }

    #[test]
    fn test_bulk_contribution_empty() {
        let req = BulkContributionRequest {
            contributions: vec![],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn test_bulk_contribution_too_many() {
        let items: Vec<BulkContributionItem> = (0..1001)
            .map(|i| BulkContributionItem {
                worker_phone: format!("+91987654{:04}", i),
                amount_paise: 1000,
                idempotency_key: format!("key-{}", i),
            })
            .collect();
        let req = BulkContributionRequest {
            contributions: items,
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn test_bulk_contribution_zero_amount() {
        let req = BulkContributionRequest {
            contributions: vec![BulkContributionItem {
                worker_phone: "+919876543210".to_string(),
                amount_paise: 0,
                idempotency_key: "key1".to_string(),
            }],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn test_bulk_contribution_empty_idempotency_key() {
        let req = BulkContributionRequest {
            contributions: vec![BulkContributionItem {
                worker_phone: "+919876543210".to_string(),
                amount_paise: 1000,
                idempotency_key: "".to_string(),
            }],
        };
        assert!(req.validate_items().is_err());
    }

    // ── coverage_rate ────────────────────────────────────────────────────

    #[test]
    fn test_coverage_rate_zero_workers() {
        assert!((compute_coverage_rate(0, 0) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_coverage_rate_all_eligible() {
        assert!((compute_coverage_rate(10, 10) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_coverage_rate_half() {
        assert!((compute_coverage_rate(5, 10) - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn test_coverage_rate_none_eligible() {
        assert!((compute_coverage_rate(0, 10) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_coverage_rate_one_of_three() {
        let rate = compute_coverage_rate(1, 3);
        assert!((rate - 1.0 / 3.0).abs() < 0.0001);
    }
}
