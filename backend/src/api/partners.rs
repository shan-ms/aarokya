use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::hsa::HealthSavingsAccount;
use crate::domain::partner::{
    AddWorkerRequest, BulkContributionRequest, BulkContributionResult, Partner, PartnerDashboard,
    PartnerWorker, RegisterPartnerRequest,
};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

const BASIC_INSURANCE_THRESHOLD: i64 = 399_900;

pub async fn register_partner(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<RegisterPartnerRequest>,
) -> Result<HttpResponse, AppError> {
    if auth.user_type != "partner" {
        return Err(AppError::Forbidden(
            "Only partner accounts can register as partners".to_string(),
        ));
    }

    // Check if already registered
    let existing = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("Partner already registered".to_string()));
    }

    let id = Uuid::new_v4();
    let partner = sqlx::query_as::<_, Partner>(
        r#"INSERT INTO partners (id, user_id, company_name, partner_type, gstin, contact_email, contact_phone, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&body.company_name)
    .bind(&body.partner_type)
    .bind(&body.gstin)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(partner))
}

pub async fn get_partner(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))?;

    Ok(HttpResponse::Ok().json(partner))
}

pub async fn add_worker(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<AddWorkerRequest>,
) -> Result<HttpResponse, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))?;

    // Find or create the worker user
    let worker_user = sqlx::query_as::<_, crate::domain::user::User>(
        "SELECT * FROM users WHERE phone = $1",
    )
    .bind(&body.worker_phone)
    .fetch_optional(pool.get_ref())
    .await?;

    let worker_user_id = match worker_user {
        Some(user) => user.id,
        None => {
            let id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO users (id, phone, user_type, status) VALUES ($1, $2, 'customer', 'active')",
            )
            .bind(id)
            .bind(&body.worker_phone)
            .execute(pool.get_ref())
            .await?;
            id
        }
    };

    // Check if already linked
    let existing = sqlx::query_as::<_, PartnerWorker>(
        "SELECT * FROM partner_workers WHERE partner_id = $1 AND worker_user_id = $2",
    )
    .bind(partner.id)
    .bind(worker_user_id)
    .fetch_optional(pool.get_ref())
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("Worker already linked to this partner".to_string()));
    }

    let id = Uuid::new_v4();
    let worker = sqlx::query_as::<_, PartnerWorker>(
        r#"INSERT INTO partner_workers (id, partner_id, worker_user_id, external_worker_id, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING *"#,
    )
    .bind(id)
    .bind(partner.id)
    .bind(worker_user_id)
    .bind(&body.external_worker_id)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(worker))
}

pub async fn list_workers(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))?;

    let workers = sqlx::query_as::<_, PartnerWorker>(
        "SELECT * FROM partner_workers WHERE partner_id = $1 ORDER BY created_at DESC",
    )
    .bind(partner.id)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(workers))
}

pub async fn bulk_contribute(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<BulkContributionRequest>,
) -> Result<HttpResponse, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))?;

    let mut succeeded: i64 = 0;
    let mut failed: i64 = 0;
    let mut errors = Vec::new();

    for item in &body.contributions {
        // Find user by phone
        let worker_user = sqlx::query_as::<_, crate::domain::user::User>(
            "SELECT * FROM users WHERE phone = $1",
        )
        .bind(&item.worker_phone)
        .fetch_optional(pool.get_ref())
        .await;

        let worker_user = match worker_user {
            Ok(Some(u)) => u,
            Ok(None) => {
                failed += 1;
                errors.push(format!("User not found for phone: {}", item.worker_phone));
                continue;
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("DB error for {}: {}", item.worker_phone, e));
                continue;
            }
        };

        // Get worker's HSA
        let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
            "SELECT * FROM health_savings_accounts WHERE user_id = $1",
        )
        .bind(worker_user.id)
        .fetch_optional(pool.get_ref())
        .await;

        let hsa = match hsa {
            Ok(Some(h)) => h,
            Ok(None) => {
                failed += 1;
                errors.push(format!("No HSA for phone: {}", item.worker_phone));
                continue;
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("DB error for {}: {}", item.worker_phone, e));
                continue;
            }
        };

        // Check idempotency
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM contributions WHERE idempotency_key = $1 AND hsa_id = $2",
        )
        .bind(&item.idempotency_key)
        .bind(hsa.id)
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

        if existing > 0 {
            succeeded += 1; // Already processed, count as success
            continue;
        }

        // Create contribution in transaction
        let mut tx = match pool.begin().await {
            Ok(tx) => tx,
            Err(e) => {
                failed += 1;
                errors.push(format!("Transaction error for {}: {}", item.worker_phone, e));
                continue;
            }
        };

        let contribution_id = Uuid::new_v4();
        let insert_result = sqlx::query(
            r#"INSERT INTO contributions (id, hsa_id, source_type, source_id, amount_paise, currency, idempotency_key, status)
               VALUES ($1, $2, 'employer', $3, $4, 'INR', $5, 'completed')"#,
        )
        .bind(contribution_id)
        .bind(hsa.id)
        .bind(partner.id)
        .bind(item.amount_paise)
        .bind(&item.idempotency_key)
        .execute(&mut *tx)
        .await;

        if let Err(e) = insert_result {
            failed += 1;
            errors.push(format!("Insert error for {}: {}", item.worker_phone, e));
            let _ = tx.rollback().await;
            continue;
        }

        let new_total = hsa.total_contributed_paise + item.amount_paise;
        let insurance_eligible = new_total >= BASIC_INSURANCE_THRESHOLD;

        let update_result = sqlx::query(
            r#"UPDATE health_savings_accounts
               SET balance_paise = balance_paise + $1,
                   total_contributed_paise = total_contributed_paise + $1,
                   insurance_eligible = $2,
                   updated_at = NOW()
               WHERE id = $3"#,
        )
        .bind(item.amount_paise)
        .bind(insurance_eligible)
        .bind(hsa.id)
        .execute(&mut *tx)
        .await;

        if let Err(e) = update_result {
            failed += 1;
            errors.push(format!("Update error for {}: {}", item.worker_phone, e));
            let _ = tx.rollback().await;
            continue;
        }

        if let Err(e) = tx.commit().await {
            failed += 1;
            errors.push(format!("Commit error for {}: {}", item.worker_phone, e));
            continue;
        }

        succeeded += 1;
    }

    Ok(HttpResponse::Ok().json(BulkContributionResult {
        succeeded,
        failed,
        errors,
    }))
}

pub async fn partner_dashboard(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT * FROM partners WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))?;

    let total_workers: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM partner_workers WHERE partner_id = $1 AND status = 'active'",
    )
    .bind(partner.id)
    .fetch_one(pool.get_ref())
    .await?;

    let contribution_stats: (Option<i64>, i64) = sqlx::query_as(
        r#"SELECT COALESCE(SUM(c.amount_paise), 0), COUNT(c.id)
           FROM contributions c
           WHERE c.source_id = $1 AND c.source_type = 'employer' AND c.status = 'completed'"#,
    )
    .bind(partner.id)
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(PartnerDashboard {
        total_workers: total_workers.0,
        total_contributed_paise: contribution_stats.0.unwrap_or(0),
        contribution_count: contribution_stats.1,
    }))
}
