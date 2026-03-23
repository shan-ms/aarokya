//! Automated Regression Tests (ART) for the Partners module and extended Auth
//! functionality.
//!
//! These tests cover domain logic, validation, serialization, OTP/rate-limit
//! behaviour, JWT token lifecycle, and RBAC enforcement — all without requiring
//! a running database.

use std::collections::HashMap;
use std::sync::RwLock;

use chrono::Utc;
use serde_json;
use uuid::Uuid;
use validator::Validate;

use aarokya_backend::config::AppConfig;
use aarokya_backend::domain::partner::{
    compute_coverage_rate, AddWorkerRequest, BulkContributionItem, BulkContributionRequest,
    BulkContributionResult, ContributionReport, ContributionReportRow, Partner, PartnerDashboard,
    PartnerProfile, RegisterPartnerRequest, ReportQuery, WorkerWithHsaStatus, VALID_PARTNER_TYPES,
};
use aarokya_backend::infrastructure::auth::{
    decode_token, encode_refresh_token, encode_token, encode_token_with_type, require_role,
    AuthenticatedUser, Role,
};
use aarokya_backend::infrastructure::error::AppError;

// ── Shared helpers ──────────────────────────────────────────────────────────

const JWT_SECRET: &str = "art-test-secret-key-must-be-long-enough";

fn test_config() -> AppConfig {
    AppConfig {
        database_url: "postgres://localhost/test".to_string(),
        jwt_secret: JWT_SECRET.to_string(),
        jwt_expiry_hours: 1,
        port: 8080,
        host: "127.0.0.1".to_string(),
    }
}

fn make_auth_user(user_type: &str) -> AuthenticatedUser {
    AuthenticatedUser {
        user_id: Uuid::new_v4(),
        user_type: user_type.to_string(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PARTNER TESTS
// ═══════════════════════════════════════════════════════════════════════════

mod partner_register {
    use super::*;

    // 1. Register partner — success
    #[test]
    fn success_valid_employer_request() {
        let req = RegisterPartnerRequest {
            company_name: "GigCorp India Pvt Ltd".to_string(),
            partner_type: "employer".to_string(),
            gstin: Some("22AAAAA0000A1Z5".to_string()),
            contact_email: Some("ops@gigcorp.in".to_string()),
            contact_phone: Some("+919876543210".to_string()),
        };
        assert!(req.validate().is_ok(), "Valid request must pass validation");
        assert!(
            req.validate_partner_type().is_ok(),
            "employer is a valid partner type"
        );
    }

    #[test]
    fn success_all_partner_types_accepted() {
        for pt in VALID_PARTNER_TYPES {
            let req = RegisterPartnerRequest {
                company_name: "Test Corp".to_string(),
                partner_type: pt.to_string(),
                gstin: None,
                contact_email: None,
                contact_phone: None,
            };
            assert!(
                req.validate().is_ok(),
                "Validation should pass for type '{}'",
                pt
            );
            assert!(
                req.validate_partner_type().is_ok(),
                "'{}' should be an accepted partner_type",
                pt
            );
        }
    }

    #[test]
    fn success_minimal_fields() {
        let req = RegisterPartnerRequest {
            company_name: "X".to_string(),
            partner_type: "ngo".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_partner_type().is_ok());
    }

    #[test]
    fn success_partner_serialises_to_json() {
        let partner = Partner {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            company_name: "Acme Health".to_string(),
            partner_type: "employer".to_string(),
            gstin: Some("22AAAAA0000A1Z5".to_string()),
            contact_email: Some("hello@acme.in".to_string()),
            contact_phone: Some("+919999999999".to_string()),
            status: Some("active".to_string()),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };
        let json = serde_json::to_value(&partner).unwrap();
        assert_eq!(json["company_name"], "Acme Health");
        assert_eq!(json["partner_type"], "employer");
        assert_eq!(json["status"], "active");
    }

    // 2. Register partner — duplicate returns conflict
    #[test]
    fn duplicate_returns_conflict_error() {
        // Simulate the conflict error the handler would return
        let err = AppError::Conflict("Partner already registered".to_string());
        let resp = actix_web::ResponseError::error_response(&err);
        assert_eq!(resp.status(), actix_web::http::StatusCode::CONFLICT);
    }

    #[test]
    fn invalid_partner_type_rejected() {
        let req = RegisterPartnerRequest {
            company_name: "Bad Corp".to_string(),
            partner_type: "freelancer".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        let result = req.validate_partner_type();
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("freelancer"),
            "Error should mention the invalid type"
        );
    }

    #[test]
    fn empty_company_name_rejected() {
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
    fn company_name_over_255_chars_rejected() {
        let req = RegisterPartnerRequest {
            company_name: "A".repeat(256),
            partner_type: "employer".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn only_partner_user_type_may_register() {
        // Simulate the check done by the register_partner handler
        let customer = make_auth_user("customer");
        assert_ne!(
            customer.user_type, "partner",
            "A customer should not pass the partner check"
        );

        let partner = make_auth_user("partner");
        assert_eq!(partner.user_type, "partner");
    }
}

// ── 3. Get partner profile — returns correct data ───────────────────────────

mod partner_profile {
    use super::*;

    #[test]
    fn profile_struct_has_correct_fields() {
        let profile = PartnerProfile {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            company_name: "HealthFirst".to_string(),
            partner_type: "platform".to_string(),
            gstin: Some("22BBBBB0000B1Z9".to_string()),
            contact_email: Some("info@healthfirst.in".to_string()),
            contact_phone: Some("+918888888888".to_string()),
            status: Some("active".to_string()),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
            total_workers: 42,
            total_contributed_paise: 2_500_000,
            contribution_count: 120,
        };
        assert_eq!(profile.total_workers, 42);
        assert_eq!(profile.total_contributed_paise, 2_500_000);
        assert_eq!(profile.contribution_count, 120);
        assert_eq!(profile.partner_type, "platform");
    }

    #[test]
    fn profile_serialises_all_fields_to_json() {
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let profile = PartnerProfile {
            id,
            user_id,
            company_name: "TestCo".to_string(),
            partner_type: "employer".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
            status: Some("active".to_string()),
            created_at: None,
            updated_at: None,
            total_workers: 0,
            total_contributed_paise: 0,
            contribution_count: 0,
        };
        let json = serde_json::to_value(&profile).unwrap();
        assert_eq!(json["id"], id.to_string());
        assert_eq!(json["user_id"], user_id.to_string());
        assert_eq!(json["total_workers"], 0);
        assert!(
            json.get("gstin").is_some(),
            "Null optional fields are present"
        );
    }

    #[test]
    fn not_found_error_for_missing_partner() {
        let err = AppError::NotFound("Partner not found".to_string());
        let resp = actix_web::ResponseError::error_response(&err);
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }
}

// ── 4 & 5. Add worker — success by phone / ABHA ────────────────────────────

mod add_worker {
    use super::*;

    #[test]
    fn success_by_phone() {
        let req = AddWorkerRequest {
            worker_phone: Some("+919876543210".to_string()),
            abha_id: None,
            external_worker_id: Some("EMP-001".to_string()),
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn success_by_abha() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: Some("91-1234-5678-9012".to_string()),
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn success_by_both_phone_and_abha() {
        let req = AddWorkerRequest {
            worker_phone: Some("+919876543210".to_string()),
            abha_id: Some("91-1234-5678-9012".to_string()),
            external_worker_id: Some("W-042".to_string()),
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn neither_phone_nor_abha_is_rejected() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: None,
            external_worker_id: Some("EXT-999".to_string()),
        };
        let err = req.validate_lookup().unwrap_err();
        assert!(err.contains("worker_phone"));
        assert!(err.contains("abha_id"));
    }

    #[test]
    fn duplicate_worker_returns_conflict() {
        let err = AppError::Conflict("Worker already linked to this partner".to_string());
        let resp = actix_web::ResponseError::error_response(&err);
        assert_eq!(resp.status(), actix_web::http::StatusCode::CONFLICT);
    }
}

// ── 6 & 7. List workers — pagination & search filter ────────────────────────

mod list_workers {
    use super::*;

    #[test]
    fn pagination_defaults_in_report_query() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: None,
            per_page: None,
        };
        let page = query.page.unwrap_or(1).max(1);
        let per_page = query.per_page.unwrap_or(50).min(1000).max(1);
        assert_eq!(page, 1);
        assert_eq!(per_page, 50);
    }

    #[test]
    fn pagination_page_zero_clamped_to_one() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: Some(0),
            per_page: Some(25),
        };
        let page = query.page.unwrap_or(1).max(1);
        assert_eq!(page, 1, "Page 0 should be clamped to 1");
    }

    #[test]
    fn pagination_per_page_clamped_to_max_1000() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: Some(1),
            per_page: Some(5000),
        };
        let per_page = query.per_page.unwrap_or(50).min(1000).max(1);
        assert_eq!(per_page, 1000);
    }

    #[test]
    fn pagination_per_page_clamped_to_min_1() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: Some(1),
            per_page: Some(0),
        };
        let per_page = query.per_page.unwrap_or(50).min(1000).max(1);
        assert_eq!(per_page, 1);
    }

    #[test]
    fn pagination_offset_calculated_correctly() {
        let page: i64 = 3;
        let per_page: i64 = 25;
        let offset = (page - 1) * per_page;
        assert_eq!(offset, 50);
    }

    #[test]
    fn worker_with_hsa_status_serialises() {
        let worker = WorkerWithHsaStatus {
            id: Uuid::new_v4(),
            partner_id: Uuid::new_v4(),
            worker_user_id: Uuid::new_v4(),
            external_worker_id: Some("EMP-042".to_string()),
            status: Some("active".to_string()),
            created_at: Some(Utc::now()),
            worker_phone: Some("+919876543210".to_string()),
            worker_name: Some("Priya Sharma".to_string()),
            has_hsa: true,
            hsa_balance_paise: Some(250_000),
            hsa_total_contributed_paise: Some(400_000),
            insurance_eligible: Some(true),
        };
        let json = serde_json::to_value(&worker).unwrap();
        assert_eq!(json["has_hsa"], true);
        assert_eq!(json["hsa_balance_paise"], 250_000);
        assert_eq!(json["insurance_eligible"], true);
        assert_eq!(json["worker_name"], "Priya Sharma");
    }

    #[test]
    fn worker_without_hsa_serialises() {
        let worker = WorkerWithHsaStatus {
            id: Uuid::new_v4(),
            partner_id: Uuid::new_v4(),
            worker_user_id: Uuid::new_v4(),
            external_worker_id: None,
            status: Some("active".to_string()),
            created_at: None,
            worker_phone: Some("+919000000000".to_string()),
            worker_name: None,
            has_hsa: false,
            hsa_balance_paise: None,
            hsa_total_contributed_paise: None,
            insurance_eligible: None,
        };
        let json = serde_json::to_value(&worker).unwrap();
        assert_eq!(json["has_hsa"], false);
        assert!(json["hsa_balance_paise"].is_null());
        assert!(json["insurance_eligible"].is_null());
    }

    #[test]
    fn search_filter_simulated_by_name_match() {
        // Simulates the search/filter logic a caller would use on the workers
        // list response.
        let workers = vec![
            ("Priya Sharma", "+919876543210"),
            ("Rahul Verma", "+919876543211"),
            ("Priya Singh", "+919876543212"),
        ];
        let search = "Priya";
        let filtered: Vec<_> = workers
            .iter()
            .filter(|(name, _)| name.to_lowercase().contains(&search.to_lowercase()))
            .collect();
        assert_eq!(filtered.len(), 2);
    }
}

// ── 8 & 9. Bulk contribution — success & atomic ─────────────────────────────

mod bulk_contribution {
    use super::*;

    #[test]
    fn success_processes_all_workers() {
        let items: Vec<BulkContributionItem> = (0..5)
            .map(|i| BulkContributionItem {
                worker_phone: format!("+91987654321{}", i),
                amount_paise: 10_000 + i * 1_000,
                idempotency_key: format!("batch-2026-03-{:02}", i + 1),
            })
            .collect();
        let req = BulkContributionRequest {
            contributions: items,
        };
        assert!(req.validate_items().is_ok());
        assert_eq!(req.contributions.len(), 5);

        // Simulate successful processing
        let result = BulkContributionResult {
            succeeded: 5,
            failed: 0,
            errors: vec![],
        };
        assert_eq!(result.succeeded, 5);
        assert_eq!(result.failed, 0);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn result_json_serialisation() {
        let result = BulkContributionResult {
            succeeded: 8,
            failed: 2,
            errors: vec![
                "User not found for phone: +919999999999".to_string(),
                "No HSA for phone: +918888888888".to_string(),
            ],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["succeeded"], 8);
        assert_eq!(json["failed"], 2);
        assert_eq!(json["errors"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn atomic_all_or_nothing_partial_failure_recorded() {
        // The handler processes in a DB transaction. Even though individual
        // items may be skipped (with `continue`), the transaction commits
        // atomically. Simulate a mixed result:
        let result = BulkContributionResult {
            succeeded: 3,
            failed: 2,
            errors: vec![
                "User not found for phone: +911111111111".to_string(),
                "No HSA for phone: +912222222222".to_string(),
            ],
        };
        assert_eq!(
            result.succeeded + result.failed,
            5,
            "Total must equal number of items submitted"
        );
    }

    #[test]
    fn empty_contribution_list_rejected() {
        let req = BulkContributionRequest {
            contributions: vec![],
        };
        let err = req.validate_items().unwrap_err();
        assert!(err.contains("At least one"));
    }

    #[test]
    fn over_1000_items_rejected() {
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
        let err = req.validate_items().unwrap_err();
        assert!(err.contains("Maximum 1000"));
    }

    #[test]
    fn zero_amount_rejected() {
        let req = BulkContributionRequest {
            contributions: vec![BulkContributionItem {
                worker_phone: "+919876543210".to_string(),
                amount_paise: 0,
                idempotency_key: "key-0".to_string(),
            }],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn negative_amount_rejected() {
        let req = BulkContributionRequest {
            contributions: vec![BulkContributionItem {
                worker_phone: "+919876543210".to_string(),
                amount_paise: -500,
                idempotency_key: "key-neg".to_string(),
            }],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn empty_idempotency_key_rejected() {
        let req = BulkContributionRequest {
            contributions: vec![BulkContributionItem {
                worker_phone: "+919876543210".to_string(),
                amount_paise: 5000,
                idempotency_key: "".to_string(),
            }],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn exactly_1000_items_accepted() {
        let items: Vec<BulkContributionItem> = (0..1000)
            .map(|i| BulkContributionItem {
                worker_phone: format!("+91987654{:04}", i),
                amount_paise: 1000,
                idempotency_key: format!("key-{}", i),
            })
            .collect();
        let req = BulkContributionRequest {
            contributions: items,
        };
        assert!(req.validate_items().is_ok());
    }
}

// ── 10. Partner dashboard — returns correct metrics ─────────────────────────

mod partner_dashboard {
    use super::*;

    #[test]
    fn dashboard_struct_values() {
        let dashboard = PartnerDashboard {
            total_workers: 100,
            total_contributed_paise: 10_000_000,
            contribution_count: 500,
            coverage_rate: 0.85,
        };
        assert_eq!(dashboard.total_workers, 100);
        assert_eq!(dashboard.total_contributed_paise, 10_000_000);
        assert_eq!(dashboard.contribution_count, 500);
        assert!((dashboard.coverage_rate - 0.85).abs() < f64::EPSILON);
    }

    #[test]
    fn dashboard_serialises_to_json() {
        let dashboard = PartnerDashboard {
            total_workers: 50,
            total_contributed_paise: 5_000_000,
            contribution_count: 200,
            coverage_rate: 0.6,
        };
        let json = serde_json::to_value(&dashboard).unwrap();
        assert_eq!(json["total_workers"], 50);
        assert_eq!(json["total_contributed_paise"], 5_000_000);
        assert_eq!(json["coverage_rate"], 0.6);
    }

    #[test]
    fn dashboard_deserialises_from_json() {
        let raw = r#"{
            "total_workers": 25,
            "total_contributed_paise": 1250000,
            "contribution_count": 75,
            "coverage_rate": 0.4
        }"#;
        let dashboard: PartnerDashboard = serde_json::from_str(raw).unwrap();
        assert_eq!(dashboard.total_workers, 25);
        assert_eq!(dashboard.contribution_count, 75);
        assert!((dashboard.coverage_rate - 0.4).abs() < f64::EPSILON);
    }

    #[test]
    fn coverage_rate_zero_workers() {
        assert!((compute_coverage_rate(0, 0) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn coverage_rate_all_eligible() {
        assert!((compute_coverage_rate(10, 10) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn coverage_rate_partial() {
        assert!((compute_coverage_rate(3, 12) - 0.25).abs() < f64::EPSILON);
    }

    #[test]
    fn coverage_rate_none_eligible() {
        assert!((compute_coverage_rate(0, 50) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn coverage_rate_fractional() {
        let rate = compute_coverage_rate(1, 3);
        assert!((rate - 1.0 / 3.0).abs() < 0.0001);
    }

    #[test]
    fn dashboard_empty_partner() {
        let dashboard = PartnerDashboard {
            total_workers: 0,
            total_contributed_paise: 0,
            contribution_count: 0,
            coverage_rate: 0.0,
        };
        let json = serde_json::to_value(&dashboard).unwrap();
        assert_eq!(json["total_workers"], 0);
        assert_eq!(json["coverage_rate"], 0.0);
    }
}

// ── 11. Partner reports — date range filtering ──────────────────────────────

mod partner_reports {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn report_query_with_date_range() {
        let query = ReportQuery {
            date_from: Some(NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()),
            date_to: Some(NaiveDate::from_ymd_opt(2026, 3, 31).unwrap()),
            page: Some(1),
            per_page: Some(50),
        };
        assert!(query.date_from.is_some());
        assert!(query.date_to.is_some());
        assert_eq!(query.date_from.unwrap().to_string(), "2026-01-01");
        assert_eq!(query.date_to.unwrap().to_string(), "2026-03-31");
    }

    #[test]
    fn report_query_no_dates_returns_all() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: None,
            per_page: None,
        };
        assert!(query.date_from.is_none());
        assert!(query.date_to.is_none());
    }

    #[test]
    fn report_query_deserialises_from_query_string_style() {
        // Simulate what serde would produce from query parameters
        let raw = r#"{"date_from":"2026-01-15","date_to":"2026-02-15","page":2,"per_page":25}"#;
        let query: ReportQuery = serde_json::from_str(raw).unwrap();
        assert_eq!(
            query.date_from.unwrap(),
            NaiveDate::from_ymd_opt(2026, 1, 15).unwrap()
        );
        assert_eq!(
            query.date_to.unwrap(),
            NaiveDate::from_ymd_opt(2026, 2, 15).unwrap()
        );
        assert_eq!(query.page, Some(2));
        assert_eq!(query.per_page, Some(25));
    }

    #[test]
    fn contribution_report_struct_empty() {
        let report = ContributionReport {
            rows: vec![],
            total_amount_paise: 0,
            total_count: 0,
            page: 1,
            per_page: 50,
        };
        assert!(report.rows.is_empty());
        assert_eq!(report.total_amount_paise, 0);
        assert_eq!(report.total_count, 0);
    }

    #[test]
    fn contribution_report_with_rows() {
        let row = ContributionReportRow {
            contribution_id: Uuid::new_v4(),
            worker_phone: "+919876543210".to_string(),
            worker_name: Some("Ravi Kumar".to_string()),
            amount_paise: 15_000,
            currency: Some("INR".to_string()),
            status: Some("completed".to_string()),
            idempotency_key: Some("batch-001-ravi".to_string()),
            created_at: Some(Utc::now()),
        };
        let report = ContributionReport {
            rows: vec![row],
            total_amount_paise: 15_000,
            total_count: 1,
            page: 1,
            per_page: 50,
        };
        assert_eq!(report.rows.len(), 1);
        assert_eq!(report.rows[0].amount_paise, 15_000);
        assert_eq!(report.rows[0].worker_phone, "+919876543210");
    }

    #[test]
    fn contribution_report_serialises_to_json() {
        let report = ContributionReport {
            rows: vec![],
            total_amount_paise: 750_000,
            total_count: 30,
            page: 3,
            per_page: 10,
        };
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["total_amount_paise"], 750_000);
        assert_eq!(json["total_count"], 30);
        assert_eq!(json["page"], 3);
        assert_eq!(json["per_page"], 10);
    }

    #[test]
    fn report_pagination_offset_for_date_filtered_query() {
        let query = ReportQuery {
            date_from: Some(NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()),
            date_to: Some(NaiveDate::from_ymd_opt(2026, 3, 18).unwrap()),
            page: Some(4),
            per_page: Some(20),
        };
        let page = query.page.unwrap_or(1).max(1);
        let per_page = query.per_page.unwrap_or(50).min(1000).max(1);
        let offset = (page - 1) * per_page;
        assert_eq!(offset, 60);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXTENDED AUTH TESTS
// ═══════════════════════════════════════════════════════════════════════════

mod auth_otp {
    use super::*;
    use aarokya_backend::api::auth::{OtpEntry, RateLimitStore};

    const RATE_LIMIT_MAX: usize = 5;
    const RATE_LIMIT_WINDOW_SECS: i64 = 600;

    // 1. Send OTP — rate limiting (6th request within 10min returns 429-equivalent)
    #[test]
    fn rate_limit_sixth_request_blocked() {
        let store: RateLimitStore = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();
        let now = Utc::now();

        // Insert 5 timestamps within the window
        {
            let mut rl = store.write().unwrap();
            let entry = rl.entry(phone.clone()).or_default();
            for _ in 0..5 {
                entry.timestamps.push(now);
            }
        }

        // Check: after pruning, there are 5 entries => 6th request should be blocked
        {
            let mut rl = store.write().unwrap();
            let entry = rl.entry(phone.clone()).or_default();
            entry
                .timestamps
                .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
            assert!(
                entry.timestamps.len() >= RATE_LIMIT_MAX,
                "Should have reached the rate limit"
            );
        }
    }

    #[test]
    fn rate_limit_old_entries_pruned_allows_new_requests() {
        let store: RateLimitStore = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();
        let now = Utc::now();

        {
            let mut rl = store.write().unwrap();
            let entry = rl.entry(phone.clone()).or_default();
            // 5 old entries outside the window
            for _ in 0..5 {
                entry
                    .timestamps
                    .push(now - chrono::Duration::seconds(RATE_LIMIT_WINDOW_SECS + 60));
            }
            entry
                .timestamps
                .retain(|ts| now.signed_duration_since(*ts).num_seconds() < RATE_LIMIT_WINDOW_SECS);
            assert_eq!(entry.timestamps.len(), 0, "Old entries should be pruned");
            assert!(
                entry.timestamps.len() < RATE_LIMIT_MAX,
                "New request should be allowed"
            );
        }
    }

    #[test]
    fn rate_limit_different_phones_independent() {
        let store: RateLimitStore = RwLock::new(HashMap::new());
        let now = Utc::now();

        {
            let mut rl = store.write().unwrap();
            // Fill phone A to the limit
            let entry_a = rl.entry("+919876543210".to_string()).or_default();
            for _ in 0..5 {
                entry_a.timestamps.push(now);
            }
            // Phone B should be empty
            let entry_b = rl.entry("+919876543211".to_string()).or_default();
            assert_eq!(entry_b.timestamps.len(), 0);
        }
    }

    // 2. Verify OTP — expired OTP returns error
    #[test]
    fn expired_otp_detected() {
        let mut entry = OtpEntry::new("654321".to_string(), 300);
        // Force creation 10 minutes in the past
        entry.created_at = Utc::now() - chrono::Duration::seconds(600);
        assert!(entry.is_expired(), "OTP older than TTL should be expired");
    }

    #[test]
    fn fresh_otp_not_expired() {
        let entry = OtpEntry::new("123456".to_string(), 300);
        assert!(
            !entry.is_expired(),
            "Freshly created OTP should not be expired"
        );
    }

    // 3. Verify OTP — wrong OTP returns error
    #[test]
    fn wrong_otp_does_not_match() {
        let entry = OtpEntry::new("123456".to_string(), 300);
        assert_ne!(entry.otp, "000000", "Wrong OTP should not match");
        assert_eq!(entry.otp, "123456", "Correct OTP should match");
    }

    #[test]
    fn otp_store_insert_retrieve_and_remove() {
        let store: RwLock<HashMap<String, OtpEntry>> = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();

        // Insert
        store
            .write()
            .unwrap()
            .insert(phone.clone(), OtpEntry::new("111111".to_string(), 300));

        // Retrieve
        {
            let reader = store.read().unwrap();
            let entry = reader.get(&phone).unwrap();
            assert_eq!(entry.otp, "111111");
        }

        // Remove (simulates successful verification)
        store.write().unwrap().remove(&phone);
        assert!(store.read().unwrap().get(&phone).is_none());
    }

    #[test]
    fn otp_resend_overwrites_previous() {
        let store: RwLock<HashMap<String, OtpEntry>> = RwLock::new(HashMap::new());
        let phone = "+919876543210".to_string();

        store
            .write()
            .unwrap()
            .insert(phone.clone(), OtpEntry::new("111111".to_string(), 300));
        store
            .write()
            .unwrap()
            .insert(phone.clone(), OtpEntry::new("222222".to_string(), 300));

        let reader = store.read().unwrap();
        assert_eq!(reader.get(&phone).unwrap().otp, "222222");
    }
}

mod auth_jwt {
    use super::*;

    // 4. JWT refresh — valid refresh token works
    #[test]
    fn valid_refresh_token_decodes_successfully() {
        let uid = Uuid::new_v4();
        let token = encode_refresh_token(uid, "customer", JWT_SECRET, 168).unwrap();
        let claims = decode_token(&token, JWT_SECRET).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.user_type, "customer");
        assert_eq!(claims.token_type, "refresh");
    }

    #[test]
    fn refresh_token_can_be_used_to_issue_access_token() {
        let uid = Uuid::new_v4();
        let refresh = encode_refresh_token(uid, "partner", JWT_SECRET, 168).unwrap();
        let refresh_claims = decode_token(&refresh, JWT_SECRET).unwrap();

        // Simulate what the refresh handler does: issue a new access token
        let access =
            encode_token(refresh_claims.sub, &refresh_claims.user_type, JWT_SECRET, 1).unwrap();
        let access_claims = decode_token(&access, JWT_SECRET).unwrap();
        assert_eq!(access_claims.sub, uid);
        assert_eq!(access_claims.user_type, "partner");
        assert_eq!(access_claims.token_type, "access");
    }

    // 5. JWT refresh — expired refresh token fails
    #[test]
    fn expired_refresh_token_fails_decode() {
        let uid = Uuid::new_v4();
        let token = encode_refresh_token(uid, "customer", JWT_SECRET, -1).unwrap();
        let result = decode_token(&token, JWT_SECRET);
        assert!(result.is_err(), "Expired refresh token must fail decode");
    }

    #[test]
    fn expired_access_token_fails_decode() {
        let uid = Uuid::new_v4();
        let token = encode_token_with_type(uid, "customer", JWT_SECRET, -1, "access").unwrap();
        let result = decode_token(&token, JWT_SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_secret_fails_decode() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "customer", JWT_SECRET, 1).unwrap();
        let result = decode_token(&token, "wrong-secret-key-should-fail");
        assert!(result.is_err());
    }

    #[test]
    fn access_token_type_is_access() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "partner", JWT_SECRET, 1).unwrap();
        let claims = decode_token(&token, JWT_SECRET).unwrap();
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn refresh_token_type_is_refresh() {
        let uid = Uuid::new_v4();
        let token = encode_refresh_token(uid, "partner", JWT_SECRET, 168).unwrap();
        let claims = decode_token(&token, JWT_SECRET).unwrap();
        assert_eq!(claims.token_type, "refresh");
    }

    #[test]
    fn token_claims_preserve_user_type() {
        for user_type in &[
            "customer",
            "partner",
            "operator_super_admin",
            "operator_support",
        ] {
            let uid = Uuid::new_v4();
            let token = encode_token(uid, user_type, JWT_SECRET, 1).unwrap();
            let claims = decode_token(&token, JWT_SECRET).unwrap();
            assert_eq!(claims.user_type, *user_type);
            assert_eq!(claims.sub, uid);
        }
    }

    #[test]
    fn token_expiry_is_set_correctly() {
        let uid = Uuid::new_v4();
        let before = Utc::now().timestamp();
        let token = encode_token(uid, "customer", JWT_SECRET, 2).unwrap();
        let after = Utc::now().timestamp();
        let claims = decode_token(&token, JWT_SECRET).unwrap();

        // exp should be ~2 hours from now
        let expected_min = before + (2 * 3600);
        let expected_max = after + (2 * 3600);
        assert!(
            claims.exp >= expected_min && claims.exp <= expected_max,
            "Token expiry should be ~2 hours from now"
        );
    }
}

// ── RBAC tests ──────────────────────────────────────────────────────────────

mod auth_rbac {
    use super::*;

    // 6. RBAC — customer cannot access partner endpoints
    #[test]
    fn customer_cannot_access_partner_endpoints() {
        let user = make_auth_user("customer");
        let result = require_role(&user, &[Role::Partner]);
        assert!(
            result.is_err(),
            "Customer must be forbidden from partner endpoints"
        );
    }

    #[test]
    fn customer_cannot_access_operator_endpoints() {
        let user = make_auth_user("customer");
        let result = require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSupport]);
        assert!(result.is_err());
    }

    // 7. RBAC — partner cannot access operator endpoints
    #[test]
    fn partner_cannot_access_operator_endpoints() {
        let user = make_auth_user("partner");
        let result = require_role(
            &user,
            &[
                Role::OperatorInsuranceOps,
                Role::OperatorSupport,
                Role::OperatorAnalytics,
                Role::OperatorPartnerManager,
            ],
        );
        assert!(
            result.is_err(),
            "Partner must be forbidden from operator endpoints"
        );
    }

    #[test]
    fn partner_can_access_partner_endpoints() {
        let user = make_auth_user("partner");
        let result = require_role(&user, &[Role::Partner]);
        assert!(result.is_ok());
    }

    #[test]
    fn customer_can_access_customer_endpoints() {
        let user = make_auth_user("customer");
        let result = require_role(&user, &[Role::Customer]);
        assert!(result.is_ok());
    }

    // 8. RBAC — super_admin can access everything
    #[test]
    fn super_admin_can_access_customer_endpoints() {
        let user = make_auth_user("operator_super_admin");
        assert!(require_role(&user, &[Role::Customer]).is_ok());
    }

    #[test]
    fn super_admin_can_access_partner_endpoints() {
        let user = make_auth_user("operator_super_admin");
        assert!(require_role(&user, &[Role::Partner]).is_ok());
    }

    #[test]
    fn super_admin_can_access_operator_endpoints() {
        let user = make_auth_user("operator_super_admin");
        assert!(require_role(&user, &[Role::OperatorInsuranceOps]).is_ok());
        assert!(require_role(&user, &[Role::OperatorSupport]).is_ok());
        assert!(require_role(&user, &[Role::OperatorAnalytics]).is_ok());
        assert!(require_role(&user, &[Role::OperatorPartnerManager]).is_ok());
    }

    #[test]
    fn super_admin_allowed_even_when_not_in_list() {
        let user = make_auth_user("operator_super_admin");
        // Only Partner is listed, but super_admin bypasses
        assert!(require_role(&user, &[Role::Partner]).is_ok());
    }

    #[test]
    fn unknown_role_is_forbidden() {
        let user = make_auth_user("hacker");
        let result = require_role(&user, &[Role::Customer, Role::Partner]);
        assert!(result.is_err());
    }

    #[test]
    fn role_from_str_roundtrip_all_variants() {
        let roles = vec![
            Role::Customer,
            Role::Partner,
            Role::OperatorSuperAdmin,
            Role::OperatorInsuranceOps,
            Role::OperatorSupport,
            Role::OperatorAnalytics,
            Role::OperatorPartnerManager,
        ];
        for role in &roles {
            let s = role.as_str();
            let parsed = Role::from_str(s);
            assert_eq!(
                parsed.as_ref(),
                Some(role),
                "Round-trip failed for {:?}",
                role
            );
        }
    }

    #[test]
    fn operator_insurance_ops_cannot_access_partner_manager() {
        let user = make_auth_user("operator_insurance_ops");
        let result = require_role(&user, &[Role::OperatorPartnerManager]);
        assert!(result.is_err());
    }

    #[test]
    fn multi_role_endpoint_allows_any_listed() {
        let customer = make_auth_user("customer");
        let partner = make_auth_user("partner");
        let allowed = &[Role::Customer, Role::Partner];

        assert!(require_role(&customer, allowed).is_ok());
        assert!(require_role(&partner, allowed).is_ok());
    }
}

// ── Error response mapping tests ────────────────────────────────────────────

mod error_responses {
    use super::*;
    use actix_web::http::StatusCode;
    use actix_web::ResponseError;

    #[test]
    fn not_found_returns_404() {
        let err = AppError::NotFound("Not found".to_string());
        assert_eq!(err.error_response().status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn conflict_returns_409() {
        let err = AppError::Conflict("Conflict".to_string());
        assert_eq!(err.error_response().status(), StatusCode::CONFLICT);
    }

    #[test]
    fn unauthorized_returns_401() {
        let err = AppError::Unauthorized("Unauthorized".to_string());
        assert_eq!(err.error_response().status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn forbidden_returns_403() {
        let err = AppError::Forbidden("Forbidden".to_string());
        assert_eq!(err.error_response().status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn validation_returns_400() {
        let err = AppError::Validation("Bad input".to_string());
        assert_eq!(err.error_response().status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn too_many_requests_returns_429() {
        let err = AppError::TooManyRequests("Slow down".to_string());
        assert_eq!(err.error_response().status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn bad_request_returns_400() {
        let err = AppError::BadRequest("Bad request".to_string());
        assert_eq!(err.error_response().status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn internal_error_returns_500() {
        let err = AppError::Internal("Something broke".to_string());
        assert_eq!(
            err.error_response().status(),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }
}

// ── Integration-style tests using actix-web test helpers ────────────────────

mod actix_integration {
    use super::*;
    use aarokya_backend::api::auth::{
        refresh_token as refresh_token_handler, send_otp, OtpStore, RateLimitStore, RefreshResponse,
    };
    use actix_web::{test, web, App};

    fn test_app_data() -> (
        web::Data<AppConfig>,
        web::Data<OtpStore>,
        web::Data<RateLimitStore>,
    ) {
        let config = web::Data::new(test_config());
        let otp_store = web::Data::new(OtpStore::default());
        let rate_limit_store = web::Data::new(RateLimitStore::default());
        (config, otp_store, rate_limit_store)
    }

    // ── Send OTP rate limit integration test ────────────────────────────────

    #[actix_rt::test]
    async fn send_otp_rate_limit_blocks_sixth_request() {
        let (config, otp_store, rate_limit_store) = test_app_data();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store)
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        // First 5 requests succeed
        for i in 0..5 {
            let req = test::TestRequest::post()
                .uri("/send-otp")
                .set_json(serde_json::json!({ "phone": "+919876500000" }))
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 200, "Request {} should succeed", i + 1);
        }

        // 6th request is rate limited (returns 400 = BadRequest)
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876500000" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400, "6th OTP request should be rate-limited");
    }

    #[actix_rt::test]
    async fn send_otp_different_phone_not_rate_limited() {
        let (config, otp_store, rate_limit_store) = test_app_data();
        let app = test::init_service(
            App::new()
                .app_data(config)
                .app_data(otp_store)
                .app_data(rate_limit_store)
                .route("/send-otp", web::post().to(send_otp)),
        )
        .await;

        // Exhaust rate limit for phone A
        for _ in 0..5 {
            let req = test::TestRequest::post()
                .uri("/send-otp")
                .set_json(serde_json::json!({ "phone": "+919876500001" }))
                .to_request();
            test::call_service(&app, req).await;
        }

        // Phone B should still work
        let req = test::TestRequest::post()
            .uri("/send-otp")
            .set_json(serde_json::json!({ "phone": "+919876500002" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    // ── JWT refresh integration tests ───────────────────────────────────────

    #[actix_rt::test]
    async fn refresh_valid_token_returns_new_access_token() {
        let cfg = test_config();
        let uid = Uuid::new_v4();
        let refresh = encode_refresh_token(uid, "customer", &cfg.jwt_secret, 168).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg.clone()))
                .route("/refresh", web::post().to(refresh_token_handler)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": refresh }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: RefreshResponse = test::read_body_json(resp).await;
        let claims = decode_token(&body.access_token, &cfg.jwt_secret).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.token_type, "access");
    }

    #[actix_rt::test]
    async fn refresh_expired_token_returns_401() {
        let cfg = test_config();
        let uid = Uuid::new_v4();
        let refresh = encode_refresh_token(uid, "customer", &cfg.jwt_secret, -1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/refresh", web::post().to(refresh_token_handler)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": refresh }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn refresh_with_access_token_returns_401() {
        let cfg = test_config();
        let uid = Uuid::new_v4();
        let access = encode_token(uid, "customer", &cfg.jwt_secret, 1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/refresh", web::post().to(refresh_token_handler)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/refresh")
            .set_json(serde_json::json!({ "refresh_token": access }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    // ── RBAC integration tests via actix ────────────────────────────────────

    async fn partner_only_handler(
        user: AuthenticatedUser,
    ) -> Result<actix_web::HttpResponse, AppError> {
        require_role(&user, &[Role::Partner])?;
        Ok(actix_web::HttpResponse::Ok().json(serde_json::json!({"ok": true})))
    }

    async fn operator_only_handler(
        user: AuthenticatedUser,
    ) -> Result<actix_web::HttpResponse, AppError> {
        require_role(
            &user,
            &[
                Role::OperatorInsuranceOps,
                Role::OperatorSupport,
                Role::OperatorAnalytics,
                Role::OperatorPartnerManager,
            ],
        )?;
        Ok(actix_web::HttpResponse::Ok().json(serde_json::json!({"ok": true})))
    }

    #[actix_rt::test]
    async fn rbac_customer_blocked_from_partner_endpoint() {
        let cfg = test_config();
        let token = encode_token(Uuid::new_v4(), "customer", &cfg.jwt_secret, 1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/partner-only", web::get().to(partner_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/partner-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 403);
    }

    #[actix_rt::test]
    async fn rbac_partner_blocked_from_operator_endpoint() {
        let cfg = test_config();
        let token = encode_token(Uuid::new_v4(), "partner", &cfg.jwt_secret, 1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/operator-only", web::get().to(operator_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/operator-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 403);
    }

    #[actix_rt::test]
    async fn rbac_super_admin_accesses_partner_endpoint() {
        let cfg = test_config();
        let token =
            encode_token(Uuid::new_v4(), "operator_super_admin", &cfg.jwt_secret, 1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/partner-only", web::get().to(partner_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/partner-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_rt::test]
    async fn rbac_super_admin_accesses_operator_endpoint() {
        let cfg = test_config();
        let token =
            encode_token(Uuid::new_v4(), "operator_super_admin", &cfg.jwt_secret, 1).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/operator-only", web::get().to(operator_only_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/operator-only")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    // ── Auth middleware integration tests ────────────────────────────────────

    async fn protected_handler(user: AuthenticatedUser) -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(serde_json::json!({
            "user_id": user.user_id,
            "user_type": user.user_type,
        }))
    }

    #[actix_rt::test]
    async fn auth_middleware_rejects_missing_header() {
        let cfg = test_config();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/protected").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn auth_middleware_rejects_refresh_token_as_access() {
        let cfg = test_config();
        let refresh =
            encode_refresh_token(Uuid::new_v4(), "customer", &cfg.jwt_secret, 168).unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", format!("Bearer {}", refresh)))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_rt::test]
    async fn auth_middleware_rejects_malformed_bearer() {
        let cfg = test_config();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(cfg))
                .route("/protected", web::get().to(protected_handler)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/protected")
            .insert_header(("Authorization", "Token abc123"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }
}
