use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::hsa::HealthSavingsAccount;
use crate::domain::partner::{
    compute_coverage_rate, AddWorkerRequest, BulkContributionRequest, BulkContributionResult,
    ContributionReport, ContributionReportRow, Partner, PartnerDashboard, PartnerProfile,
    PartnerWorker, RegisterPartnerRequest, ReportQuery, WorkerWithHsaStatus,
};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

const BASIC_INSURANCE_THRESHOLD: i64 = 399_900;

// ── helpers ──────────────────────────────────────────────────────────────────

/// Fetch the partner record for the authenticated user, or return NotFound.
async fn fetch_partner(auth: &AuthenticatedUser, pool: &PgPool) -> Result<Partner, AppError> {
    sqlx::query_as::<_, Partner>("SELECT * FROM partners WHERE user_id = $1")
        .bind(auth.user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Partner not found".to_string()))
}

// ── POST /api/v1/partners/register ──────────────────────────────────────────

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

    // Validate request body
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;
    body.validate_partner_type()
        .map_err(|e| AppError::Validation(e))?;

    // Check if already registered
    let existing = sqlx::query_as::<_, Partner>("SELECT * FROM partners WHERE user_id = $1")
        .bind(auth.user_id)
        .fetch_optional(pool.get_ref())
        .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(
            "Partner already registered".to_string(),
        ));
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

    // Update user_type to partner if not already
    sqlx::query("UPDATE users SET user_type = 'partner', updated_at = NOW() WHERE id = $1")
        .bind(auth.user_id)
        .execute(pool.get_ref())
        .await?;

    tracing::info!(
        event = "partner_registered",
        partner_id = %partner.id,
        user_id = %auth.user_id,
        company_name = %body.company_name,
        partner_type = %body.partner_type,
        "Partner registered"
    );

    Ok(HttpResponse::Created().json(partner))
}

// ── GET /api/v1/partners/me ─────────────────────────────────────────────────

pub async fn get_partner(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = fetch_partner(&auth, pool.get_ref()).await?;

    // Get worker count
    let total_workers: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM partner_workers WHERE partner_id = $1 AND status = 'active'",
    )
    .bind(partner.id)
    .fetch_one(pool.get_ref())
    .await?;

    // Get contribution stats
    let contribution_stats: (Option<i64>, i64) = sqlx::query_as(
        r#"SELECT COALESCE(SUM(c.amount_paise), 0), COUNT(c.id)
           FROM contributions c
           WHERE c.source_id = $1 AND c.source_type = 'employer' AND c.status = 'completed'"#,
    )
    .bind(partner.id)
    .fetch_one(pool.get_ref())
    .await?;

    let profile = PartnerProfile {
        id: partner.id,
        user_id: partner.user_id,
        company_name: partner.company_name,
        partner_type: partner.partner_type,
        gstin: partner.gstin,
        contact_email: partner.contact_email,
        contact_phone: partner.contact_phone,
        status: partner.status,
        created_at: partner.created_at,
        updated_at: partner.updated_at,
        total_workers: total_workers.0,
        total_contributed_paise: contribution_stats.0.unwrap_or(0),
        contribution_count: contribution_stats.1,
    };

    Ok(HttpResponse::Ok().json(profile))
}

// ── POST /api/v1/partners/workers ───────────────────────────────────────────

pub async fn add_worker(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<AddWorkerRequest>,
) -> Result<HttpResponse, AppError> {
    // Validate that at least one lookup field is provided
    body.validate_lookup()
        .map_err(|e| AppError::Validation(e))?;

    let partner = fetch_partner(&auth, pool.get_ref()).await?;

    // Find the worker user by phone or ABHA ID
    let worker_user = if let Some(ref phone) = body.worker_phone {
        sqlx::query_as::<_, crate::domain::user::User>(
            "SELECT * FROM users WHERE phone = $1",
        )
        .bind(phone)
        .fetch_optional(pool.get_ref())
        .await?
    } else if let Some(ref abha_id) = body.abha_id {
        sqlx::query_as::<_, crate::domain::user::User>(
            "SELECT * FROM users WHERE abha_id = $1",
        )
        .bind(abha_id)
        .fetch_optional(pool.get_ref())
        .await?
    } else {
        None
    };

    let worker_user_id = match worker_user {
        Some(user) => user.id,
        None => {
            // Create user only if we have a phone number
            if let Some(ref phone) = body.worker_phone {
                let id = Uuid::new_v4();
                sqlx::query(
                    "INSERT INTO users (id, phone, abha_id, user_type, status) VALUES ($1, $2, $3, 'customer', 'active')",
                )
                .bind(id)
                .bind(phone)
                .bind(&body.abha_id)
                .execute(pool.get_ref())
                .await?;
                id
            } else {
                return Err(AppError::NotFound(
                    "No user found with the provided ABHA ID".to_string(),
                ));
            }
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
        return Err(AppError::Conflict(
            "Worker already linked to this partner".to_string(),
        ));
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

    tracing::info!(
        event = "worker_added",
        partner_id = %partner.id,
        worker_user_id = %worker_user_id,
        "Worker added to partner"
    );

    Ok(HttpResponse::Created().json(worker))
}

// ── GET /api/v1/partners/workers ────────────────────────────────────────────

pub async fn list_workers(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = fetch_partner(&auth, pool.get_ref()).await?;

    // Join partner_workers with users and HSA to get enriched data
    let rows = sqlx::query_as::<_, PartnerWorkerRow>(
        r#"SELECT
               pw.id, pw.partner_id, pw.worker_user_id, pw.external_worker_id,
               pw.status, pw.created_at,
               u.phone as worker_phone, u.name as worker_name,
               hsa.id as hsa_id,
               hsa.balance_paise as hsa_balance_paise,
               hsa.total_contributed_paise as hsa_total_contributed_paise,
               hsa.insurance_eligible as insurance_eligible
           FROM partner_workers pw
           LEFT JOIN users u ON u.id = pw.worker_user_id
           LEFT JOIN health_savings_accounts hsa ON hsa.user_id = pw.worker_user_id
           WHERE pw.partner_id = $1
           ORDER BY pw.created_at DESC"#,
    )
    .bind(partner.id)
    .fetch_all(pool.get_ref())
    .await?;

    let workers: Vec<WorkerWithHsaStatus> = rows
        .into_iter()
        .map(|r| WorkerWithHsaStatus {
            id: r.id,
            partner_id: r.partner_id,
            worker_user_id: r.worker_user_id,
            external_worker_id: r.external_worker_id,
            status: r.status,
            created_at: r.created_at,
            worker_phone: r.worker_phone,
            worker_name: r.worker_name,
            has_hsa: r.hsa_id.is_some(),
            hsa_balance_paise: r.hsa_balance_paise,
            hsa_total_contributed_paise: r.hsa_total_contributed_paise,
            insurance_eligible: r.insurance_eligible,
        })
        .collect();

    Ok(HttpResponse::Ok().json(workers))
}

/// Internal row type for the joined query in list_workers.
#[derive(Debug, sqlx::FromRow)]
struct PartnerWorkerRow {
    id: Uuid,
    partner_id: Uuid,
    worker_user_id: Uuid,
    external_worker_id: Option<String>,
    status: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    worker_phone: Option<String>,
    worker_name: Option<String>,
    hsa_id: Option<Uuid>,
    hsa_balance_paise: Option<i64>,
    hsa_total_contributed_paise: Option<i64>,
    insurance_eligible: Option<bool>,
}

// ── POST /api/v1/partners/contributions/bulk ────────────────────────────────

pub async fn bulk_contribute(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<BulkContributionRequest>,
) -> Result<HttpResponse, AppError> {
    // Validate the request
    body.validate_items()
        .map_err(|e| AppError::Validation(e))?;

    let partner = fetch_partner(&auth, pool.get_ref()).await?;

    // Process all contributions in a single DB transaction
    let mut tx = pool.begin().await?;

    let mut succeeded: i64 = 0;
    let mut failed: i64 = 0;
    let mut errors = Vec::new();

    for item in &body.contributions {
        // Find user by phone
        let worker_user = sqlx::query_as::<_, crate::domain::user::User>(
            "SELECT * FROM users WHERE phone = $1",
        )
        .bind(&item.worker_phone)
        .fetch_optional(&mut *tx)
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
        .fetch_optional(&mut *tx)
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
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

        if existing > 0 {
            succeeded += 1; // Already processed, count as success
            continue;
        }

        // Insert contribution
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
            continue;
        }

        // Update HSA balance
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
            continue;
        }

        succeeded += 1;
    }

    // Commit the entire transaction
    tx.commit().await?;

    tracing::info!(
        event = "bulk_contribution_completed",
        partner_id = %partner.id,
        succeeded = succeeded,
        failed = failed,
        "Bulk contribution processed"
    );

    Ok(HttpResponse::Ok().json(BulkContributionResult {
        succeeded,
        failed,
        errors,
    }))
}

// ── GET /api/v1/partners/dashboard ──────────────────────────────────────────

pub async fn partner_dashboard(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let partner = fetch_partner(&auth, pool.get_ref()).await?;

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

    // Count workers whose HSA is insurance-eligible
    let eligible_workers: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*)
           FROM partner_workers pw
           JOIN health_savings_accounts hsa ON hsa.user_id = pw.worker_user_id
           WHERE pw.partner_id = $1 AND pw.status = 'active' AND hsa.insurance_eligible = true"#,
    )
    .bind(partner.id)
    .fetch_one(pool.get_ref())
    .await?;

    let coverage_rate = compute_coverage_rate(eligible_workers.0, total_workers.0);

    Ok(HttpResponse::Ok().json(PartnerDashboard {
        total_workers: total_workers.0,
        total_contributed_paise: contribution_stats.0.unwrap_or(0),
        contribution_count: contribution_stats.1,
        coverage_rate,
    }))
}

// ── GET /api/v1/partners/reports ────────────────────────────────────────────

pub async fn partner_reports(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    params: web::Query<ReportQuery>,
) -> Result<HttpResponse, AppError> {
    let partner = fetch_partner(&auth, pool.get_ref()).await?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).min(1000).max(1);
    let offset = (page - 1) * per_page;

    // Build dynamic query with optional date range filters
    let has_date_from = params.date_from.is_some();
    let has_date_to = params.date_to.is_some();

    let mut data_sql = String::from(
        r#"SELECT
               c.id as contribution_id,
               u.phone as worker_phone,
               u.name as worker_name,
               c.amount_paise,
               c.currency,
               c.status,
               c.idempotency_key,
               c.created_at
           FROM contributions c
           JOIN health_savings_accounts hsa ON hsa.id = c.hsa_id
           JOIN partner_workers pw ON pw.worker_user_id = hsa.user_id AND pw.partner_id = $1
           JOIN users u ON u.id = hsa.user_id
           WHERE c.source_id = $1 AND c.source_type = 'employer'"#,
    );

    let mut count_sql = String::from(
        r#"SELECT COUNT(*), COALESCE(SUM(c.amount_paise), 0)
           FROM contributions c
           JOIN health_savings_accounts hsa ON hsa.id = c.hsa_id
           JOIN partner_workers pw ON pw.worker_user_id = hsa.user_id AND pw.partner_id = $1
           JOIN users u ON u.id = hsa.user_id
           WHERE c.source_id = $1 AND c.source_type = 'employer'"#,
    );

    let mut param_idx = 2;

    if has_date_from {
        let clause = format!(" AND c.created_at >= ${}", param_idx);
        data_sql.push_str(&clause);
        count_sql.push_str(&clause);
        param_idx += 1;
    }

    if has_date_to {
        let clause = format!(" AND c.created_at < ${} + INTERVAL '1 day'", param_idx);
        data_sql.push_str(&clause);
        count_sql.push_str(&clause);
        param_idx += 1;
    }

    data_sql.push_str(&format!(
        " ORDER BY c.created_at DESC LIMIT ${} OFFSET ${}",
        param_idx,
        param_idx + 1
    ));

    // Execute data query
    let mut data_q = sqlx::query_as::<_, ContributionReportRow>(&data_sql).bind(partner.id);
    let mut count_q = sqlx::query_as::<_, (i64, Option<i64>)>(&count_sql).bind(partner.id);

    if let Some(ref date_from) = params.date_from {
        data_q = data_q.bind(*date_from);
        count_q = count_q.bind(*date_from);
    }
    if let Some(ref date_to) = params.date_to {
        data_q = data_q.bind(*date_to);
        count_q = count_q.bind(*date_to);
    }

    data_q = data_q.bind(per_page).bind(offset);

    let rows = data_q.fetch_all(pool.get_ref()).await?;
    let totals = count_q.fetch_one(pool.get_ref()).await?;

    Ok(HttpResponse::Ok().json(ContributionReport {
        rows,
        total_amount_paise: totals.1.unwrap_or(0),
        total_count: totals.0,
        page,
        per_page,
    }))
}

// ── tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::domain::partner::*;
    use actix_web::test as actix_test;
    use actix_web::{web, App};
    use uuid::Uuid;
    use validator::Validate;

    // ── Unit tests for request validation ───────────────────────────────

    #[test]
    fn test_register_request_validation_valid() {
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
    fn test_register_request_invalid_partner_type() {
        let req = RegisterPartnerRequest {
            company_name: "Test".to_string(),
            partner_type: "invalid".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
        };
        assert!(req.validate_partner_type().is_err());
    }

    #[test]
    fn test_register_request_empty_company_name() {
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
    fn test_add_worker_validation_phone_only() {
        let req = AddWorkerRequest {
            worker_phone: Some("+919876543210".to_string()),
            abha_id: None,
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn test_add_worker_validation_abha_only() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: Some("ABHA12345678".to_string()),
            external_worker_id: None,
        };
        assert!(req.validate_lookup().is_ok());
    }

    #[test]
    fn test_add_worker_validation_neither() {
        let req = AddWorkerRequest {
            worker_phone: None,
            abha_id: None,
            external_worker_id: Some("EXT-001".to_string()),
        };
        assert!(req.validate_lookup().is_err());
    }

    #[test]
    fn test_bulk_contribution_validation_valid() {
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
    fn test_bulk_contribution_validation_empty() {
        let req = BulkContributionRequest {
            contributions: vec![],
        };
        assert!(req.validate_items().is_err());
    }

    #[test]
    fn test_bulk_contribution_validation_zero_amount() {
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
    fn test_coverage_rate_computation() {
        assert!((compute_coverage_rate(0, 0) - 0.0).abs() < f64::EPSILON);
        assert!((compute_coverage_rate(5, 10) - 0.5).abs() < f64::EPSILON);
        assert!((compute_coverage_rate(10, 10) - 1.0).abs() < f64::EPSILON);
        assert!((compute_coverage_rate(0, 10) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_partner_dashboard_struct() {
        let dashboard = PartnerDashboard {
            total_workers: 50,
            total_contributed_paise: 5_000_000,
            contribution_count: 150,
            coverage_rate: 0.75,
        };
        assert_eq!(dashboard.total_workers, 50);
        assert_eq!(dashboard.total_contributed_paise, 5_000_000);
        assert_eq!(dashboard.contribution_count, 150);
        assert!((dashboard.coverage_rate - 0.75).abs() < f64::EPSILON);
    }

    #[test]
    fn test_partner_profile_struct() {
        let profile = PartnerProfile {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            company_name: "Test Corp".to_string(),
            partner_type: "employer".to_string(),
            gstin: None,
            contact_email: None,
            contact_phone: None,
            status: Some("active".to_string()),
            created_at: None,
            updated_at: None,
            total_workers: 10,
            total_contributed_paise: 100_000,
            contribution_count: 5,
        };
        assert_eq!(profile.total_workers, 10);
        assert_eq!(profile.total_contributed_paise, 100_000);
        assert_eq!(profile.contribution_count, 5);
    }

    #[test]
    fn test_worker_with_hsa_status_struct() {
        let worker = WorkerWithHsaStatus {
            id: Uuid::new_v4(),
            partner_id: Uuid::new_v4(),
            worker_user_id: Uuid::new_v4(),
            external_worker_id: Some("EXT-001".to_string()),
            status: Some("active".to_string()),
            created_at: None,
            worker_phone: Some("+919876543210".to_string()),
            worker_name: Some("Test Worker".to_string()),
            has_hsa: true,
            hsa_balance_paise: Some(50_000),
            hsa_total_contributed_paise: Some(100_000),
            insurance_eligible: Some(false),
        };
        assert!(worker.has_hsa);
        assert_eq!(worker.hsa_balance_paise, Some(50_000));
    }

    #[test]
    fn test_contribution_report_struct() {
        let report = ContributionReport {
            rows: vec![],
            total_amount_paise: 500_000,
            total_count: 25,
            page: 1,
            per_page: 50,
        };
        assert_eq!(report.total_amount_paise, 500_000);
        assert_eq!(report.total_count, 25);
        assert!(report.rows.is_empty());
    }

    #[test]
    fn test_bulk_contribution_result_struct() {
        let result = BulkContributionResult {
            succeeded: 8,
            failed: 2,
            errors: vec!["User not found for phone: +919999".to_string()],
        };
        assert_eq!(result.succeeded, 8);
        assert_eq!(result.failed, 2);
        assert_eq!(result.errors.len(), 1);
    }

    #[test]
    fn test_report_query_defaults() {
        let query = ReportQuery {
            date_from: None,
            date_to: None,
            page: None,
            per_page: None,
        };
        assert!(query.date_from.is_none());
        assert!(query.date_to.is_none());
        assert_eq!(query.page.unwrap_or(1), 1);
        assert_eq!(query.per_page.unwrap_or(50), 50);
    }

    #[test]
    fn test_bulk_contribution_too_many_items() {
        let items: Vec<BulkContributionItem> = (0..1001)
            .map(|i| BulkContributionItem {
                worker_phone: format!("+91987654{:04}", i),
                amount_paise: 1000,
                idempotency_key: format!("key-{}", i),
            })
            .collect();
        let req = BulkContributionRequest { contributions: items };
        let result = req.validate_items();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Maximum 1000"));
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

    #[test]
    fn test_all_valid_partner_types_accepted() {
        for pt in VALID_PARTNER_TYPES {
            let req = RegisterPartnerRequest {
                company_name: "Test Corp".to_string(),
                partner_type: pt.to_string(),
                gstin: None,
                contact_email: None,
                contact_phone: None,
            };
            assert!(
                req.validate_partner_type().is_ok(),
                "Expected partner_type '{}' to be valid",
                pt
            );
        }
    }

    // ── Integration-style tests using actix-web test helpers ────────────

    async fn mock_register_partner() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Created().json(serde_json::json!({
            "id": Uuid::new_v4(),
            "company_name": "Test Corp",
            "partner_type": "employer",
            "status": "active"
        }))
    }

    async fn mock_get_partner() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(serde_json::json!({
            "id": Uuid::new_v4(),
            "company_name": "Test Corp",
            "total_workers": 5,
            "total_contributed_paise": 100000,
            "contribution_count": 10
        }))
    }

    async fn mock_dashboard() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(PartnerDashboard {
            total_workers: 10,
            total_contributed_paise: 500_000,
            contribution_count: 50,
            coverage_rate: 0.6,
        })
    }

    async fn mock_reports() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(ContributionReport {
            rows: vec![],
            total_amount_paise: 0,
            total_count: 0,
            page: 1,
            per_page: 50,
        })
    }

    async fn mock_list_workers() -> actix_web::HttpResponse {
        let workers: Vec<WorkerWithHsaStatus> = vec![];
        actix_web::HttpResponse::Ok().json(workers)
    }

    async fn mock_add_worker() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Created().json(serde_json::json!({
            "id": Uuid::new_v4(),
            "status": "active"
        }))
    }

    async fn mock_bulk_contribute() -> actix_web::HttpResponse {
        actix_web::HttpResponse::Ok().json(BulkContributionResult {
            succeeded: 0,
            failed: 0,
            errors: vec![],
        })
    }

    #[actix_rt::test]
    async fn test_register_partner_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/register", web::post().to(mock_register_partner)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::post()
            .uri("/api/v1/partners/register")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    #[actix_rt::test]
    async fn test_get_partner_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/me", web::get().to(mock_get_partner)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::get()
            .uri("/api/v1/partners/me")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_rt::test]
    async fn test_dashboard_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/dashboard", web::get().to(mock_dashboard)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::get()
            .uri("/api/v1/partners/dashboard")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: PartnerDashboard = actix_test::read_body_json(resp).await;
        assert_eq!(body.total_workers, 10);
        assert!((body.coverage_rate - 0.6).abs() < f64::EPSILON);
    }

    #[actix_rt::test]
    async fn test_reports_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/reports", web::get().to(mock_reports)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::get()
            .uri("/api/v1/partners/reports")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: ContributionReport = actix_test::read_body_json(resp).await;
        assert_eq!(body.total_count, 0);
        assert_eq!(body.page, 1);
    }

    #[actix_rt::test]
    async fn test_list_workers_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/workers", web::get().to(mock_list_workers)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::get()
            .uri("/api/v1/partners/workers")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Vec<WorkerWithHsaStatus> = actix_test::read_body_json(resp).await;
        assert!(body.is_empty());
    }

    #[actix_rt::test]
    async fn test_add_worker_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/workers", web::post().to(mock_add_worker)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::post()
            .uri("/api/v1/partners/workers")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    #[actix_rt::test]
    async fn test_bulk_contribute_route_exists() {
        let app = actix_test::init_service(
            App::new().service(
                web::scope("/api/v1/partners")
                    .route("/contributions/bulk", web::post().to(mock_bulk_contribute)),
            ),
        )
        .await;

        let req = actix_test::TestRequest::post()
            .uri("/api/v1/partners/contributions/bulk")
            .to_request();
        let resp = actix_test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: BulkContributionResult = actix_test::read_body_json(resp).await;
        assert_eq!(body.succeeded, 0);
        assert_eq!(body.failed, 0);
    }

    #[actix_rt::test]
    async fn test_dashboard_json_serialization() {
        let dashboard = PartnerDashboard {
            total_workers: 100,
            total_contributed_paise: 10_000_000,
            contribution_count: 500,
            coverage_rate: 0.85,
        };
        let json = serde_json::to_string(&dashboard).unwrap();
        assert!(json.contains("\"total_workers\":100"));
        assert!(json.contains("\"coverage_rate\":0.85"));
        assert!(json.contains("\"total_contributed_paise\":10000000"));
    }

    #[actix_rt::test]
    async fn test_contribution_report_json_serialization() {
        let report = ContributionReport {
            rows: vec![],
            total_amount_paise: 250_000,
            total_count: 10,
            page: 2,
            per_page: 25,
        };
        let json = serde_json::to_string(&report).unwrap();
        assert!(json.contains("\"total_amount_paise\":250000"));
        assert!(json.contains("\"page\":2"));
        assert!(json.contains("\"per_page\":25"));
    }
}
