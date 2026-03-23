use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::claim::{
    is_claim_finalized, is_valid_review_status, validate_claim_amount, Claim, ReviewClaimRequest,
    SubmitClaimRequest,
};
use crate::domain::hsa::HealthSavingsAccount;
use crate::domain::insurance::{
    available_plans, check_balance_for_premium, check_eligibility, find_plan, InsurancePolicy,
    SubscribeRequest,
};
use crate::infrastructure::auth::{require_role, AuthenticatedUser, Role};
use crate::infrastructure::error::AppError;

/// GET /api/v1/insurance/plans
/// Returns the list of available insurance plans (hardcoded seed data).
pub async fn list_plans() -> Result<HttpResponse, AppError> {
    Ok(HttpResponse::Ok().json(available_plans()))
}

/// POST /api/v1/insurance/subscribe
/// Subscribe to an insurance plan. Validates eligibility based on HSA total
/// contributions and balance, deducts the premium, and creates a policy record.
pub async fn subscribe(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<SubscribeRequest>,
) -> Result<HttpResponse, AppError> {
    let plan = find_plan(&body.plan_id)
        .ok_or_else(|| AppError::NotFound(format!("Plan '{}' not found", body.plan_id)))?;

    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    // Check eligibility based on total contributions
    check_eligibility(hsa.total_contributed_paise, &plan).map_err(AppError::BadRequest)?;

    // Check balance for premium deduction
    check_balance_for_premium(hsa.balance_paise, &plan).map_err(AppError::BadRequest)?;

    // Check for existing active policy of same plan
    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM insurance_policies WHERE hsa_id = $1 AND plan_id = $2 AND status = 'active'",
    )
    .bind(hsa.id)
    .bind(&plan.id)
    .fetch_one(pool.get_ref())
    .await?;

    if existing > 0 {
        return Err(AppError::Conflict(
            "Already subscribed to this plan".to_string(),
        ));
    }

    // Transaction: deduct premium and create policy
    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE health_savings_accounts SET balance_paise = balance_paise - $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(plan.premium_paise)
    .bind(hsa.id)
    .execute(&mut *tx)
    .await?;

    let policy_id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let end_date = now + chrono::Duration::days(365);

    let policy = sqlx::query_as::<_, InsurancePolicy>(
        r#"INSERT INTO insurance_policies (id, hsa_id, plan_id, plan_name, premium_paise, coverage_paise, status, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
           RETURNING *"#,
    )
    .bind(policy_id)
    .bind(hsa.id)
    .bind(&plan.id)
    .bind(&plan.name)
    .bind(plan.premium_paise)
    .bind(plan.coverage_paise)
    .bind(now)
    .bind(end_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(HttpResponse::Created().json(policy))
}

/// GET /api/v1/insurance/policies
/// List the authenticated user's insurance policies.
pub async fn list_policies(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    let policies = sqlx::query_as::<_, InsurancePolicy>(
        "SELECT * FROM insurance_policies WHERE hsa_id = $1 ORDER BY created_at DESC",
    )
    .bind(hsa.id)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(policies))
}

/// POST /api/v1/claims
/// Submit a new insurance claim with metadata (hospital_name, diagnosis, amount,
/// document_urls). The claim is created in "submitted" status.
pub async fn submit_claim(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<SubmitClaimRequest>,
) -> Result<HttpResponse, AppError> {
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    // Verify policy belongs to user and is active
    let policy = sqlx::query_as::<_, InsurancePolicy>(
        "SELECT * FROM insurance_policies WHERE id = $1 AND hsa_id = $2 AND status = 'active'",
    )
    .bind(body.policy_id)
    .bind(hsa.id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Active policy not found".to_string()))?;

    // Validate claim amount using domain logic
    validate_claim_amount(body.amount_paise, policy.coverage_paise)
        .map_err(AppError::BadRequest)?;

    let claim_id = Uuid::new_v4();
    let document_urls_json = body
        .document_urls
        .as_ref()
        .map(|urls| serde_json::json!(urls));
    let claim = sqlx::query_as::<_, Claim>(
        r#"INSERT INTO claims (id, policy_id, hsa_id, claim_type, amount_paise, hospital_name, diagnosis, document_urls, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
           RETURNING *"#,
    )
    .bind(claim_id)
    .bind(body.policy_id)
    .bind(hsa.id)
    .bind(&body.claim_type)
    .bind(body.amount_paise)
    .bind(&body.hospital_name)
    .bind(&body.diagnosis)
    .bind(&document_urls_json)
    .bind(&body.description)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(claim))
}

/// GET /api/v1/claims
/// List all claims belonging to the authenticated user.
pub async fn list_claims(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    let claims = sqlx::query_as::<_, Claim>(
        "SELECT * FROM claims WHERE hsa_id = $1 ORDER BY created_at DESC",
    )
    .bind(hsa.id)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(claims))
}

/// PATCH /api/v1/claims/{id}/review
/// Review a claim (approve, reject, or set to under_review). Only operators
/// (operator_insurance_ops or operator_super_admin) may perform this action.
/// Approving a claim credits the claim amount to the user's HSA.
pub async fn review_claim(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<ReviewClaimRequest>,
) -> Result<HttpResponse, AppError> {
    // RBAC: only insurance ops and super admin can review claims
    require_role(
        &auth,
        &[Role::OperatorInsuranceOps, Role::OperatorSuperAdmin],
    )?;

    let claim_id = path.into_inner();

    if !is_valid_review_status(&body.status) {
        return Err(AppError::Validation(format!(
            "Invalid status '{}'. Must be one of: approved, rejected, under_review",
            body.status,
        )));
    }

    let claim = sqlx::query_as::<_, Claim>("SELECT * FROM claims WHERE id = $1")
        .bind(claim_id)
        .fetch_optional(pool.get_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Claim not found".to_string()))?;

    if is_claim_finalized(claim.status.as_deref()) {
        return Err(AppError::Conflict(
            "Claim has already been reviewed".to_string(),
        ));
    }

    // If approved, credit the HSA inside a transaction
    if body.status == "approved" {
        let mut tx = pool.begin().await?;

        sqlx::query(
            "UPDATE claims SET status = $1, reviewed_by = $2, review_notes = $3, updated_at = NOW() WHERE id = $4",
        )
        .bind(&body.status)
        .bind(auth.user_id)
        .bind(&body.review_notes)
        .bind(claim_id)
        .execute(&mut *tx)
        .await?;

        // Credit claim amount to HSA
        sqlx::query(
            "UPDATE health_savings_accounts SET balance_paise = balance_paise + $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(claim.amount_paise)
        .bind(claim.hsa_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
    } else {
        sqlx::query(
            "UPDATE claims SET status = $1, reviewed_by = $2, review_notes = $3, updated_at = NOW() WHERE id = $4",
        )
        .bind(&body.status)
        .bind(auth.user_id)
        .bind(&body.review_notes)
        .bind(claim_id)
        .execute(pool.get_ref())
        .await?;
    }

    let updated_claim = sqlx::query_as::<_, Claim>("SELECT * FROM claims WHERE id = $1")
        .bind(claim_id)
        .fetch_one(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(updated_claim))
}

// ── Integration tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::infrastructure::auth::encode_token;
    use actix_web::{test, web, App};

    /// Helper to build a test app with all insurance/claims routes.
    fn test_app(
        pool: web::Data<PgPool>,
    ) -> App<
        impl actix_web::dev::ServiceFactory<
            actix_web::dev::ServiceRequest,
            Config = (),
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
            InitError = (),
        >,
    > {
        let config = AppConfig {
            database_url: String::new(),
            jwt_secret: "test-secret".to_string(),
            jwt_expiry_hours: 24,
            port: 8080,
            host: "127.0.0.1".to_string(),
        };

        App::new()
            .app_data(pool)
            .app_data(web::Data::new(config))
            .service(
                web::scope("/api/v1")
                    .service(
                        web::scope("/insurance")
                            .route("/plans", web::get().to(list_plans))
                            .route("/subscribe", web::post().to(subscribe))
                            .route("/policies", web::get().to(list_policies)),
                    )
                    .service(
                        web::scope("/claims")
                            .route("", web::post().to(submit_claim))
                            .route("", web::get().to(list_claims))
                            .route("/{id}/review", web::patch().to(review_claim)),
                    ),
            )
    }

    fn auth_header(user_id: uuid::Uuid, user_type: &str) -> String {
        let token = encode_token(user_id, user_type, "test-secret", 1).unwrap();
        format!("Bearer {}", token)
    }

    // ── list_plans tests ─────────────────────────────────────────────────────

    #[actix_rt::test]
    async fn test_list_plans_returns_all_plans() {
        // list_plans doesn't need a DB, but the test app expects Data<PgPool>.
        // We can only run a real integration test when DATABASE_URL is set.
        // For now, test the handler directly without a pool.
        let resp = list_plans().await.unwrap();
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_rt::test]
    async fn test_list_plans_contains_basic_and_premium() {
        let plans = available_plans();
        let ids: Vec<&str> = plans.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"basic-health"));
        assert!(ids.contains(&"premium-health"));
        assert!(ids.contains(&"accident-cover"));
    }

    #[actix_rt::test]
    async fn test_list_plans_basic_at_3999_inr() {
        let plan = find_plan("basic-health").unwrap();
        assert_eq!(plan.min_balance_paise, 399_900); // 3999 INR
    }

    #[actix_rt::test]
    async fn test_list_plans_premium_at_10000_inr() {
        let plan = find_plan("premium-health").unwrap();
        assert_eq!(plan.min_balance_paise, 1_000_000); // 10000 INR
    }

    // ── Integration tests that need a database ───────────────────────────────
    // These tests require DATABASE_URL to be set in the environment.
    // They are gated behind the `#[ignore]` attribute so `cargo test` works
    // without a database but `cargo test -- --ignored` runs them.

    async fn setup_db() -> Option<web::Data<PgPool>> {
        let url = match std::env::var("DATABASE_URL") {
            Ok(u) => u,
            Err(_) => return None,
        };
        let pool = crate::infrastructure::database::create_pool(&url)
            .await
            .ok()?;
        sqlx::migrate!("./migrations").run(&pool).await.ok()?;
        Some(web::Data::new(pool))
    }

    /// Create a test user + HSA with the given balances. Returns (user_id, hsa_id).
    async fn seed_user_hsa(
        pool: &PgPool,
        balance_paise: i64,
        total_contributed_paise: i64,
    ) -> (Uuid, Uuid) {
        let user_id = Uuid::new_v4();
        let hsa_id = Uuid::new_v4();
        let phone = format!("+91{}", &Uuid::new_v4().to_string()[..10]);

        sqlx::query("INSERT INTO users (id, phone, user_type) VALUES ($1, $2, 'customer')")
            .bind(user_id)
            .bind(&phone)
            .execute(pool)
            .await
            .unwrap();

        sqlx::query(
            r#"INSERT INTO health_savings_accounts (id, user_id, abha_id, balance_paise, total_contributed_paise, status)
               VALUES ($1, $2, $3, $4, $5, 'active')"#,
        )
        .bind(hsa_id)
        .bind(user_id)
        .bind(format!("ABHA-{}", &Uuid::new_v4().to_string()[..8]))
        .bind(balance_paise)
        .bind(total_contributed_paise)
        .execute(pool)
        .await
        .unwrap();

        (user_id, hsa_id)
    }

    /// Create an operator user for review tests. Returns user_id.
    async fn seed_operator(pool: &PgPool) -> Uuid {
        let user_id = Uuid::new_v4();
        let phone = format!("+91{}", &Uuid::new_v4().to_string()[..10]);
        sqlx::query(
            "INSERT INTO users (id, phone, user_type) VALUES ($1, $2, 'operator_insurance_ops')",
        )
        .bind(user_id)
        .bind(&phone)
        .execute(pool)
        .await
        .unwrap();
        user_id
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_basic_plan_success() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_insufficient_contributions() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        // Balance is enough but total contributions are too low
        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 100_000).await;

        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_insufficient_balance() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        // Contributions are enough but balance is too low for premium deduction
        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 50_000, 500_000).await;

        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_invalid_plan() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "nonexistent-plan" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_duplicate_policy() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 1_000_000, 1_000_000).await;

        // First subscription
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);

        // Second subscription to the same plan should conflict
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CONFLICT);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_list_policies_returns_user_policies() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 1_000_000, 1_000_000).await;

        // Subscribe first
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        test::call_service(&app, req).await;

        // List policies
        let req = test::TestRequest::get()
            .uri("/api/v1/insurance/policies")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);

        let body: Vec<serde_json::Value> = test::read_body_json(resp).await;
        assert!(!body.is_empty());
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_submit_claim_success() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        // Subscribe
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        // Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 500_000,
                "hospital_name": "Apollo Hospital",
                "diagnosis": "Appendicitis",
                "document_urls": ["https://example.com/doc1.pdf", "https://example.com/doc2.pdf"],
                "description": "Emergency surgery"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);

        let claim: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(claim["status"], "submitted");
        assert_eq!(claim["hospital_name"], "Apollo Hospital");
        assert_eq!(claim["diagnosis"], "Appendicitis");
        assert_eq!(claim["amount_paise"], 500_000);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_submit_claim_exceeds_coverage() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        // Subscribe to basic (coverage = 10_000_000 = Rs 1 lakh)
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        // Claim exceeds coverage
        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 20_000_000,
                "description": "Too large claim"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_list_claims_returns_user_claims() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        // Subscribe
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        // Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "description": "Test claim"
            }))
            .to_request();
        test::call_service(&app, req).await;

        // List claims
        let req = test::TestRequest::get()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);

        let claims: Vec<serde_json::Value> = test::read_body_json(resp).await;
        assert!(!claims.is_empty());
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_review_claim_approve() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;
        let operator_id = seed_operator(pool.get_ref()).await;

        // Subscribe
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        // Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "hospital_name": "Max Hospital",
                "description": "Surgery"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let claim: serde_json::Value = test::read_body_json(resp).await;
        let claim_id = claim["id"].as_str().unwrap();

        // Review claim as operator
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header((
                "Authorization",
                auth_header(operator_id, "operator_insurance_ops"),
            ))
            .set_json(serde_json::json!({
                "status": "approved",
                "review_notes": "Looks good, approved"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);

        let updated: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(updated["status"], "approved");
        assert_eq!(updated["review_notes"], "Looks good, approved");
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_review_claim_reject() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;
        let operator_id = seed_operator(pool.get_ref()).await;

        // Subscribe + Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "description": "Test"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let claim: serde_json::Value = test::read_body_json(resp).await;
        let claim_id = claim["id"].as_str().unwrap();

        // Reject
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header((
                "Authorization",
                auth_header(operator_id, "operator_insurance_ops"),
            ))
            .set_json(serde_json::json!({
                "status": "rejected",
                "review_notes": "Insufficient documentation"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);

        let updated: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(updated["status"], "rejected");
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_review_claim_customer_forbidden() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;

        // Subscribe + Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "description": "Test"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let claim: serde_json::Value = test::read_body_json(resp).await;
        let claim_id = claim["id"].as_str().unwrap();

        // Customer tries to review -> forbidden
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "status": "approved",
                "review_notes": "Self-approve attempt"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_review_claim_already_finalized() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;
        let operator_id = seed_operator(pool.get_ref()).await;

        // Subscribe + Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "description": "Test"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let claim: serde_json::Value = test::read_body_json(resp).await;
        let claim_id = claim["id"].as_str().unwrap();

        // First review: approve
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header((
                "Authorization",
                auth_header(operator_id, "operator_insurance_ops"),
            ))
            .set_json(serde_json::json!({
                "status": "approved",
                "review_notes": "Approved"
            }))
            .to_request();
        test::call_service(&app, req).await;

        // Second review: should conflict
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header((
                "Authorization",
                auth_header(operator_id, "operator_insurance_ops"),
            ))
            .set_json(serde_json::json!({
                "status": "rejected",
                "review_notes": "Trying again"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CONFLICT);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_review_claim_invalid_status() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 500_000, 500_000).await;
        let operator_id = seed_operator(pool.get_ref()).await;

        // Subscribe + Submit claim
        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "basic-health" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let policy: serde_json::Value = test::read_body_json(resp).await;
        let policy_id = policy["id"].as_str().unwrap();

        let req = test::TestRequest::post()
            .uri("/api/v1/claims")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({
                "policy_id": policy_id,
                "claim_type": "hospitalization",
                "amount_paise": 100_000,
                "description": "Test"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let claim: serde_json::Value = test::read_body_json(resp).await;
        let claim_id = claim["id"].as_str().unwrap();

        // Invalid status
        let req = test::TestRequest::patch()
            .uri(&format!("/api/v1/claims/{}/review", claim_id))
            .insert_header((
                "Authorization",
                auth_header(operator_id, "operator_insurance_ops"),
            ))
            .set_json(serde_json::json!({
                "status": "invalid_status"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_subscribe_premium_plan_success() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let (user_id, _hsa_id) = seed_user_hsa(pool.get_ref(), 1_500_000, 1_500_000).await;

        let req = test::TestRequest::post()
            .uri("/api/v1/insurance/subscribe")
            .insert_header(("Authorization", auth_header(user_id, "customer")))
            .set_json(serde_json::json!({ "plan_id": "premium-health" }))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);

        let policy: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(policy["plan_id"], "premium-health");
        assert_eq!(policy["status"], "active");
    }

    #[actix_rt::test]
    #[ignore]
    async fn test_no_auth_header_returns_unauthorized() {
        let pool = setup_db().await.expect("DATABASE_URL required");
        let app = test::init_service(test_app(pool.clone())).await;

        let req = test::TestRequest::get()
            .uri("/api/v1/insurance/policies")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::UNAUTHORIZED);
    }
}
