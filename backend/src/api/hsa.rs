use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::hsa::{CreateHsaRequest, HsaDashboard, HealthSavingsAccount};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

pub async fn create_hsa(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateHsaRequest>,
) -> Result<HttpResponse, AppError> {
    if auth.user_type != "customer" {
        return Err(AppError::Forbidden(
            "Only customers can create HSA accounts".to_string(),
        ));
    }

    // Check if user already has an HSA
    let existing = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(
            "User already has an HSA account".to_string(),
        ));
    }

    let id = Uuid::new_v4();
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        r#"INSERT INTO health_savings_accounts (id, user_id, abha_id, balance_paise, total_contributed_paise, insurance_eligible, status)
           VALUES ($1, $2, $3, 0, 0, false, 'active')
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&body.abha_id)
    .fetch_one(pool.get_ref())
    .await?;

    // Also update the user's abha_id
    sqlx::query("UPDATE users SET abha_id = $1 WHERE id = $2")
        .bind(&body.abha_id)
        .bind(auth.user_id)
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Created().json(hsa))
}

pub async fn get_hsa(
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

    Ok(HttpResponse::Ok().json(hsa))
}

const BASIC_INSURANCE_THRESHOLD: i64 = 399_900; // 3999 INR in paise
const PREMIUM_INSURANCE_THRESHOLD: i64 = 1_000_000; // 10000 INR in paise

pub async fn get_dashboard(
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

    let contribution_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM contributions WHERE hsa_id = $1 AND status = 'completed'")
            .bind(hsa.id)
            .fetch_one(pool.get_ref())
            .await?;

    let basic_progress =
        (hsa.total_contributed_paise as f64 / BASIC_INSURANCE_THRESHOLD as f64).min(1.0);
    let premium_progress =
        (hsa.total_contributed_paise as f64 / PREMIUM_INSURANCE_THRESHOLD as f64).min(1.0);

    let dashboard = HsaDashboard {
        balance_paise: hsa.balance_paise,
        total_contributed_paise: hsa.total_contributed_paise,
        insurance_eligible: hsa.insurance_eligible.unwrap_or(false),
        basic_insurance_progress: basic_progress,
        premium_insurance_progress: premium_progress,
        contribution_count: contribution_count.0,
    };

    Ok(HttpResponse::Ok().json(dashboard))
}
