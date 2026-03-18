use actix_web::{web, HttpResponse};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::contribution::{
    ContributionListParams, ContributionSummary, CreateContributionRequest, Contribution,
};
use crate::domain::hsa::HealthSavingsAccount;
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

const VALID_SOURCE_TYPES: &[&str] = &[
    "self",
    "employer",
    "platform",
    "family",
    "tip",
    "csr",
    "community",
    "government",
];

const BASIC_INSURANCE_THRESHOLD: i64 = 399_900;

pub async fn create_contribution(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateContributionRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    if !VALID_SOURCE_TYPES.contains(&body.source_type.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid source_type '{}'. Must be one of: {}",
            body.source_type,
            VALID_SOURCE_TYPES.join(", ")
        )));
    }

    // Get user's HSA
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found. Create one first.".to_string()))?;

    // Check idempotency
    let existing = sqlx::query_as::<_, Contribution>(
        "SELECT * FROM contributions WHERE idempotency_key = $1 AND hsa_id = $2",
    )
    .bind(&body.idempotency_key)
    .bind(hsa.id)
    .fetch_optional(pool.get_ref())
    .await?;

    if let Some(existing_contribution) = existing {
        return Ok(HttpResponse::Ok().json(existing_contribution));
    }

    // Use a transaction for atomicity
    let mut tx = pool.begin().await?;

    let contribution_id = Uuid::new_v4();
    let contribution = sqlx::query_as::<_, Contribution>(
        r#"INSERT INTO contributions (id, hsa_id, source_type, source_id, amount_paise, currency, idempotency_key, status, metadata)
           VALUES ($1, $2, $3, $4, $5, 'INR', $6, 'completed', $7)
           RETURNING *"#,
    )
    .bind(contribution_id)
    .bind(hsa.id)
    .bind(&body.source_type)
    .bind(body.source_id)
    .bind(body.amount_paise)
    .bind(&body.idempotency_key)
    .bind(&body.metadata)
    .fetch_one(&mut *tx)
    .await?;

    // Update HSA balance and total
    let new_total = hsa.total_contributed_paise + body.amount_paise;
    let insurance_eligible = new_total >= BASIC_INSURANCE_THRESHOLD;

    sqlx::query(
        r#"UPDATE health_savings_accounts
           SET balance_paise = balance_paise + $1,
               total_contributed_paise = total_contributed_paise + $1,
               insurance_eligible = $2,
               updated_at = NOW()
           WHERE id = $3"#,
    )
    .bind(body.amount_paise)
    .bind(insurance_eligible)
    .bind(hsa.id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(HttpResponse::Created().json(contribution))
}

#[derive(Serialize)]
pub struct PaginatedContributions {
    pub data: Vec<Contribution>,
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
}

pub async fn list_contributions(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    params: web::Query<ContributionListParams>,
) -> Result<HttpResponse, AppError> {
    let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * per_page;

    let (contributions, total) = if let Some(ref source_type) = params.source_type {
        let rows = sqlx::query_as::<_, Contribution>(
            "SELECT * FROM contributions WHERE hsa_id = $1 AND source_type = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
        )
        .bind(hsa.id)
        .bind(source_type)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await?;

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM contributions WHERE hsa_id = $1 AND source_type = $2",
        )
        .bind(hsa.id)
        .bind(source_type)
        .fetch_one(pool.get_ref())
        .await?;

        (rows, count.0)
    } else {
        let rows = sqlx::query_as::<_, Contribution>(
            "SELECT * FROM contributions WHERE hsa_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(hsa.id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await?;

        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM contributions WHERE hsa_id = $1")
                .bind(hsa.id)
                .fetch_one(pool.get_ref())
                .await?;

        (rows, count.0)
    };

    Ok(HttpResponse::Ok().json(PaginatedContributions {
        data: contributions,
        page,
        per_page,
        total,
    }))
}

pub async fn contribution_summary(
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

    let summary = sqlx::query_as::<_, ContributionSummary>(
        r#"SELECT source_type, SUM(amount_paise) as total_paise, COUNT(*) as count
           FROM contributions
           WHERE hsa_id = $1 AND status = 'completed'
           GROUP BY source_type
           ORDER BY total_paise DESC"#,
    )
    .bind(hsa.id)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(summary))
}
