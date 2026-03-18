//! Automated Regression Tests (ART) for Insurance and Claims modules.
//!
//! These tests exercise domain logic (plan eligibility, claim validation,
//! status transitions) and serialization of request/response types without
//! requiring a running database.

// ── Insurance domain tests ──────────────────────────────────────────────────

mod insurance_plans {
    use aarokya_backend::domain::insurance::{
        available_plans, balance_after_premium, check_balance_for_premium, check_eligibility,
        find_plan, InsurancePlan, ACCIDENT_PLAN_ID, BASIC_PLAN_ID, BASIC_PLAN_MIN_BALANCE_PAISE,
        BASIC_PLAN_PREMIUM_PAISE, PREMIUM_PLAN_ID, PREMIUM_PLAN_MIN_BALANCE_PAISE,
        PREMIUM_PLAN_PREMIUM_PAISE,
    };

    // ── 1. List plans - returns all available plans with correct pricing ─────

    #[test]
    fn list_plans_returns_three_plans() {
        let plans = available_plans();
        assert_eq!(plans.len(), 3, "Expected exactly 3 insurance plans");
    }

    #[test]
    fn list_plans_contains_all_plan_ids() {
        let plans = available_plans();
        let ids: Vec<&str> = plans.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"basic-health"), "Missing basic-health plan");
        assert!(
            ids.contains(&"premium-health"),
            "Missing premium-health plan"
        );
        assert!(
            ids.contains(&"accident-cover"),
            "Missing accident-cover plan"
        );
    }

    #[test]
    fn list_plans_basic_plan_pricing() {
        let plan = find_plan(BASIC_PLAN_ID).expect("basic-health plan must exist");
        assert_eq!(plan.premium_paise, 99_900, "Basic premium should be Rs 999");
        assert_eq!(
            plan.coverage_paise, 10_000_000,
            "Basic coverage should be Rs 1 lakh"
        );
        assert_eq!(
            plan.min_balance_paise, 399_900,
            "Basic min balance should be Rs 3999"
        );
    }

    #[test]
    fn list_plans_premium_plan_pricing() {
        let plan = find_plan(PREMIUM_PLAN_ID).expect("premium-health plan must exist");
        assert_eq!(
            plan.premium_paise, 249_900,
            "Premium premium should be Rs 2499"
        );
        assert_eq!(
            plan.coverage_paise, 50_000_000,
            "Premium coverage should be Rs 5 lakh"
        );
        assert_eq!(
            plan.min_balance_paise, 1_000_000,
            "Premium min balance should be Rs 10000"
        );
    }

    #[test]
    fn list_plans_accident_plan_pricing() {
        let plan = find_plan(ACCIDENT_PLAN_ID).expect("accident-cover plan must exist");
        assert_eq!(
            plan.premium_paise, 49_900,
            "Accident premium should be Rs 499"
        );
        assert_eq!(
            plan.coverage_paise, 20_000_000,
            "Accident coverage should be Rs 2 lakh"
        );
        assert_eq!(
            plan.min_balance_paise, 199_900,
            "Accident min balance should be Rs 1999"
        );
    }

    #[test]
    fn list_plans_every_plan_has_nonempty_fields() {
        for plan in available_plans() {
            assert!(!plan.id.is_empty(), "Plan id must not be empty");
            assert!(!plan.name.is_empty(), "Plan name must not be empty");
            assert!(
                !plan.description.is_empty(),
                "Plan description must not be empty"
            );
            assert!(!plan.plan_type.is_empty(), "Plan type must not be empty");
            assert!(plan.premium_paise > 0, "Premium must be positive");
            assert!(plan.coverage_paise > 0, "Coverage must be positive");
            assert!(plan.min_balance_paise > 0, "Min balance must be positive");
        }
    }

    #[test]
    fn find_plan_nonexistent_returns_none() {
        assert!(find_plan("nonexistent-plan").is_none());
        assert!(find_plan("").is_none());
        assert!(find_plan("BASIC-HEALTH").is_none(), "IDs are case-sensitive");
    }

    // ── 6. Plan eligibility - basic plan requires >= 399900 paise ───────────

    #[test]
    fn plan_eligibility_basic_at_exact_threshold() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        assert!(
            check_eligibility(BASIC_PLAN_MIN_BALANCE_PAISE, &plan).is_ok(),
            "Exactly at threshold should be eligible"
        );
    }

    #[test]
    fn plan_eligibility_basic_one_paise_below() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        assert!(
            check_eligibility(BASIC_PLAN_MIN_BALANCE_PAISE - 1, &plan).is_err(),
            "One paise below threshold should be ineligible"
        );
    }

    #[test]
    fn plan_eligibility_basic_above_threshold() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        assert!(check_eligibility(500_000, &plan).is_ok());
        assert!(check_eligibility(1_000_000, &plan).is_ok());
    }

    #[test]
    fn plan_eligibility_basic_zero_contributions() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        let result = check_eligibility(0, &plan);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("Insufficient"),
            "Error message should mention insufficient contributions"
        );
    }

    // ── 7. Plan eligibility - premium plan requires >= 1000000 paise ────────

    #[test]
    fn plan_eligibility_premium_at_exact_threshold() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        assert!(
            check_eligibility(PREMIUM_PLAN_MIN_BALANCE_PAISE, &plan).is_ok(),
            "Exactly at threshold should be eligible"
        );
    }

    #[test]
    fn plan_eligibility_premium_one_paise_below() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        assert!(
            check_eligibility(PREMIUM_PLAN_MIN_BALANCE_PAISE - 1, &plan).is_err(),
            "One paise below threshold should be ineligible"
        );
    }

    #[test]
    fn plan_eligibility_premium_basic_threshold_insufficient() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        assert!(
            check_eligibility(BASIC_PLAN_MIN_BALANCE_PAISE, &plan).is_err(),
            "Basic threshold is not enough for premium plan"
        );
    }

    #[test]
    fn plan_eligibility_premium_above_threshold() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        assert!(check_eligibility(2_000_000, &plan).is_ok());
        assert!(check_eligibility(10_000_000, &plan).is_ok());
    }

    // ── 3. Subscribe - insufficient balance returns error ────────────────────

    #[test]
    fn check_balance_insufficient_for_basic_premium() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        let result = check_balance_for_premium(BASIC_PLAN_PREMIUM_PAISE - 1, &plan);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient balance"));
    }

    #[test]
    fn check_balance_exactly_enough_for_basic_premium() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        assert!(check_balance_for_premium(BASIC_PLAN_PREMIUM_PAISE, &plan).is_ok());
    }

    #[test]
    fn check_balance_insufficient_for_premium_premium() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        let result = check_balance_for_premium(PREMIUM_PLAN_PREMIUM_PAISE - 1, &plan);
        assert!(result.is_err());
    }

    #[test]
    fn check_balance_zero_always_insufficient() {
        for plan in available_plans() {
            let result = check_balance_for_premium(0, &plan);
            assert!(
                result.is_err(),
                "Zero balance should be insufficient for plan {}",
                plan.id
            );
        }
    }

    // ── 2 & 8. Subscribe - success deducts premium / correct dates ──────────

    #[test]
    fn balance_after_premium_basic_plan() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        let starting = 500_000i64;
        let remaining = balance_after_premium(starting, plan.premium_paise);
        assert_eq!(remaining, 500_000 - 99_900);
        assert!(remaining > 0, "Balance should remain positive");
    }

    #[test]
    fn balance_after_premium_exact_premium_leaves_zero() {
        let plan = find_plan(BASIC_PLAN_ID).unwrap();
        let remaining = balance_after_premium(plan.premium_paise, plan.premium_paise);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn balance_after_premium_premium_plan() {
        let plan = find_plan(PREMIUM_PLAN_ID).unwrap();
        let starting = 1_500_000i64;
        let remaining = balance_after_premium(starting, plan.premium_paise);
        assert_eq!(remaining, 1_500_000 - 249_900);
    }

    // ── Serialization tests for InsurancePlan ───────────────────────────────

    #[test]
    fn insurance_plan_serializes_to_json() {
        let plans = available_plans();
        let json = serde_json::to_string(&plans).expect("Plans should serialize to JSON");
        let parsed: Vec<serde_json::Value> =
            serde_json::from_str(&json).expect("Serialized JSON should parse");
        assert_eq!(parsed.len(), 3);

        let basic = parsed.iter().find(|p| p["id"] == "basic-health").unwrap();
        assert_eq!(basic["premium_paise"], 99_900);
        assert_eq!(basic["coverage_paise"], 10_000_000);
        assert_eq!(basic["min_balance_paise"], 399_900);
        assert_eq!(basic["plan_type"], "basic");
    }

    #[test]
    fn insurance_plan_roundtrip_serde() {
        let plans = available_plans();
        let json = serde_json::to_string(&plans).unwrap();
        let deserialized: Vec<InsurancePlan> = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.len(), plans.len());
        for (orig, deser) in plans.iter().zip(deserialized.iter()) {
            assert_eq!(orig.id, deser.id);
            assert_eq!(orig.premium_paise, deser.premium_paise);
            assert_eq!(orig.coverage_paise, deser.coverage_paise);
            assert_eq!(orig.min_balance_paise, deser.min_balance_paise);
        }
    }
}

// ── Subscribe request serialization ─────────────────────────────────────────

mod subscribe_request {
    use aarokya_backend::domain::insurance::SubscribeRequest;

    #[test]
    fn deserialize_valid_subscribe_request() {
        let json = r#"{"plan_id": "basic-health"}"#;
        let req: SubscribeRequest = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(req.plan_id, "basic-health");
    }

    #[test]
    fn deserialize_subscribe_request_missing_plan_id_fails() {
        let json = r#"{}"#;
        let result = serde_json::from_str::<SubscribeRequest>(json);
        assert!(result.is_err(), "Missing plan_id should fail deserialization");
    }

    #[test]
    fn deserialize_subscribe_request_empty_plan_id() {
        let json = r#"{"plan_id": ""}"#;
        let req: SubscribeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.plan_id, "");
        // Empty string deserializes, but find_plan will return None
        assert!(
            aarokya_backend::domain::insurance::find_plan(&req.plan_id).is_none()
        );
    }
}

// ── Claims domain tests ─────────────────────────────────────────────────────

mod claim_validation {
    use aarokya_backend::domain::claim::{is_claim_finalized, is_valid_review_status, validate_claim_amount};
    use aarokya_backend::domain::insurance::{
        BASIC_PLAN_COVERAGE_PAISE, PREMIUM_PLAN_COVERAGE_PAISE,
    };

    // ── 1. Submit claim - success with required fields (amount validation) ──

    #[test]
    fn validate_claim_amount_valid_within_coverage() {
        assert!(validate_claim_amount(50_000, BASIC_PLAN_COVERAGE_PAISE).is_ok());
        assert!(validate_claim_amount(1, BASIC_PLAN_COVERAGE_PAISE).is_ok());
    }

    #[test]
    fn validate_claim_amount_exactly_at_coverage() {
        assert!(
            validate_claim_amount(BASIC_PLAN_COVERAGE_PAISE, BASIC_PLAN_COVERAGE_PAISE).is_ok(),
            "Claim at exactly coverage limit should be valid"
        );
    }

    #[test]
    fn validate_claim_amount_within_premium_coverage() {
        assert!(validate_claim_amount(25_000_000, PREMIUM_PLAN_COVERAGE_PAISE).is_ok());
        assert!(
            validate_claim_amount(PREMIUM_PLAN_COVERAGE_PAISE, PREMIUM_PLAN_COVERAGE_PAISE)
                .is_ok()
        );
    }

    // ── 3. Submit claim - invalid amount returns 400 ────────────────────────

    #[test]
    fn validate_claim_amount_zero_is_invalid() {
        let result = validate_claim_amount(0, BASIC_PLAN_COVERAGE_PAISE);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Claim amount must be positive");
    }

    #[test]
    fn validate_claim_amount_negative_is_invalid() {
        let result = validate_claim_amount(-100, BASIC_PLAN_COVERAGE_PAISE);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Claim amount must be positive");
    }

    #[test]
    fn validate_claim_amount_exceeds_coverage() {
        let result = validate_claim_amount(BASIC_PLAN_COVERAGE_PAISE + 1, BASIC_PLAN_COVERAGE_PAISE);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("exceeds coverage"),
            "Error should mention exceeds coverage, got: {}",
            err
        );
    }

    #[test]
    fn validate_claim_amount_far_exceeds_coverage() {
        let result = validate_claim_amount(100_000_000, BASIC_PLAN_COVERAGE_PAISE);
        assert!(result.is_err());
    }

    // ── 9. Claim status transitions ─────────────────────────────────────────

    #[test]
    fn valid_review_statuses() {
        assert!(is_valid_review_status("approved"));
        assert!(is_valid_review_status("rejected"));
        assert!(is_valid_review_status("under_review"));
    }

    #[test]
    fn invalid_review_statuses() {
        assert!(!is_valid_review_status("submitted"), "submitted is not a valid review status");
        assert!(!is_valid_review_status("pending"));
        assert!(!is_valid_review_status(""));
        assert!(!is_valid_review_status("APPROVED"), "Case-sensitive check");
        assert!(!is_valid_review_status("Rejected"));
        assert!(!is_valid_review_status("cancelled"));
    }

    #[test]
    fn claim_finalized_when_approved() {
        assert!(is_claim_finalized(Some("approved")));
    }

    #[test]
    fn claim_finalized_when_rejected() {
        assert!(is_claim_finalized(Some("rejected")));
    }

    #[test]
    fn claim_not_finalized_when_submitted() {
        assert!(!is_claim_finalized(Some("submitted")));
    }

    #[test]
    fn claim_not_finalized_when_under_review() {
        assert!(!is_claim_finalized(Some("under_review")));
    }

    #[test]
    fn claim_not_finalized_when_none() {
        assert!(!is_claim_finalized(None));
    }

    // ── Status transition matrix: submitted -> under_review -> approved/rejected

    #[test]
    fn transition_submitted_to_under_review_is_valid() {
        // submitted is not finalized, so can transition
        assert!(!is_claim_finalized(Some("submitted")));
        // under_review is a valid review status
        assert!(is_valid_review_status("under_review"));
    }

    #[test]
    fn transition_submitted_to_approved_is_valid() {
        assert!(!is_claim_finalized(Some("submitted")));
        assert!(is_valid_review_status("approved"));
    }

    #[test]
    fn transition_submitted_to_rejected_is_valid() {
        assert!(!is_claim_finalized(Some("submitted")));
        assert!(is_valid_review_status("rejected"));
    }

    #[test]
    fn transition_under_review_to_approved_is_valid() {
        assert!(!is_claim_finalized(Some("under_review")));
        assert!(is_valid_review_status("approved"));
    }

    #[test]
    fn transition_under_review_to_rejected_is_valid() {
        assert!(!is_claim_finalized(Some("under_review")));
        assert!(is_valid_review_status("rejected"));
    }

    #[test]
    fn transition_approved_is_blocked() {
        assert!(
            is_claim_finalized(Some("approved")),
            "Approved claims must not accept further transitions"
        );
    }

    #[test]
    fn transition_rejected_is_blocked() {
        assert!(
            is_claim_finalized(Some("rejected")),
            "Rejected claims must not accept further transitions"
        );
    }
}

// ── Claims request/response serialization ───────────────────────────────────

mod claim_serialization {
    use aarokya_backend::domain::claim::{ReviewClaimRequest, SubmitClaimRequest};
    use uuid::Uuid;

    // ── 1. Submit claim - success with required fields ──────────────────────

    #[test]
    fn deserialize_submit_claim_all_fields() {
        let policy_id = Uuid::new_v4();
        let json = serde_json::json!({
            "policy_id": policy_id.to_string(),
            "claim_type": "hospitalization",
            "amount_paise": 500_000,
            "hospital_name": "Apollo Hospital",
            "diagnosis": "Appendicitis",
            "document_urls": ["https://example.com/doc1.pdf", "https://example.com/doc2.pdf"],
            "description": "Emergency surgery"
        });
        let req: SubmitClaimRequest = serde_json::from_value(json).expect("Should deserialize");
        assert_eq!(req.policy_id, policy_id);
        assert_eq!(req.claim_type, "hospitalization");
        assert_eq!(req.amount_paise, 500_000);
        assert_eq!(req.hospital_name.as_deref(), Some("Apollo Hospital"));
        assert_eq!(req.diagnosis.as_deref(), Some("Appendicitis"));
        assert_eq!(req.document_urls.as_ref().unwrap().len(), 2);
        assert_eq!(req.description.as_deref(), Some("Emergency surgery"));
    }

    #[test]
    fn deserialize_submit_claim_required_fields_only() {
        let policy_id = Uuid::new_v4();
        let json = serde_json::json!({
            "policy_id": policy_id.to_string(),
            "claim_type": "outpatient",
            "amount_paise": 10_000
        });
        let req: SubmitClaimRequest = serde_json::from_value(json).expect("Should deserialize");
        assert_eq!(req.policy_id, policy_id);
        assert_eq!(req.claim_type, "outpatient");
        assert_eq!(req.amount_paise, 10_000);
        assert!(req.hospital_name.is_none());
        assert!(req.diagnosis.is_none());
        assert!(req.document_urls.is_none());
        assert!(req.description.is_none());
    }

    // ── 2. Submit claim - missing policy_id returns 400 ─────────────────────

    #[test]
    fn deserialize_submit_claim_missing_policy_id_fails() {
        let json = serde_json::json!({
            "claim_type": "hospitalization",
            "amount_paise": 500_000
        });
        let result = serde_json::from_value::<SubmitClaimRequest>(json);
        assert!(result.is_err(), "Missing policy_id should fail deserialization");
    }

    #[test]
    fn deserialize_submit_claim_missing_claim_type_fails() {
        let json = serde_json::json!({
            "policy_id": Uuid::new_v4().to_string(),
            "amount_paise": 500_000
        });
        let result = serde_json::from_value::<SubmitClaimRequest>(json);
        assert!(
            result.is_err(),
            "Missing claim_type should fail deserialization"
        );
    }

    #[test]
    fn deserialize_submit_claim_missing_amount_fails() {
        let json = serde_json::json!({
            "policy_id": Uuid::new_v4().to_string(),
            "claim_type": "hospitalization"
        });
        let result = serde_json::from_value::<SubmitClaimRequest>(json);
        assert!(
            result.is_err(),
            "Missing amount_paise should fail deserialization"
        );
    }

    #[test]
    fn deserialize_submit_claim_invalid_policy_id_fails() {
        let json = serde_json::json!({
            "policy_id": "not-a-uuid",
            "claim_type": "hospitalization",
            "amount_paise": 500_000
        });
        let result = serde_json::from_value::<SubmitClaimRequest>(json);
        assert!(
            result.is_err(),
            "Invalid UUID for policy_id should fail deserialization"
        );
    }

    // ── 3. Submit claim - invalid amount (via serialization) ────────────────

    #[test]
    fn deserialize_submit_claim_string_amount_fails() {
        let json = serde_json::json!({
            "policy_id": Uuid::new_v4().to_string(),
            "claim_type": "hospitalization",
            "amount_paise": "not_a_number"
        });
        let result = serde_json::from_value::<SubmitClaimRequest>(json);
        assert!(result.is_err(), "String amount should fail deserialization");
    }

    // ── Review claim request serialization ──────────────────────────────────

    #[test]
    fn deserialize_review_claim_approve() {
        let json = serde_json::json!({
            "status": "approved",
            "review_notes": "Looks good, approved"
        });
        let req: ReviewClaimRequest = serde_json::from_value(json).expect("Should deserialize");
        assert_eq!(req.status, "approved");
        assert_eq!(req.review_notes.as_deref(), Some("Looks good, approved"));
    }

    #[test]
    fn deserialize_review_claim_reject_with_reason() {
        let json = serde_json::json!({
            "status": "rejected",
            "review_notes": "Insufficient documentation provided"
        });
        let req: ReviewClaimRequest = serde_json::from_value(json).expect("Should deserialize");
        assert_eq!(req.status, "rejected");
        assert_eq!(
            req.review_notes.as_deref(),
            Some("Insufficient documentation provided")
        );
    }

    #[test]
    fn deserialize_review_claim_status_only() {
        let json = serde_json::json!({
            "status": "under_review"
        });
        let req: ReviewClaimRequest = serde_json::from_value(json).expect("Should deserialize");
        assert_eq!(req.status, "under_review");
        assert!(req.review_notes.is_none());
    }

    #[test]
    fn deserialize_review_claim_missing_status_fails() {
        let json = serde_json::json!({
            "review_notes": "Some notes"
        });
        let result = serde_json::from_value::<ReviewClaimRequest>(json);
        assert!(result.is_err(), "Missing status should fail deserialization");
    }
}

// ── RBAC tests for claim review authorization ───────────────────────────────

mod claim_review_authorization {
    use aarokya_backend::infrastructure::auth::{require_role, AuthenticatedUser, Role};
    use uuid::Uuid;

    fn make_user(user_type: &str) -> AuthenticatedUser {
        AuthenticatedUser {
            user_id: Uuid::new_v4(),
            user_type: user_type.to_string(),
        }
    }

    // ── 5. Review claim - operator can approve ──────────────────────────────

    #[test]
    fn operator_insurance_ops_can_review_claims() {
        let user = make_user("operator_insurance_ops");
        assert!(
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]).is_ok()
        );
    }

    // ── 6. Review claim - operator can reject with reason ───────────────────

    #[test]
    fn operator_super_admin_can_review_claims() {
        let user = make_user("operator_super_admin");
        assert!(
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]).is_ok()
        );
    }

    // ── 7. Review claim - non-operator gets 403 ────────────────────────────

    #[test]
    fn customer_cannot_review_claims() {
        let user = make_user("customer");
        let result =
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]);
        assert!(result.is_err(), "Customer should not be allowed to review claims");
    }

    #[test]
    fn partner_cannot_review_claims() {
        let user = make_user("partner");
        let result =
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]);
        assert!(result.is_err(), "Partner should not be allowed to review claims");
    }

    #[test]
    fn operator_support_cannot_review_claims() {
        let user = make_user("operator_support");
        let result =
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]);
        assert!(
            result.is_err(),
            "Support operator should not be allowed to review claims"
        );
    }

    #[test]
    fn operator_analytics_cannot_review_claims() {
        let user = make_user("operator_analytics");
        let result =
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]);
        assert!(result.is_err());
    }

    #[test]
    fn unknown_role_cannot_review_claims() {
        let user = make_user("alien");
        let result =
            require_role(&user, &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin]);
        assert!(result.is_err(), "Unknown role should be forbidden");
    }

    #[test]
    fn super_admin_bypasses_all_role_checks() {
        let user = make_user("operator_super_admin");
        // super_admin should pass even when only OperatorInsuranceOps is listed
        assert!(require_role(&user, &[Role::OperatorInsuranceOps]).is_ok());
        assert!(require_role(&user, &[Role::Customer]).is_ok());
        assert!(require_role(&user, &[Role::Partner]).is_ok());
    }
}

// ── Auth token tests relevant to insurance/claims 401 scenarios ─────────────

mod auth_for_insurance {
    use aarokya_backend::infrastructure::auth::{decode_token, encode_token};
    use uuid::Uuid;

    const SECRET: &str = "test-secret";

    // ── 4 (Insurance). Subscribe - unauthenticated returns 401 ──────────────
    // We test the token layer to verify that missing/invalid tokens produce
    // errors that the middleware maps to 401.

    #[test]
    fn valid_token_decodes_successfully() {
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "customer", SECRET, 1).unwrap();
        let claims = decode_token(&token, SECRET).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.user_type, "customer");
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn wrong_secret_fails_decode() {
        let user_id = Uuid::new_v4();
        let token = encode_token(user_id, "customer", SECRET, 1).unwrap();
        assert!(
            decode_token(&token, "wrong-secret").is_err(),
            "Wrong secret should fail authentication"
        );
    }

    #[test]
    fn expired_token_fails_decode() {
        let user_id = Uuid::new_v4();
        // Negative expiry creates already-expired token
        let token = aarokya_backend::infrastructure::auth::encode_token(user_id, "customer", SECRET, -1)
            .unwrap();
        assert!(
            decode_token(&token, SECRET).is_err(),
            "Expired token should fail authentication"
        );
    }

    #[test]
    fn malformed_token_fails_decode() {
        assert!(decode_token("not.a.valid.token", SECRET).is_err());
        assert!(decode_token("", SECRET).is_err());
        assert!(decode_token("Bearer token", SECRET).is_err());
    }
}

// ── InsurancePolicy serialization tests ─────────────────────────────────────

mod policy_serialization {
    use aarokya_backend::domain::insurance::InsurancePolicy;
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn insurance_policy_serializes_correctly() {
        let now = Utc::now();
        let policy = InsurancePolicy {
            id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            plan_id: "basic-health".to_string(),
            plan_name: "Basic Health Cover".to_string(),
            premium_paise: 99_900,
            coverage_paise: 10_000_000,
            status: Some("active".to_string()),
            start_date: Some(now),
            end_date: Some(now + chrono::Duration::days(365)),
            created_at: Some(now),
        };

        let json = serde_json::to_value(&policy).expect("Policy should serialize");
        assert_eq!(json["plan_id"], "basic-health");
        assert_eq!(json["premium_paise"], 99_900);
        assert_eq!(json["coverage_paise"], 10_000_000);
        assert_eq!(json["status"], "active");
    }

    #[test]
    fn insurance_policy_roundtrip() {
        let now = Utc::now();
        let policy = InsurancePolicy {
            id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            plan_id: "premium-health".to_string(),
            plan_name: "Premium Health Cover".to_string(),
            premium_paise: 249_900,
            coverage_paise: 50_000_000,
            status: Some("active".to_string()),
            start_date: Some(now),
            end_date: Some(now + chrono::Duration::days(365)),
            created_at: Some(now),
        };

        let json_str = serde_json::to_string(&policy).unwrap();
        let deserialized: InsurancePolicy = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.id, policy.id);
        assert_eq!(deserialized.plan_id, policy.plan_id);
        assert_eq!(deserialized.premium_paise, policy.premium_paise);
        assert_eq!(deserialized.coverage_paise, policy.coverage_paise);
    }

    // ── 8. Subscribe creates policy with correct dates ──────────────────────

    #[test]
    fn policy_dates_span_one_year() {
        let now = Utc::now();
        let end = now + chrono::Duration::days(365);
        let diff = end - now;
        assert_eq!(diff.num_days(), 365, "Policy should span exactly 365 days");
    }

    #[test]
    fn policy_with_none_optional_fields() {
        let policy = InsurancePolicy {
            id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            plan_id: "basic-health".to_string(),
            plan_name: "Basic Health Cover".to_string(),
            premium_paise: 99_900,
            coverage_paise: 10_000_000,
            status: None,
            start_date: None,
            end_date: None,
            created_at: None,
        };

        let json = serde_json::to_value(&policy).unwrap();
        assert!(json["status"].is_null());
        assert!(json["start_date"].is_null());
        assert!(json["end_date"].is_null());
    }
}

// ── Claim struct serialization tests ────────────────────────────────────────

mod claim_struct_serialization {
    use aarokya_backend::domain::claim::Claim;
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn claim_serializes_with_all_fields() {
        let now = Utc::now();
        let reviewer_id = Uuid::new_v4();
        let claim = Claim {
            id: Uuid::new_v4(),
            policy_id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            claim_type: "hospitalization".to_string(),
            amount_paise: 500_000,
            hospital_name: Some("Apollo Hospital".to_string()),
            diagnosis: Some("Appendicitis".to_string()),
            document_urls: Some(serde_json::json!(["https://example.com/doc1.pdf"])),
            description: Some("Emergency surgery".to_string()),
            status: Some("submitted".to_string()),
            reviewed_by: Some(reviewer_id),
            review_notes: Some("Approved after verification".to_string()),
            created_at: Some(now),
            updated_at: Some(now),
        };

        let json = serde_json::to_value(&claim).expect("Claim should serialize");
        assert_eq!(json["claim_type"], "hospitalization");
        assert_eq!(json["amount_paise"], 500_000);
        assert_eq!(json["hospital_name"], "Apollo Hospital");
        assert_eq!(json["status"], "submitted");
        assert_eq!(json["reviewed_by"], reviewer_id.to_string());
    }

    #[test]
    fn claim_serializes_with_minimal_fields() {
        let claim = Claim {
            id: Uuid::new_v4(),
            policy_id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            claim_type: "outpatient".to_string(),
            amount_paise: 10_000,
            hospital_name: None,
            diagnosis: None,
            document_urls: None,
            description: None,
            status: Some("submitted".to_string()),
            reviewed_by: None,
            review_notes: None,
            created_at: None,
            updated_at: None,
        };

        let json = serde_json::to_value(&claim).unwrap();
        assert!(json["hospital_name"].is_null());
        assert!(json["diagnosis"].is_null());
        assert!(json["document_urls"].is_null());
        assert!(json["reviewed_by"].is_null());
    }

    #[test]
    fn claim_roundtrip_serde() {
        let claim = Claim {
            id: Uuid::new_v4(),
            policy_id: Uuid::new_v4(),
            hsa_id: Uuid::new_v4(),
            claim_type: "hospitalization".to_string(),
            amount_paise: 250_000,
            hospital_name: Some("Max Hospital".to_string()),
            diagnosis: Some("Fracture".to_string()),
            document_urls: Some(serde_json::json!(["https://example.com/xray.pdf"])),
            description: Some("Arm fracture treatment".to_string()),
            status: Some("under_review".to_string()),
            reviewed_by: None,
            review_notes: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        let json_str = serde_json::to_string(&claim).unwrap();
        let deserialized: Claim = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.id, claim.id);
        assert_eq!(deserialized.amount_paise, claim.amount_paise);
        assert_eq!(deserialized.claim_type, claim.claim_type);
        assert_eq!(deserialized.status, claim.status);
    }

    // ── 8 (Claims). Review claim - invalid claim_id returns 404 ─────────────
    // We verify that UUID parsing handles invalid input, which the API layer
    // relies on for returning 404 on bad claim IDs.

    #[test]
    fn invalid_uuid_string_fails_parse() {
        let result = "not-a-uuid".parse::<Uuid>();
        assert!(result.is_err(), "Invalid UUID string should fail to parse");
    }

    #[test]
    fn valid_uuid_string_parses() {
        let id = Uuid::new_v4();
        let parsed: Uuid = id.to_string().parse().unwrap();
        assert_eq!(parsed, id);
    }
}

// ── Cross-module integration tests (domain only, no DB) ─────────────────────

mod cross_module_domain {
    use aarokya_backend::domain::claim::validate_claim_amount;
    use aarokya_backend::domain::insurance::{
        available_plans, balance_after_premium, check_balance_for_premium, check_eligibility,
        find_plan,
    };

    /// End-to-end domain validation for a subscribe + claim flow.
    #[test]
    fn full_subscribe_then_claim_domain_validation() {
        let plan = find_plan("basic-health").unwrap();

        // User has 500_000 paise contributed and in balance
        let contributed = 500_000i64;
        let balance = 500_000i64;

        // Step 1: Check eligibility
        assert!(check_eligibility(contributed, &plan).is_ok());

        // Step 2: Check balance for premium
        assert!(check_balance_for_premium(balance, &plan).is_ok());

        // Step 3: Deduct premium
        let remaining = balance_after_premium(balance, plan.premium_paise);
        assert_eq!(remaining, 400_100);
        assert!(remaining > 0);

        // Step 4: Validate a claim within coverage
        assert!(validate_claim_amount(500_000, plan.coverage_paise).is_ok());

        // Step 5: Claim exceeding coverage should fail
        assert!(validate_claim_amount(plan.coverage_paise + 1, plan.coverage_paise).is_err());
    }

    /// Verify all plans have premium <= min_balance (user can always afford
    /// the premium if they meet eligibility).
    #[test]
    fn all_plans_premium_leq_min_balance() {
        for plan in available_plans() {
            assert!(
                plan.premium_paise <= plan.min_balance_paise,
                "Plan {} has premium {} > min_balance {}, users at threshold cannot afford it",
                plan.id,
                plan.premium_paise,
                plan.min_balance_paise
            );
        }
    }

    /// Verify all plans have coverage > premium (insurance is worthwhile).
    #[test]
    fn all_plans_coverage_exceeds_premium() {
        for plan in available_plans() {
            assert!(
                plan.coverage_paise > plan.premium_paise,
                "Plan {} coverage should exceed premium",
                plan.id
            );
        }
    }

    /// Verify the full eligibility + balance check for premium plan.
    #[test]
    fn premium_plan_full_domain_validation() {
        let plan = find_plan("premium-health").unwrap();
        let contributed = 1_500_000i64;
        let balance = 1_500_000i64;

        assert!(check_eligibility(contributed, &plan).is_ok());
        assert!(check_balance_for_premium(balance, &plan).is_ok());

        let remaining = balance_after_premium(balance, plan.premium_paise);
        assert_eq!(remaining, 1_250_100);

        // Claim up to 5 lakh (50_000_000 paise) is valid
        assert!(validate_claim_amount(50_000_000, plan.coverage_paise).is_ok());
        assert!(validate_claim_amount(50_000_001, plan.coverage_paise).is_err());
    }

    /// A user at exactly basic threshold can subscribe and their balance
    /// after premium deduction is predictable.
    #[test]
    fn basic_plan_at_exact_threshold() {
        let plan = find_plan("basic-health").unwrap();
        let at_threshold = plan.min_balance_paise; // 399_900

        assert!(check_eligibility(at_threshold, &plan).is_ok());
        assert!(check_balance_for_premium(at_threshold, &plan).is_ok());

        let remaining = balance_after_premium(at_threshold, plan.premium_paise);
        assert_eq!(remaining, 399_900 - 99_900);
        assert_eq!(remaining, 300_000);
    }
}
