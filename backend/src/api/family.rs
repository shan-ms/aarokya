use actix_web::{web, HttpResponse};
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::family::{CreateFamilyMemberRequest, FamilyProfile, UpdateFamilyMemberRequest};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

pub async fn create_member(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateFamilyMemberRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    let id = Uuid::new_v4();

    let date_of_birth = body
        .date_of_birth
        .as_ref()
        .map(|d| {
            NaiveDate::parse_from_str(d, "%Y-%m-%d").map_err(|_| {
                AppError::Validation("Invalid date format. Use YYYY-MM-DD".to_string())
            })
        })
        .transpose()?;

    let allergies_json = body
        .allergies
        .as_ref()
        .map(|a| serde_json::to_value(a).unwrap_or_default());

    let chronic_conditions_json = body
        .chronic_conditions
        .as_ref()
        .map(|c| serde_json::to_value(c).unwrap_or_default());

    let member = sqlx::query_as::<_, FamilyProfile>(
        r#"INSERT INTO family_profiles (id, caregiver_user_id, member_name, relationship, date_of_birth, gender, blood_group, allergies, chronic_conditions, emergency_contact)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *"#,
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&body.member_name)
    .bind(&body.relationship)
    .bind(date_of_birth)
    .bind(&body.gender)
    .bind(&body.blood_group)
    .bind(&allergies_json)
    .bind(&chronic_conditions_json)
    .bind(&body.emergency_contact)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "family_member_created",
        user_id = %auth.user_id,
        member_id = %member.id,
        relationship = %body.relationship,
        "Family member created"
    );

    Ok(HttpResponse::Created().json(member))
}

pub async fn list_members(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let members = sqlx::query_as::<_, FamilyProfile>(
        "SELECT * FROM family_profiles WHERE caregiver_user_id = $1 AND status = 'active' ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(pool.get_ref())
    .await?;

    tracing::info!(
        event = "family_members_listed",
        user_id = %auth.user_id,
        count = members.len(),
        "Family members listed"
    );

    Ok(HttpResponse::Ok().json(members))
}

pub async fn get_member(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let member_id = path.into_inner();

    let member = sqlx::query_as::<_, FamilyProfile>(
        "SELECT * FROM family_profiles WHERE id = $1 AND caregiver_user_id = $2",
    )
    .bind(member_id)
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Family member not found".to_string()))?;

    tracing::info!(
        event = "family_member_viewed",
        user_id = %auth.user_id,
        member_id = %member.id,
        "Family member viewed"
    );

    Ok(HttpResponse::Ok().json(member))
}

pub async fn update_member(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateFamilyMemberRequest>,
) -> Result<HttpResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

    let member_id = path.into_inner();

    // Verify member belongs to user
    let existing = sqlx::query_as::<_, FamilyProfile>(
        "SELECT * FROM family_profiles WHERE id = $1 AND caregiver_user_id = $2",
    )
    .bind(member_id)
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Family member not found".to_string()))?;

    let member_name = body.member_name.as_deref().unwrap_or(&existing.member_name);

    let date_of_birth =
        if let Some(ref d) = body.date_of_birth {
            Some(NaiveDate::parse_from_str(d, "%Y-%m-%d").map_err(|_| {
                AppError::Validation("Invalid date format. Use YYYY-MM-DD".to_string())
            })?)
        } else {
            existing.date_of_birth
        };

    let gender = body.gender.as_deref().or(existing.gender.as_deref());
    let blood_group = body
        .blood_group
        .as_deref()
        .or(existing.blood_group.as_deref());
    let emergency_contact = body
        .emergency_contact
        .as_deref()
        .or(existing.emergency_contact.as_deref());

    let allergies_json = if let Some(ref a) = body.allergies {
        Some(serde_json::to_value(a).unwrap_or_default())
    } else {
        existing.allergies
    };

    let chronic_conditions_json = if let Some(ref c) = body.chronic_conditions {
        Some(serde_json::to_value(c).unwrap_or_default())
    } else {
        existing.chronic_conditions
    };

    let member = sqlx::query_as::<_, FamilyProfile>(
        r#"UPDATE family_profiles
           SET member_name = $1, date_of_birth = $2, gender = $3, blood_group = $4,
               allergies = $5, chronic_conditions = $6, emergency_contact = $7, updated_at = NOW()
           WHERE id = $8 AND caregiver_user_id = $9
           RETURNING *"#,
    )
    .bind(member_name)
    .bind(date_of_birth)
    .bind(gender)
    .bind(blood_group)
    .bind(&allergies_json)
    .bind(&chronic_conditions_json)
    .bind(emergency_contact)
    .bind(member_id)
    .bind(auth.user_id)
    .fetch_one(pool.get_ref())
    .await?;

    tracing::info!(
        event = "family_member_updated",
        user_id = %auth.user_id,
        member_id = %member.id,
        "Family member updated"
    );

    Ok(HttpResponse::Ok().json(member))
}

pub async fn delete_member(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let member_id = path.into_inner();

    let result = sqlx::query(
        r#"UPDATE family_profiles
           SET status = 'deleted', updated_at = NOW()
           WHERE id = $1 AND caregiver_user_id = $2"#,
    )
    .bind(member_id)
    .bind(auth.user_id)
    .execute(pool.get_ref())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Family member not found".to_string()));
    }

    tracing::info!(
        event = "family_member_deleted",
        user_id = %auth.user_id,
        member_id = %member_id,
        "Family member deleted"
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Family member deleted successfully"
    })))
}
