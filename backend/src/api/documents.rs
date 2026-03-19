use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::document::{
    CreateDocumentRequest, HealthDocument, RecordSharingLog, ShareDocumentRequest,
};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

pub async fn create_document(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateDocumentRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    let id = Uuid::new_v4();
    let tags_json = body
        .tags
        .as_ref()
        .map(|t| serde_json::to_value(t).unwrap_or_default());

    let document = sqlx::query_as::<_, HealthDocument>(
        r#"INSERT INTO health_documents (id, user_id, family_member_id, document_type, title, description, file_url, file_size_bytes, mime_type, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(body.family_member_id)
    .bind(&body.document_type)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.file_url)
    .bind(body.file_size_bytes)
    .bind(&body.mime_type)
    .bind(&tags_json)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "document_created",
        user_id = %auth.user_id,
        document_id = %document.id,
        document_type = %body.document_type,
        "Health document created"
    );

    Ok(HttpResponse::Created().json(document))
}

pub async fn list_documents(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let documents = sqlx::query_as::<_, HealthDocument>(
        "SELECT * FROM health_documents WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    tracing::info!(
        event = "documents_listed",
        user_id = %auth.user_id,
        count = documents.len(),
        "Health documents listed"
    );

    Ok(HttpResponse::Ok().json(documents))
}

pub async fn get_document(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let document_id = path.into_inner();

    let document = sqlx::query_as::<_, HealthDocument>(
        "SELECT * FROM health_documents WHERE id = $1 AND user_id = $2",
    )
    .bind(document_id)
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Document not found".to_string()))?;

    tracing::info!(
        event = "document_viewed",
        user_id = %auth.user_id,
        document_id = %document.id,
        "Health document viewed"
    );

    Ok(HttpResponse::Ok().json(document))
}

pub async fn delete_document(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let document_id = path.into_inner();

    // Delete any sharing logs first
    sqlx::query("DELETE FROM record_sharing_log WHERE document_id = $1 AND user_id = $2")
        .bind(document_id)
        .bind(auth.user_id)
        .execute(pool.get_ref())
        .await?;

    let result = sqlx::query("DELETE FROM health_documents WHERE id = $1 AND user_id = $2")
        .bind(document_id)
        .bind(auth.user_id)
        .execute(pool.get_ref())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Document not found".to_string()));
    }

    tracing::info!(
        event = "document_deleted",
        user_id = %auth.user_id,
        document_id = %document_id,
        "Health document deleted"
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Document deleted successfully"
    })))
}

pub async fn share_document(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<ShareDocumentRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    // Verify document belongs to user
    let _document = sqlx::query_as::<_, HealthDocument>(
        "SELECT * FROM health_documents WHERE id = $1 AND user_id = $2",
    )
    .bind(body.document_id)
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Document not found".to_string()))?;

    let id = Uuid::new_v4();
    let expires_at = body.expires_in_hours.map(|hours| {
        chrono::Utc::now() + chrono::Duration::hours(hours)
    });

    let sharing_log = sqlx::query_as::<_, RecordSharingLog>(
        r#"INSERT INTO record_sharing_log (id, user_id, document_id, shared_with, purpose, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(body.document_id)
    .bind(&body.shared_with)
    .bind(&body.purpose)
    .bind(expires_at)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "document_shared",
        user_id = %auth.user_id,
        document_id = %body.document_id,
        shared_with = %body.shared_with,
        "Document shared"
    );

    Ok(HttpResponse::Created().json(sharing_log))
}

pub async fn list_shared(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let shared = sqlx::query_as::<_, RecordSharingLog>(
        "SELECT * FROM record_sharing_log WHERE user_id = $1 ORDER BY shared_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    tracing::info!(
        event = "shared_records_listed",
        user_id = %auth.user_id,
        count = shared.len(),
        "Shared records listed"
    );

    Ok(HttpResponse::Ok().json(shared))
}
