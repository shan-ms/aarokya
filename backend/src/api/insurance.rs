use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::claim::{Claim, ReviewClaimRequest, SubmitClaimRequest};
use crate::domain::hsa::HealthSavingsAccount;
use crate::domain::insurance::{InsurancePlan, InsurancePolicy, SubscribeRequest};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

fn get_available_plans() -> Vec<InsurancePlan> {
    vec![
        InsurancePlan {
            id: "basic-health".to_string(),
            name: "Basic Health Cover".to_string(),
            description: "Basic health insurance covering hospitalization up to Rs 1 lakh"
                .to_string(),
            premium_paise: 99_900,    // Rs 999
            coverage_paise: 10_000_000, // Rs 1 lakh
            min_balance_paise: 399_900, // Rs 3999 total contributions needed
            plan_type: "basic".to_string(),
        },
        InsurancePlan {
            id: "premium-health".to_string(),
            name: "Premium Health Cover".to_string(),
            description: "Comprehensive health insurance covering hospitalization up to Rs 5 lakh"
                .to_string(),
            premium_paise: 249_900,     // Rs 2499
            coverage_paise: 50_000_000,  // Rs 5 lakh
            min_balance_paise: 1_000_000, // Rs 10000 total contributions needed
            plan_type: "premium".to_string(),
        },
        InsurancePlan {
            id: "accident-cover".to_string(),
            name: "Personal Accident Cover".to_string(),
            description: "Accident insurance covering accidental death and disability up to Rs 2 lakh"
                .to_string(),
            premium_paise: 49_900,      // Rs 499
            coverage_paise: 20_000_000,  // Rs 2 lakh
            min_balance_paise: 199_900,  // Rs 1999 total contributions needed
            plan_type: "accident".to_string(),
        },
    ]
}

pub async fn list_plans() -> Result<HttpResponse, AppError> {
    Ok(HttpResponse::Ok().json(get_available_plans()))
}

pub async fn subscribe(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<SubscribeRequest>,
) -> Result<HttpResponse, AppError> {
    let plans = get_available_plans();
    let plan = plans
        .iter()
        .find(|p| p.id == body.plan_id)
        .ok_or_else(|| AppError::NotFound(format!("Plan '{}' not found", body.plan_id)))?;

    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    // Check eligibility based on total contributions
    if hsa.total_contributed_paise < plan.min_balance_paise {
        return Err(AppError::BadRequest(format!(
            "Insufficient contributions. Need {} paise total contributions, have {} paise",
            plan.min_balance_paise, hsa.total_contributed_paise
        )));
    }

    // Check balance for premium deduction
    if hsa.balance_paise < plan.premium_paise {
        return Err(AppError::BadRequest(format!(
            "Insufficient balance. Need {} paise, have {} paise",
            plan.premium_paise, hsa.balance_paise
        )));
    }

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

    // Check claim amount doesn't exceed coverage
    if body.amount_paise > policy.coverage_paise {
        return Err(AppError::BadRequest(format!(
            "Claim amount {} exceeds coverage {}",
            body.amount_paise, policy.coverage_paise
        )));
    }

    let claim_id = Uuid::new_v4();
    let claim = sqlx::query_as::<_, Claim>(
        r#"INSERT INTO claims (id, policy_id, hsa_id, claim_type, amount_paise, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
           RETURNING *"#,
    )
    .bind(claim_id)
    .bind(body.policy_id)
    .bind(hsa.id)
    .bind(&body.claim_type)
    .bind(body.amount_paise)
    .bind(&body.description)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(claim))
}

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

pub async fn review_claim(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<ReviewClaimRequest>,
) -> Result<HttpResponse, AppError> {
    if auth.user_type != "operator" {
        return Err(AppError::Forbidden(
            "Only operators can review claims".to_string(),
        ));
    }

    let claim_id = path.into_inner();

    let valid_statuses = ["approved", "rejected", "under_review"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid status '{}'. Must be one of: {}",
            body.status,
            valid_statuses.join(", ")
        )));
    }

    let claim = sqlx::query_as::<_, Claim>(
        "SELECT * FROM claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Claim not found".to_string()))?;

    if claim.status.as_deref() == Some("approved") || claim.status.as_deref() == Some("rejected") {
        return Err(AppError::Conflict(
            "Claim has already been reviewed".to_string(),
        ));
    }

    // If approved, credit the HSA
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

    let updated_claim = sqlx::query_as::<_, Claim>(
        "SELECT * FROM claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(updated_claim))
}
