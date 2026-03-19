use actix_web::{web, HttpResponse};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::checkin::{
    triage_symptoms, CheckinRecord, CreateCheckinRequest, TriageResult,
};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

#[derive(Debug, Serialize)]
pub struct CheckinResponse {
    pub checkin: CheckinRecord,
    pub triage: TriageResult,
}

pub async fn create_checkin(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateCheckinRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    if body.symptoms.is_empty() {
        return Err(AppError::Validation(
            "At least one symptom is required".to_string(),
        ));
    }

    // Run triage
    let triage = triage_symptoms(&body.symptoms);

    let id = Uuid::new_v4();
    let symptoms_json = serde_json::to_value(&body.symptoms)
        .map_err(|e| AppError::Internal(format!("Failed to serialize symptoms: {}", e)))?;

    let checkin = sqlx::query_as::<_, CheckinRecord>(
        r#"INSERT INTO checkin_records (id, user_id, family_member_id, symptoms, urgency_level, recommendation, additional_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(body.family_member_id)
    .bind(&symptoms_json)
    .bind(&triage.urgency_level)
    .bind(&triage.recommendation)
    .bind(&body.additional_notes)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "checkin_created",
        user_id = %auth.user_id,
        checkin_id = %checkin.id,
        urgency_level = %triage.urgency_level,
        emergency = triage.emergency,
        "Check-in created"
    );

    Ok(HttpResponse::Created().json(CheckinResponse { checkin, triage }))
}

pub async fn list_checkins(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let checkins = sqlx::query_as::<_, CheckinRecord>(
        "SELECT * FROM checkin_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    tracing::info!(
        event = "checkins_listed",
        user_id = %auth.user_id,
        count = checkins.len(),
        "Check-ins listed"
    );

    Ok(HttpResponse::Ok().json(checkins))
}
