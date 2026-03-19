//! Admin API for Control Center — operator-only endpoints.

use actix_web::{web, HttpResponse};
use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::user::User;
use crate::infrastructure::auth::{require_role, AuthenticatedUser, Role};
use crate::infrastructure::error::AppError;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn map_user_type_for_frontend(backend_type: &str) -> String {
    match backend_type {
        "customer" => "individual".to_string(),
        "partner" => "employer".to_string(),
        _ => backend_type.to_string(),
    }
}

// ── Response DTOs (match Control Center types) ────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DashboardStatsResponse {
    pub total_users: i64,
    pub total_hsa_value_paise: i64,
    pub daily_contributions_paise: i64,
    pub active_policies: i64,
    pub user_growth_percent: f64,
    pub hsa_growth_percent: f64,
    pub contribution_growth_percent: f64,
    pub policy_growth_percent: f64,
}

#[derive(Debug, Serialize)]
pub struct ChartDataPoint {
    pub date: String,
    pub value: i64,
}

#[derive(Debug, Serialize)]
pub struct SourceDistributionItem {
    pub name: String,
    pub value: i64,
}

#[derive(Debug, Serialize)]
pub struct RecentActivityItem {
    pub id: String,
    pub action: String,
    pub user: String,
    pub time: String,
    pub r#type: String,
}

#[derive(Debug, Serialize)]
pub struct AdminUserResponse {
    pub id: String,
    pub phone: String,
    pub name: String,
    pub email: Option<String>,
    pub user_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub kyc_verified: bool,
    pub aadhaar_linked: bool,
    pub hsa_balance_paise: i64,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

pub async fn dashboard_stats(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorInsuranceOps, Role::OperatorSupport, Role::OperatorAnalytics, Role::OperatorPartnerManager])?;

    let total_users: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM users WHERE user_type IN ('customer', 'partner')")
        .fetch_one(pool.get_ref())
        .await?;

    let total_hsa: (i64,) = sqlx::query_as("SELECT COALESCE(SUM(balance_paise), 0) FROM health_savings_accounts WHERE status = 'active'")
        .fetch_one(pool.get_ref())
        .await?;

    let daily_contributions: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount_paise), 0) FROM contributions WHERE created_at >= $1 AND status = 'completed'",
    )
    .bind(Utc::now() - Duration::days(1))
    .fetch_one(pool.get_ref())
    .await?;

    let active_policies: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM insurance_policies WHERE status = 'active'",
    )
    .fetch_one(pool.get_ref())
    .await?;

    let stats = DashboardStatsResponse {
        total_users: total_users.0,
        total_hsa_value_paise: total_hsa.0,
        daily_contributions_paise: daily_contributions.0,
        active_policies: active_policies.0,
        user_growth_percent: 0.0,
        hsa_growth_percent: 0.0,
        contribution_growth_percent: 0.0,
        policy_growth_percent: 0.0,
    };

    Ok(HttpResponse::Ok().json(stats))
}

pub async fn user_growth_chart(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorAnalytics])?;

    let rows: Vec<(chrono::NaiveDate, i64)> = sqlx::query_as(
        r#"SELECT date_trunc('month', created_at)::date as month, COUNT(*)::bigint
           FROM users WHERE user_type IN ('customer', 'partner') AND created_at >= NOW() - INTERVAL '12 months'
           GROUP BY 1 ORDER BY 1"#,
    )
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<ChartDataPoint> = rows
        .into_iter()
        .map(|(d, v)| ChartDataPoint {
            date: d.format("%b").to_string(),
            value: v,
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn contribution_trend_chart(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorAnalytics])?;

    let rows: Vec<(chrono::NaiveDate, i64)> = sqlx::query_as(
        r#"SELECT date_trunc('month', created_at)::date as month, COALESCE(SUM(amount_paise), 0)
           FROM contributions WHERE created_at >= NOW() - INTERVAL '12 months' AND status = 'completed'
           GROUP BY 1 ORDER BY 1"#,
    )
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<ChartDataPoint> = rows
        .into_iter()
        .map(|(d, v)| ChartDataPoint {
            date: d.format("%b").to_string(),
            value: v,
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn source_distribution(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorAnalytics])?;

    let rows: Vec<(String, i64)> = sqlx::query_as(
        r#"SELECT source_type, COALESCE(SUM(amount_paise), 0) FROM contributions
           WHERE created_at >= NOW() - INTERVAL '12 months' AND status = 'completed'
           GROUP BY source_type"#,
    )
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<SourceDistributionItem> = rows
        .into_iter()
        .map(|(name, value)| SourceDistributionItem {
            name: name.replace('_', " "),
            value,
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn recent_activity(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    let mut activities: Vec<RecentActivityItem> = Vec::new();

    let users: Vec<(Uuid, String, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, COALESCE(name, phone) as name, created_at FROM users ORDER BY created_at DESC LIMIT 3",
    )
    .fetch_all(pool.get_ref())
    .await?;

    for (id, name, created) in users {
        activities.push(RecentActivityItem {
            id: id.to_string(),
            action: "New user registration".to_string(),
            user: name,
            time: created.to_rfc3339(),
            r#type: "user".to_string(),
        });
    }

    let contribs: Vec<(Uuid, i64, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT c.id, c.amount_paise, c.created_at FROM contributions c ORDER BY c.created_at DESC LIMIT 2",
    )
    .fetch_all(pool.get_ref())
    .await?;

    for (id, amt, created) in contribs {
        activities.push(RecentActivityItem {
            id: id.to_string(),
            action: format!("HSA contribution ₹{}", amt / 100),
            user: "—".to_string(),
            time: created.to_rfc3339(),
            r#type: "contribution".to_string(),
        });
    }

    activities.sort_by(|a, b| b.time.cmp(&a.time));
    activities.truncate(5);

    Ok(HttpResponse::Ok().json(activities))
}

pub async fn list_users(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListUsersQuery>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport, Role::OperatorPartnerManager])?;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(10).min(100);
    let offset = (page - 1) * page_size;

    let search = query.search.as_deref().unwrap_or("");
    let user_type = query.user_type.as_deref();
    let status = query.status.as_deref();

    let mut count_sql = String::from("SELECT COUNT(*)::bigint FROM users u LEFT JOIN health_savings_accounts h ON h.user_id = u.id WHERE u.user_type IN ('customer', 'partner')");
    let mut data_sql = String::from(
        "SELECT u.id, u.phone, u.name, u.email, u.user_type, COALESCE(u.status, 'active'), u.created_at, u.updated_at, u.abha_id, COALESCE(h.balance_paise, 0) as hsa_balance_paise
         FROM users u LEFT JOIN health_savings_accounts h ON h.user_id = u.id WHERE u.user_type IN ('customer', 'partner')",
    );

    if !search.is_empty() {
        let cond = format!(" AND (u.phone ILIKE '%{}%' OR u.name ILIKE '%{}%')", search.replace('\'', "''"), search.replace('\'', "''"));
        count_sql.push_str(&cond);
        data_sql.push_str(&cond);
    }
    if user_type.is_some() && !user_type.unwrap().is_empty() {
        count_sql.push_str(&format!(" AND u.user_type = '{}'", user_type.unwrap().replace('\'', "''")));
        data_sql.push_str(&format!(" AND u.user_type = '{}'", user_type.unwrap().replace('\'', "''")));
    }
    if status.is_some() && !status.unwrap().is_empty() {
        count_sql.push_str(&format!(" AND COALESCE(u.status, 'active') = '{}'", status.unwrap().replace('\'', "''")));
        data_sql.push_str(&format!(" AND COALESCE(u.status, 'active') = '{}'", status.unwrap().replace('\'', "''")));
    }

    let total: (i64,) = sqlx::query_as(&count_sql).fetch_one(pool.get_ref()).await?;
    let total_pages = (total.0 + page_size - 1) / page_size;

    data_sql.push_str(&format!(" ORDER BY u.created_at DESC LIMIT {} OFFSET {}", page_size, offset));

    #[derive(sqlx::FromRow)]
    struct UserRow {
        id: Uuid,
        phone: String,
        name: Option<String>,
        email: Option<String>,
        user_type: String,
        status: String,
        created_at: Option<chrono::DateTime<Utc>>,
        updated_at: Option<chrono::DateTime<Utc>>,
        abha_id: Option<String>,
        hsa_balance_paise: i64,
    }

    let rows: Vec<UserRow> = sqlx::query_as(&data_sql).fetch_all(pool.get_ref()).await?;

    let data: Vec<AdminUserResponse> = rows
        .into_iter()
        .map(|r| AdminUserResponse {
            id: r.id.to_string(),
            phone: r.phone,
            name: r.name.unwrap_or_default(),
            email: r.email,
            user_type: map_user_type_for_frontend(&r.user_type),
            status: r.status,
            created_at: r.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
            updated_at: r.updated_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
            kyc_verified: false,
            aadhaar_linked: r.abha_id.is_some(),
            hsa_balance_paise: r.hsa_balance_paise,
        })
        .collect();

    Ok(HttpResponse::Ok().json(PaginatedResponse {
        data,
        total: total.0,
        page,
        page_size,
        total_pages,
    }))
}

#[derive(Debug, serde::Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub user_type: Option<String>,
    pub status: Option<String>,
}

pub async fn get_user(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport, Role::OperatorPartnerManager])?;

    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(path.into_inner())
        .fetch_optional(pool.get_ref())
        .await?;

    let user = user.ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let hsa_balance: (i64,) = sqlx::query_as("SELECT COALESCE(balance_paise, 0) FROM health_savings_accounts WHERE user_id = $1")
        .bind(user.id)
        .fetch_optional(pool.get_ref())
        .await?
        .unwrap_or((0,));

    let resp = AdminUserResponse {
        id: user.id.to_string(),
        phone: user.phone,
        name: user.name.unwrap_or_default(),
        email: user.email,
        user_type: map_user_type_for_frontend(&user.user_type),
        status: user.status.unwrap_or_else(|| "active".to_string()),
        created_at: user.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
        updated_at: user.updated_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
        kyc_verified: false,
        aadhaar_linked: user.abha_id.is_some(),
        hsa_balance_paise: hsa_balance.0,
    };

    Ok(HttpResponse::Ok().json(resp))
}

pub async fn get_user_hsa(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    #[derive(serde::Serialize)]
    struct HsaResponse {
        id: String,
        user_id: String,
        balance_paise: i64,
        total_contributions_paise: i64,
        total_withdrawals_paise: i64,
        created_at: String,
        updated_at: String,
    }

    let row: Option<(Uuid, Uuid, i64, i64, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>)> = sqlx::query_as(
        "SELECT id, user_id, balance_paise, total_contributed_paise, created_at, updated_at FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(path.into_inner())
    .fetch_optional(pool.get_ref())
    .await?;

    let (id, user_id, balance, total_contrib, created, updated) = row
        .ok_or_else(|| AppError::NotFound("HSA not found".to_string()))?;

    Ok(HttpResponse::Ok().json(HsaResponse {
        id: id.to_string(),
        user_id: user_id.to_string(),
        balance_paise: balance,
        total_contributions_paise: total_contrib,
        total_withdrawals_paise: 0,
        created_at: created.map(|d| d.to_rfc3339()).unwrap_or_default(),
        updated_at: updated.map(|d| d.to_rfc3339()).unwrap_or_default(),
    }))
}

pub async fn get_user_contributions(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    #[derive(serde::Serialize, sqlx::FromRow)]
    struct ContribRow {
        id: Uuid,
        hsa_id: Uuid,
        amount_paise: i64,
        source_type: String,
        status: Option<String>,
        created_at: Option<chrono::DateTime<Utc>>,
        reference_id: Option<String>,
    }

    let hsa_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM health_savings_accounts WHERE user_id = $1")
        .bind(path.into_inner())
        .fetch_optional(pool.get_ref())
        .await?;

    let hsa_id = match hsa_id {
        Some(id) => id,
        None => return Ok(HttpResponse::Ok().json(serde_json::json!([]))),
    };

    let rows: Vec<ContribRow> = sqlx::query_as(
        "SELECT id, hsa_id, amount_paise, source_type, status, created_at, reference_id FROM contributions WHERE hsa_id = $1 ORDER BY created_at DESC",
    )
    .bind(hsa_id)
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id.to_string(),
                "hsa_account_id": r.hsa_id.to_string(),
                "amount_paise": r.amount_paise,
                "source": r.source_type,
                "status": r.status.unwrap_or_else(|| "completed".to_string()),
                "created_at": r.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                "reference_id": r.reference_id.unwrap_or_default(),
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn get_user_policies(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorInsuranceOps])?;

    let user_id = path.into_inner();
    let hsa_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM health_savings_accounts WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await?;

    let hsa_id = match hsa_id {
        Some(id) => id,
        None => return Ok(HttpResponse::Ok().json(serde_json::json!([]))),
    };

    #[derive(sqlx::FromRow)]
    struct PolicyRow {
        id: Uuid,
        hsa_id: Uuid,
        plan_name: String,
        premium_paise: i64,
        coverage_paise: i64,
        status: Option<String>,
        start_date: Option<chrono::DateTime<Utc>>,
        end_date: Option<chrono::DateTime<Utc>>,
        created_at: Option<chrono::DateTime<Utc>>,
    }

    let rows: Vec<PolicyRow> = sqlx::query_as(
        "SELECT id, hsa_id, plan_name, premium_paise, coverage_paise, status, start_date, end_date, created_at FROM insurance_policies WHERE hsa_id = $1",
    )
    .bind(hsa_id)
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id.to_string(),
                "user_id": user_id.to_string(),
                "provider": "Aarokya",
                "plan_name": r.plan_name,
                "premium_paise": r.premium_paise,
                "coverage_paise": r.coverage_paise,
                "status": r.status.unwrap_or_else(|| "active".to_string()),
                "start_date": r.start_date.map(|d| d.to_rfc3339()),
                "end_date": r.end_date.map(|d| d.to_rfc3339()),
                "created_at": r.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn get_user_claims(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorInsuranceOps])?;

    let user_id = path.into_inner();
    let hsa_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM health_savings_accounts WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await?;

    let hsa_id = match hsa_id {
        Some(id) => id,
        None => return Ok(HttpResponse::Ok().json(serde_json::json!([]))),
    };

    #[derive(sqlx::FromRow)]
    struct ClaimRow {
        id: Uuid,
        policy_id: Uuid,
        hsa_id: Uuid,
        claim_type: String,
        amount_paise: i64,
        description: Option<String>,
        status: Option<String>,
        created_at: Option<chrono::DateTime<Utc>>,
        updated_at: Option<chrono::DateTime<Utc>>,
    }

    let rows: Vec<ClaimRow> = sqlx::query_as(
        "SELECT id, policy_id, hsa_id, claim_type, amount_paise, description, status, created_at, updated_at FROM claims WHERE hsa_id = $1 ORDER BY created_at DESC",
    )
    .bind(hsa_id)
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id.to_string(),
                "policy_id": r.policy_id.to_string(),
                "user_id": user_id.to_string(),
                "amount_paise": r.amount_paise,
                "status": r.status.unwrap_or_else(|| "submitted".to_string()),
                "description": r.description.unwrap_or_default(),
                "submitted_at": r.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                "reviewed_at": r.updated_at.map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(data))
}

pub async fn verify_user(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    sqlx::query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1")
        .bind(path.into_inner())
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "User verified"})))
}

pub async fn suspend_user(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    sqlx::query("UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1")
        .bind(path.into_inner())
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "User suspended"})))
}

pub async fn activate_user(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    sqlx::query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1")
        .bind(path.into_inner())
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "User activated"})))
}

pub async fn reject_user(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    require_role(&auth, &[Role::OperatorSuperAdmin, Role::OperatorSupport])?;

    sqlx::query("UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1")
        .bind(path.into_inner())
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "User rejected"})))
}
