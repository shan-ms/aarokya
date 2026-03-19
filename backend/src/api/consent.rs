use actix_web::{web, HttpRequest, HttpResponse};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::consent::{ConsentRecord, GrantConsentRequest, WithdrawConsentRequest};
use crate::domain::document::HealthDocument;
use crate::domain::family::FamilyProfile;
use crate::domain::user::User;
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

pub async fn grant_consent(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<GrantConsentRequest>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    let ip_address = req
        .connection_info()
        .realip_remote_addr()
        .map(|s| s.to_string());

    let user_agent = req
        .headers()
        .get("User-Agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let id = Uuid::new_v4();
    let consent = sqlx::query_as::<_, ConsentRecord>(
        r#"INSERT INTO consent_records (id, user_id, purpose, scope, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&body.purpose)
    .bind(&body.scope)
    .bind(&ip_address)
    .bind(&user_agent)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "consent_granted",
        user_id = %auth.user_id,
        consent_id = %consent.id,
        purpose = %body.purpose,
        "Consent granted"
    );

    Ok(HttpResponse::Created().json(consent))
}

pub async fn list_consents(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let consents = sqlx::query_as::<_, ConsentRecord>(
        "SELECT * FROM consent_records WHERE user_id = $1 AND withdrawn_at IS NULL ORDER BY granted_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    tracing::info!(
        event = "consents_listed",
        user_id = %auth.user_id,
        count = consents.len(),
        "Active consents listed"
    );

    Ok(HttpResponse::Ok().json(consents))
}

pub async fn withdraw_consent(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<WithdrawConsentRequest>,
) -> Result<HttpResponse, AppError> {
    let consent = sqlx::query_as::<_, ConsentRecord>(
        r#"UPDATE consent_records
           SET withdrawn_at = NOW()
           WHERE user_id = $1 AND purpose = $2 AND withdrawn_at IS NULL
           RETURNING *"#,
    )
    .bind(auth.user_id)
    .bind(&body.purpose)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("No active consent found for this purpose".to_string()))?;

    tracing::info!(
        event = "consent_withdrawn",
        user_id = %auth.user_id,
        consent_id = %consent.id,
        purpose = %body.purpose,
        "Consent withdrawn"
    );

    Ok(HttpResponse::Ok().json(consent))
}

#[derive(Debug, Serialize)]
pub struct DataExportResponse {
    pub user: Option<User>,
    pub consents: Vec<ConsentRecord>,
    pub family_members: Vec<FamilyProfile>,
    pub documents: Vec<HealthDocument>,
}

pub async fn export_data(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?;

    let consents = sqlx::query_as::<_, ConsentRecord>(
        "SELECT * FROM consent_records WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    let family_members = sqlx::query_as::<_, FamilyProfile>(
        "SELECT * FROM family_profiles WHERE caregiver_user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    let documents = sqlx::query_as::<_, HealthDocument>(
        "SELECT * FROM health_documents WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    let export = DataExportResponse {
        user,
        consents,
        family_members,
        documents,
    };

    tracing::info!(
        event = "data_exported",
        user_id = %auth.user_id,
        "User data exported (DPDP compliance)"
    );

    Ok(HttpResponse::Ok().json(export))
}

pub async fn delete_account(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let mut tx = pool.begin().await?;

    // Delete from all related tables (order matters for foreign keys)
    sqlx::query("DELETE FROM record_sharing_log WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM checkin_records WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM health_documents WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM family_profiles WHERE caregiver_user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM consent_records WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM health_profiles WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    // Set user status to deleted
    sqlx::query("UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    tracing::info!(
        event = "account_deleted",
        user_id = %auth.user_id,
        "User account deleted (DPDP compliance)"
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Account and all associated data have been deleted"
    })))
}
