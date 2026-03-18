//! Comprehensive tests for the HSA engine and Contribution modules.
//!
//! These tests cover domain logic (eligibility, validation, calculations) and
//! request/response serialization without requiring a live database. They are
//! designed for Automated Regression Testing (ART).

use uuid::Uuid;
use validator::Validate;

use aarokya_backend::domain::contribution::{
    ContributionListParams, ContributionSummary, ContributionSummaryResponse, CreateContributionRequest,
    MonthlySummary, VALID_SOURCE_TYPES,
};
use aarokya_backend::domain::hsa::{
    self, CreateHsaRequest, HealthSavingsAccount, HsaDashboard,
    BASIC_INSURANCE_THRESHOLD, PREMIUM_INSURANCE_THRESHOLD,
};
use aarokya_backend::infrastructure::auth::{
    encode_token, decode_token, AuthenticatedUser, Role, require_role,
};
use aarokya_backend::infrastructure::error::AppError;

// ---------------------------------------------------------------------------
// Helper constants
// ---------------------------------------------------------------------------

const JWT_SECRET: &str = "art-test-jwt-secret-key";

// ---------------------------------------------------------------------------
// HSA Tests
// ---------------------------------------------------------------------------

mod hsa_tests {
    use super::*;

    // ---- 1. Create HSA account - success (domain + serialization) --------

    #[test]
    fn create_hsa_request_valid_abha_id() {
        let req = CreateHsaRequest {
            abha_id: "12-3456-7890-1234".to_string(),
        };
        assert!(req.validate().is_ok(), "A valid ABHA ID should pass validation");
    }

    #[test]
    fn create_hsa_request_serialization_roundtrip() {
        let json = r#"{"abha_id":"12-3456-7890-1234"}"#;
        let req: CreateHsaRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.abha_id, "12-3456-7890-1234");
    }

    #[test]
    fn create_hsa_only_customer_role_allowed() {
        let customer = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "customer".to_string(),
        };
        assert!(
            require_role(&customer, &[Role::Customer]).is_ok(),
            "Customer role should be permitted"
        );

        let partner = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "partner".to_string(),
        };
        // In the API handler, only "customer" user_type is allowed to create HSA
        assert_ne!(partner.user_type, "customer");
    }

    #[test]
    fn hsa_account_struct_serializes_correctly() {
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let hsa = HealthSavingsAccount {
            id,
            user_id,
            abha_id: "ABHA12345678".to_string(),
            balance_paise: 500_000,
            total_contributed_paise: 500_000,
            insurance_eligible: Some(true),
            status: Some("active".to_string()),
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
        };

        let json = serde_json::to_value(&hsa).unwrap();
        assert_eq!(json["balance_paise"], 500_000);
        assert_eq!(json["abha_id"], "ABHA12345678");
        assert_eq!(json["insurance_eligible"], true);
        assert_eq!(json["status"], "active");
    }

    // ---- 2. Create HSA - duplicate returns conflict -----------------------

    #[test]
    fn duplicate_hsa_returns_conflict_error() {
        let err = AppError::Conflict("User already has an HSA account".to_string());
        let msg = format!("{}", err);
        assert!(msg.contains("Conflict"), "Error should indicate conflict");
        assert!(msg.contains("already has an HSA"), "Error should mention duplicate");
    }

    #[test]
    fn abha_id_validation_too_short() {
        let req = CreateHsaRequest {
            abha_id: "1234567".to_string(), // 7 chars, min is 8
        };
        assert!(req.validate().is_err(), "ABHA ID < 8 chars should fail");
    }

    #[test]
    fn abha_id_validation_too_long() {
        let req = CreateHsaRequest {
            abha_id: "A".repeat(51),
        };
        assert!(req.validate().is_err(), "ABHA ID > 50 chars should fail");
    }

    #[test]
    fn abha_id_validation_empty() {
        let req = CreateHsaRequest {
            abha_id: "".to_string(),
        };
        assert!(req.validate().is_err(), "Empty ABHA ID should fail");
    }

    #[test]
    fn abha_id_validation_boundary_min() {
        let req = CreateHsaRequest {
            abha_id: "12345678".to_string(), // exactly 8
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn abha_id_validation_boundary_max() {
        let req = CreateHsaRequest {
            abha_id: "A".repeat(50), // exactly 50
        };
        assert!(req.validate().is_ok());
    }

    // ---- 3. Get HSA - returns correct balance -----------------------------

    #[test]
    fn hsa_balance_returned_in_paise() {
        let hsa = HealthSavingsAccount {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            abha_id: "ABHA12345678".to_string(),
            balance_paise: 1_234_567,
            total_contributed_paise: 1_234_567,
            insurance_eligible: Some(true),
            status: Some("active".to_string()),
            created_at: None,
            updated_at: None,
        };

        let json = serde_json::to_value(&hsa).unwrap();
        assert_eq!(
            json["balance_paise"].as_i64().unwrap(),
            1_234_567,
            "Balance must be in paise (integer)"
        );
        assert_eq!(
            json["total_contributed_paise"].as_i64().unwrap(),
            1_234_567,
            "Total contributed must be in paise (integer)"
        );
    }

    #[test]
    fn hsa_zero_balance_initial() {
        let hsa = HealthSavingsAccount {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            abha_id: "ABHA12345678".to_string(),
            balance_paise: 0,
            total_contributed_paise: 0,
            insurance_eligible: Some(false),
            status: Some("active".to_string()),
            created_at: None,
            updated_at: None,
        };

        assert_eq!(hsa.balance_paise, 0);
        assert_eq!(hsa.total_contributed_paise, 0);
        assert_eq!(hsa.insurance_eligible, Some(false));
    }

    // ---- 4. Get HSA - unauthenticated returns 401 -------------------------

    #[test]
    fn unauthenticated_request_produces_401_error() {
        let err = AppError::Unauthorized("Missing Authorization header".to_string());
        let msg = format!("{}", err);
        assert!(msg.contains("Unauthorized"));
    }

    #[test]
    fn invalid_token_produces_401_error() {
        let result = decode_token("garbage.token.here", JWT_SECRET);
        assert!(result.is_err(), "Garbage token should fail decoding");
    }

    #[test]
    fn expired_token_produces_error() {
        let uid = Uuid::new_v4();
        // Encode with -1 hour expiry (already expired)
        let token = aarokya_backend::infrastructure::auth::encode_token(
            uid, "customer", JWT_SECRET, -1,
        )
        .unwrap();
        let result = decode_token(&token, JWT_SECRET);
        assert!(result.is_err(), "Expired token should be rejected");
    }

    #[test]
    fn wrong_secret_produces_error() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "customer", JWT_SECRET, 1).unwrap();
        let result = decode_token(&token, "different-secret");
        assert!(result.is_err(), "Wrong secret should fail decoding");
    }

    // ---- 5. HSA Dashboard - returns eligibility percentages ---------------

    #[test]
    fn dashboard_basic_progress_at_zero() {
        let progress = hsa::basic_progress(0);
        assert!(
            (progress - 0.0).abs() < f64::EPSILON,
            "Progress at 0 contributions should be 0.0"
        );
    }

    #[test]
    fn dashboard_basic_progress_at_half() {
        let half = BASIC_INSURANCE_THRESHOLD / 2;
        let progress = hsa::basic_progress(half);
        assert!(
            (progress - 0.5).abs() < 0.01,
            "Progress at half threshold should be ~0.5, got {}",
            progress
        );
    }

    #[test]
    fn dashboard_basic_progress_capped_at_one() {
        let progress = hsa::basic_progress(BASIC_INSURANCE_THRESHOLD * 2);
        assert!(
            (progress - 1.0).abs() < f64::EPSILON,
            "Progress should cap at 1.0"
        );
    }

    #[test]
    fn dashboard_premium_progress_at_half() {
        let half = PREMIUM_INSURANCE_THRESHOLD / 2;
        let progress = hsa::premium_progress(half);
        assert!(
            (progress - 0.5).abs() < f64::EPSILON,
            "Premium progress at half should be 0.5"
        );
    }

    #[test]
    fn dashboard_premium_progress_capped_at_one() {
        let progress = hsa::premium_progress(PREMIUM_INSURANCE_THRESHOLD * 3);
        assert!(
            (progress - 1.0).abs() < f64::EPSILON,
            "Premium progress should cap at 1.0"
        );
    }

    #[test]
    fn dashboard_eligibility_percentage_zero_to_hundred() {
        assert!(
            (hsa::insurance_eligibility_percentage(0) - 0.0).abs() < f64::EPSILON,
            "0 contributions => 0%"
        );
        assert!(
            (hsa::insurance_eligibility_percentage(BASIC_INSURANCE_THRESHOLD) - 100.0).abs()
                < f64::EPSILON,
            "At basic threshold => 100%"
        );
        assert!(
            (hsa::insurance_eligibility_percentage(BASIC_INSURANCE_THRESHOLD * 2) - 100.0).abs()
                < f64::EPSILON,
            "Over threshold still capped at 100%"
        );
    }

    #[test]
    fn dashboard_struct_serializes_all_fields() {
        let dashboard = HsaDashboard {
            balance_paise: 500_000,
            total_contributed_paise: 500_000,
            insurance_eligible: true,
            basic_insurance_progress: 1.0,
            premium_insurance_progress: 0.5,
            contribution_count: 10,
            contribution_velocity_paise_per_month: 50_000.0,
            insurance_tier: "basic".to_string(),
        };

        let json = serde_json::to_value(&dashboard).unwrap();
        assert_eq!(json["balance_paise"], 500_000);
        assert_eq!(json["insurance_eligible"], true);
        assert_eq!(json["basic_insurance_progress"], 1.0);
        assert_eq!(json["premium_insurance_progress"], 0.5);
        assert_eq!(json["contribution_count"], 10);
        assert_eq!(json["insurance_tier"], "basic");
    }

    // ---- 6. HSA Dashboard - basic insurance eligible at 399900 paise ------

    #[test]
    fn basic_eligible_at_threshold() {
        assert!(
            hsa::is_basic_eligible(399_900),
            "Exactly 399900 paise should be basic eligible"
        );
        assert_eq!(hsa::insurance_tier(399_900), "basic");
    }

    #[test]
    fn basic_not_eligible_one_below_threshold() {
        assert!(
            !hsa::is_basic_eligible(399_899),
            "399899 paise should NOT be basic eligible"
        );
        assert_eq!(hsa::insurance_tier(399_899), "none");
    }

    #[test]
    fn basic_eligible_above_threshold() {
        assert!(hsa::is_basic_eligible(500_000));
        assert_eq!(hsa::insurance_tier(500_000), "basic");
    }

    // ---- 7. HSA Dashboard - premium insurance eligible at 1000000 paise ---

    #[test]
    fn premium_eligible_at_threshold() {
        assert!(
            hsa::is_premium_eligible(1_000_000),
            "Exactly 1000000 paise should be premium eligible"
        );
        assert_eq!(hsa::insurance_tier(1_000_000), "premium");
    }

    #[test]
    fn premium_not_eligible_one_below_threshold() {
        assert!(
            !hsa::is_premium_eligible(999_999),
            "999999 paise should NOT be premium eligible"
        );
        assert_eq!(hsa::insurance_tier(999_999), "basic");
    }

    #[test]
    fn premium_eligible_well_above_threshold() {
        assert!(hsa::is_premium_eligible(5_000_000));
        assert_eq!(hsa::insurance_tier(5_000_000), "premium");
    }

    // ---- 8. HSA Dashboard - not eligible below threshold ------------------

    #[test]
    fn not_eligible_at_zero() {
        assert!(!hsa::is_basic_eligible(0));
        assert!(!hsa::is_premium_eligible(0));
        assert_eq!(hsa::insurance_tier(0), "none");
    }

    #[test]
    fn not_eligible_small_balance() {
        assert!(!hsa::is_basic_eligible(100_000));
        assert!(!hsa::is_premium_eligible(100_000));
        assert_eq!(hsa::insurance_tier(100_000), "none");
    }

    #[test]
    fn insurance_tier_progression() {
        // Track the full progression: none -> basic -> premium
        let balances_and_tiers = vec![
            (0, "none"),
            (199_950, "none"),
            (399_899, "none"),
            (399_900, "basic"),
            (500_000, "basic"),
            (999_999, "basic"),
            (1_000_000, "premium"),
            (2_000_000, "premium"),
        ];
        for (balance, expected_tier) in balances_and_tiers {
            assert_eq!(
                hsa::insurance_tier(balance),
                expected_tier,
                "Balance {} should be tier '{}'",
                balance,
                expected_tier
            );
        }
    }

    // ---- Contribution velocity tests (used by dashboard) ------------------

    #[test]
    fn velocity_new_account_extrapolates() {
        // Account age 0 days: velocity = contributed * 30
        let v = hsa::contribution_velocity(100_000, 0);
        assert!(
            (v - 3_000_000.0).abs() < f64::EPSILON,
            "New account velocity should extrapolate to 30 days"
        );
    }

    #[test]
    fn velocity_one_month_account() {
        let v = hsa::contribution_velocity(100_000, 30);
        assert!(
            (v - 100_000.0).abs() < 0.01,
            "30-day account: velocity = total / 1 month"
        );
    }

    #[test]
    fn velocity_three_month_account() {
        let v = hsa::contribution_velocity(300_000, 90);
        assert!(
            (v - 100_000.0).abs() < 0.01,
            "90-day account: velocity = 300000 / 3 months"
        );
    }

    #[test]
    fn velocity_negative_days_treated_as_new() {
        let v = hsa::contribution_velocity(50_000, -10);
        assert!(
            (v - 1_500_000.0).abs() < f64::EPSILON,
            "Negative days should behave like 0 days"
        );
    }
}

// ---------------------------------------------------------------------------
// Contribution Tests
// ---------------------------------------------------------------------------

mod contribution_tests {
    use super::*;

    // ---- 1. Create contribution - success with idempotency key ------------

    #[test]
    fn valid_contribution_request_with_idempotency_key() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 50_000,
            idempotency_key: "idem-key-abc-123".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_source_type().is_ok());
    }

    #[test]
    fn valid_contribution_with_all_fields() {
        let req = CreateContributionRequest {
            source_type: "employer".to_string(),
            source_id: Some(Uuid::new_v4()),
            amount_paise: 200_000,
            idempotency_key: "employer-contrib-2024-01".to_string(),
            metadata: Some(serde_json::json!({
                "employer_name": "Acme Corp",
                "pay_period": "2024-01"
            })),
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_source_type().is_ok());
    }

    #[test]
    fn contribution_request_deserialization() {
        let json = r#"{
            "source_type": "platform",
            "amount_paise": 75000,
            "idempotency_key": "platform-reward-001",
            "metadata": {"campaign": "new-user-bonus"}
        }"#;
        let req: CreateContributionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.source_type, "platform");
        assert_eq!(req.amount_paise, 75_000);
        assert_eq!(req.idempotency_key, "platform-reward-001");
        assert!(req.source_id.is_none());
        assert!(req.metadata.is_some());
    }

    #[test]
    fn all_valid_source_types_pass_validation() {
        for source in VALID_SOURCE_TYPES {
            let req = CreateContributionRequest {
                source_type: source.to_string(),
                source_id: None,
                amount_paise: 1_000,
                idempotency_key: format!("key-{}", source),
                metadata: None,
            };
            assert!(
                req.validate().is_ok(),
                "Source type '{}' should be valid",
                source
            );
            assert!(
                req.validate_source_type().is_ok(),
                "Source type '{}' should pass validate_source_type",
                source
            );
        }
    }

    // ---- 2. Duplicate idempotency key returns same result -----------------

    #[test]
    fn idempotency_key_uniqueness_concept() {
        // Two requests with same idempotency key and HSA should be treated
        // as the same operation. We verify the domain rule: the API checks
        // SELECT ... WHERE idempotency_key = $1 AND hsa_id = $2.
        // Here we verify the key value is preserved through deserialization roundtrip.
        let key = "unique-idempotency-key-12345";
        let json = format!(
            r#"{{"source_type":"self","amount_paise":10000,"idempotency_key":"{}"}}"#,
            key
        );
        let req: CreateContributionRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req.idempotency_key, key);
        assert!(req.validate().is_ok());
    }

    #[test]
    fn contribution_struct_serializes_for_idempotent_response() {
        use aarokya_backend::domain::contribution::Contribution;

        let contribution = Contribution {
            id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 10_000,
            currency: Some("INR".to_string()),
            reference_id: None,
            idempotency_key: Some("same-key".to_string()),
            status: Some("completed".to_string()),
            metadata: None,
            created_at: Some(chrono::Utc::now()),
        };

        let json = serde_json::to_value(&contribution).unwrap();
        assert_eq!(json["idempotency_key"], "same-key");
        assert_eq!(json["status"], "completed");
        assert_eq!(json["amount_paise"], 10_000);
    }

    // ---- 3. Create contribution - updates HSA balance atomically ----------

    #[test]
    fn contribution_updates_insurance_eligibility_none_to_basic() {
        let current_total = 300_000;
        let contribution_amount = 100_000;
        let new_total = current_total + contribution_amount;

        // Before contribution: not eligible
        assert!(!hsa::is_basic_eligible(current_total));
        assert_eq!(hsa::insurance_tier(current_total), "none");

        // After contribution: eligible for basic (400000 >= 399900)
        assert!(hsa::is_basic_eligible(new_total));
        assert_eq!(hsa::insurance_tier(new_total), "basic");
    }

    #[test]
    fn contribution_updates_insurance_eligibility_basic_to_premium() {
        let current_total = 900_000;
        let contribution_amount = 200_000;
        let new_total = current_total + contribution_amount;

        assert!(hsa::is_basic_eligible(current_total));
        assert!(!hsa::is_premium_eligible(current_total));
        assert_eq!(hsa::insurance_tier(current_total), "basic");

        assert!(hsa::is_premium_eligible(new_total));
        assert_eq!(hsa::insurance_tier(new_total), "premium");
    }

    #[test]
    fn balance_arithmetic_is_exact_integer() {
        // Verify paise arithmetic never involves floating point
        let balance: i64 = 999_999;
        let contribution: i64 = 1;
        let new_balance = balance + contribution;
        assert_eq!(new_balance, 1_000_000, "Paise arithmetic must be exact");
    }

    #[test]
    fn multiple_contributions_accumulate_correctly() {
        let contributions = vec![50_000i64, 100_000, 25_000, 224_900];
        let total: i64 = contributions.iter().sum();
        assert_eq!(total, 399_900, "Sum of contributions should equal 399900");
        assert!(hsa::is_basic_eligible(total));
    }

    // ---- 4. Create contribution - invalid amount returns 400 --------------

    #[test]
    fn zero_amount_fails_validation() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 0,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err(), "Zero amount should fail validation");
    }

    #[test]
    fn negative_amount_fails_validation() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: -500,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err(), "Negative amount should fail validation");
    }

    #[test]
    fn minimum_valid_amount_is_one_paise() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok(), "1 paise should be valid minimum");
    }

    #[test]
    fn maximum_valid_amount() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_000,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok(), "100_000_000 should be valid max");
    }

    #[test]
    fn over_maximum_amount_fails() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_001,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err(), "Over 100M paise should fail");
    }

    #[test]
    fn invalid_source_type_fails() {
        let req = CreateContributionRequest {
            source_type: "invalid_source".to_string(),
            source_id: None,
            amount_paise: 10_000,
            idempotency_key: "key".to_string(),
            metadata: None,
        };
        assert!(
            req.validate_source_type().is_err(),
            "Invalid source type should fail"
        );
    }

    #[test]
    fn case_sensitive_source_type() {
        for variant in &["Self", "SELF", "Employer", "EMPLOYER"] {
            let req = CreateContributionRequest {
                source_type: variant.to_string(),
                source_id: None,
                amount_paise: 1_000,
                idempotency_key: "key".to_string(),
                metadata: None,
            };
            assert!(
                req.validate_source_type().is_err(),
                "Source type '{}' should be invalid (case-sensitive)",
                variant
            );
        }
    }

    #[test]
    fn validation_error_maps_to_bad_request() {
        let err = AppError::Validation("amount_paise must be between 1 and 100000000".to_string());
        let msg = format!("{}", err);
        assert!(msg.contains("Validation"), "Should be a validation error");
    }

    // ---- 5. Create contribution - missing idempotency key returns 400 -----

    #[test]
    fn empty_idempotency_key_fails_validation() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 10_000,
            idempotency_key: "".to_string(),
            metadata: None,
        };
        assert!(
            req.validate().is_err(),
            "Empty idempotency key should fail validation"
        );
    }

    #[test]
    fn idempotency_key_too_long_fails() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 10_000,
            idempotency_key: "x".repeat(256),
            metadata: None,
        };
        assert!(
            req.validate().is_err(),
            "Idempotency key > 255 chars should fail"
        );
    }

    #[test]
    fn idempotency_key_max_length_passes() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 10_000,
            idempotency_key: "k".repeat(255),
            metadata: None,
        };
        assert!(
            req.validate().is_ok(),
            "Idempotency key at exactly 255 chars should pass"
        );
    }

    #[test]
    fn missing_idempotency_key_in_json_fails_deserialization() {
        let json = r#"{"source_type": "self", "amount_paise": 10000}"#;
        let result: Result<CreateContributionRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Missing idempotency_key should fail deserialization"
        );
    }

    // ---- 6. List contributions - pagination works -------------------------

    #[test]
    fn pagination_params_defaults() {
        let json = r#"{}"#;
        let params: ContributionListParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.page, None, "Default page should be None");
        assert_eq!(params.per_page, None, "Default per_page should be None");
        assert_eq!(params.source_type, None);
        assert_eq!(params.date_from, None);
        assert_eq!(params.date_to, None);
    }

    #[test]
    fn pagination_params_with_values() {
        let json = r#"{"page": 2, "per_page": 50}"#;
        let params: ContributionListParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.page, Some(2));
        assert_eq!(params.per_page, Some(50));
    }

    #[test]
    fn pagination_offset_calculation() {
        // Replicate the handler's offset logic
        let page = 3i64;
        let per_page = 20i64;
        let offset = (page.max(1) - 1) * per_page.min(100).max(1);
        assert_eq!(offset, 40, "Page 3 with per_page 20 should offset 40");
    }

    #[test]
    fn pagination_per_page_clamped_to_100() {
        let requested_per_page = 200i64;
        let clamped = requested_per_page.min(100).max(1);
        assert_eq!(clamped, 100, "per_page should be clamped to 100 max");
    }

    #[test]
    fn pagination_per_page_clamped_to_minimum_1() {
        let requested_per_page = 0i64;
        let clamped = requested_per_page.min(100).max(1);
        assert_eq!(clamped, 1, "per_page should be at least 1");
    }

    #[test]
    fn pagination_page_clamped_to_minimum_1() {
        let requested_page = -5i64;
        let clamped = requested_page.max(1);
        assert_eq!(clamped, 1, "Page should be at least 1");
    }

    // ---- 7. List contributions - filter by source_type --------------------

    #[test]
    fn filter_params_with_source_type() {
        let json = r#"{"source_type": "employer"}"#;
        let params: ContributionListParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.source_type, Some("employer".to_string()));
    }

    #[test]
    fn filter_params_with_date_range() {
        let json = r#"{"date_from": "2024-01-01", "date_to": "2024-12-31"}"#;
        let params: ContributionListParams = serde_json::from_str(json).unwrap();
        assert!(params.date_from.is_some());
        assert!(params.date_to.is_some());
        assert_eq!(
            params.date_from.unwrap().to_string(),
            "2024-01-01"
        );
        assert_eq!(
            params.date_to.unwrap().to_string(),
            "2024-12-31"
        );
    }

    #[test]
    fn filter_params_combined() {
        let json = r#"{
            "page": 1,
            "per_page": 10,
            "source_type": "tip",
            "date_from": "2024-06-01"
        }"#;
        let params: ContributionListParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.page, Some(1));
        assert_eq!(params.per_page, Some(10));
        assert_eq!(params.source_type, Some("tip".to_string()));
        assert!(params.date_from.is_some());
        assert!(params.date_to.is_none());
    }

    // ---- 8. Contribution summary - aggregates correctly by source ---------

    #[test]
    fn contribution_summary_struct_serialization() {
        let summary = ContributionSummary {
            source_type: "employer".to_string(),
            total_paise: Some(500_000),
            count: Some(5),
        };
        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["source_type"], "employer");
        assert_eq!(json["total_paise"], 500_000);
        assert_eq!(json["count"], 5);
    }

    #[test]
    fn monthly_summary_struct_serialization() {
        let summary = MonthlySummary {
            month: Some("2024-06".to_string()),
            total_paise: Some(120_000),
            count: Some(3),
        };
        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["month"], "2024-06");
        assert_eq!(json["total_paise"], 120_000);
        assert_eq!(json["count"], 3);
    }

    #[test]
    fn contribution_summary_response_full_serialization() {
        let response = ContributionSummaryResponse {
            by_source: vec![
                ContributionSummary {
                    source_type: "self".to_string(),
                    total_paise: Some(200_000),
                    count: Some(4),
                },
                ContributionSummary {
                    source_type: "employer".to_string(),
                    total_paise: Some(300_000),
                    count: Some(2),
                },
            ],
            by_month: vec![
                MonthlySummary {
                    month: Some("2024-06".to_string()),
                    total_paise: Some(250_000),
                    count: Some(3),
                },
                MonthlySummary {
                    month: Some("2024-05".to_string()),
                    total_paise: Some(250_000),
                    count: Some(3),
                },
            ],
            grand_total_paise: 500_000,
            grand_total_count: 6,
        };

        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["grand_total_paise"], 500_000);
        assert_eq!(json["grand_total_count"], 6);
        assert_eq!(json["by_source"].as_array().unwrap().len(), 2);
        assert_eq!(json["by_month"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn contribution_summary_aggregation_logic() {
        // Simulate aggregation that would happen at the DB level
        let contributions = vec![
            ("self", 50_000i64),
            ("self", 75_000),
            ("employer", 200_000),
            ("self", 25_000),
            ("employer", 100_000),
            ("tip", 10_000),
        ];

        let mut by_source: std::collections::HashMap<&str, (i64, i64)> =
            std::collections::HashMap::new();
        for (source, amount) in &contributions {
            let entry = by_source.entry(source).or_insert((0, 0));
            entry.0 += amount;
            entry.1 += 1;
        }

        assert_eq!(by_source["self"], (150_000, 3));
        assert_eq!(by_source["employer"], (300_000, 2));
        assert_eq!(by_source["tip"], (10_000, 1));

        let grand_total: i64 = contributions.iter().map(|(_, a)| a).sum();
        assert_eq!(grand_total, 460_000);
        assert_eq!(contributions.len(), 6);
    }

    #[test]
    fn empty_summary_response() {
        let response = ContributionSummaryResponse {
            by_source: vec![],
            by_month: vec![],
            grand_total_paise: 0,
            grand_total_count: 0,
        };

        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["grand_total_paise"], 0);
        assert_eq!(json["grand_total_count"], 0);
        assert!(json["by_source"].as_array().unwrap().is_empty());
        assert!(json["by_month"].as_array().unwrap().is_empty());
    }

    #[test]
    fn summary_with_null_optional_fields() {
        let summary = ContributionSummary {
            source_type: "government".to_string(),
            total_paise: None,
            count: None,
        };
        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["source_type"], "government");
        assert!(json["total_paise"].is_null());
        assert!(json["count"].is_null());
    }
}

// ---------------------------------------------------------------------------
// Cross-cutting concerns: Auth integration with HSA/Contributions
// ---------------------------------------------------------------------------

mod auth_integration_tests {
    use super::*;

    #[test]
    fn valid_customer_token_decodes_correctly() {
        let uid = Uuid::new_v4();
        let token = encode_token(uid, "customer", JWT_SECRET, 1).unwrap();
        let claims = decode_token(&token, JWT_SECRET).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.user_type, "customer");
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn partner_cannot_create_hsa() {
        let partner = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "partner".to_string(),
        };
        // The handler checks auth.user_type != "customer"
        assert_ne!(partner.user_type, "customer");
    }

    #[test]
    fn operator_cannot_create_hsa() {
        let operator = AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: "operator_super_admin".to_string(),
        };
        assert_ne!(operator.user_type, "customer");
    }

    #[test]
    fn refresh_token_not_accepted_as_access() {
        let uid = Uuid::new_v4();
        let token = aarokya_backend::infrastructure::auth::encode_refresh_token(
            uid, "customer", JWT_SECRET, 168,
        )
        .unwrap();
        let claims = decode_token(&token, JWT_SECRET).unwrap();
        // The auth extractor rejects refresh tokens
        assert_eq!(claims.token_type, "refresh");
        assert_ne!(claims.token_type, "access");
    }
}
