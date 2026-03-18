use actix_web::{web, HttpResponse};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::hsa::{
    self, CreateHsaRequest, HsaDashboard, HealthSavingsAccount,
};
use crate::infrastructure::auth::AuthenticatedUser;
use crate::infrastructure::error::AppError;

pub async fn create_hsa(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
    body: web::Json<CreateHsaRequest>,
) -> Result<HttpResponse, AppError> {
    // Validate input
    body.validate()
        .map_err(|e| AppError::Validation(format!("{}", e)))?;

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

    // Audit log
    tracing::info!(
        event = "hsa_created",
        user_id = %auth.user_id,
        hsa_id = %hsa.id,
        abha_id = %body.abha_id,
        "HSA account created"
    );

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

    tracing::info!(
        event = "hsa_viewed",
        user_id = %auth.user_id,
        hsa_id = %hsa.id,
        "HSA account viewed"
    );

    Ok(HttpResponse::Ok().json(hsa))
}

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

    // Calculate account age in days for velocity
    let account_age_days = hsa
        .created_at
        .map(|created| {
            let now = chrono::Utc::now();
            (now - created).num_days()
        })
        .unwrap_or(0);

    let velocity = hsa::contribution_velocity(hsa.total_contributed_paise, account_age_days);

    let dashboard = HsaDashboard {
        balance_paise: hsa.balance_paise,
        total_contributed_paise: hsa.total_contributed_paise,
        insurance_eligible: hsa.insurance_eligible.unwrap_or(false),
        basic_insurance_progress: hsa::basic_progress(hsa.total_contributed_paise),
        premium_insurance_progress: hsa::premium_progress(hsa.total_contributed_paise),
        contribution_count: contribution_count.0,
        contribution_velocity_paise_per_month: velocity,
        insurance_tier: hsa::insurance_tier(hsa.total_contributed_paise).to_string(),
    };

    tracing::info!(
        event = "dashboard_viewed",
        user_id = %auth.user_id,
        hsa_id = %hsa.id,
        balance_paise = hsa.balance_paise,
        insurance_tier = %dashboard.insurance_tier,
        "Dashboard viewed"
    );

    Ok(HttpResponse::Ok().json(dashboard))
}

#[cfg(test)]
mod tests {
    use crate::domain::hsa;

    #[test]
    fn test_dashboard_insurance_tier_logic() {
        // Verify the domain functions used by dashboard
        assert_eq!(hsa::insurance_tier(0), "none");
        assert_eq!(hsa::insurance_tier(399_900), "basic");
        assert_eq!(hsa::insurance_tier(1_000_000), "premium");
    }

    #[test]
    fn test_dashboard_progress_calculations() {
        let basic = hsa::basic_progress(200_000);
        assert!(basic > 0.0 && basic < 1.0);

        let premium = hsa::premium_progress(500_000);
        assert!(premium > 0.0 && premium < 1.0);
    }

    #[test]
    fn test_dashboard_velocity_new_account() {
        let velocity = hsa::contribution_velocity(100_000, 0);
        assert_eq!(velocity, 3_000_000.0); // extrapolated for 30 days
    }

    #[test]
    fn test_dashboard_velocity_established_account() {
        let velocity = hsa::contribution_velocity(300_000, 90);
        // 90 days = 3 months, so velocity = 300000 / 3 = 100000
        assert!((velocity - 100_000.0).abs() < 0.01);
    }

    #[test]
    fn test_eligibility_thresholds() {
        // Basic threshold: 399900 paise = 3999 INR
        assert!(!hsa::is_basic_eligible(399_899));
        assert!(hsa::is_basic_eligible(399_900));

        // Premium threshold: 1000000 paise = 10000 INR
        assert!(!hsa::is_premium_eligible(999_999));
        assert!(hsa::is_premium_eligible(1_000_000));
    }

    #[test]
    fn test_insurance_eligibility_percentage() {
        assert!((hsa::insurance_eligibility_percentage(0) - 0.0).abs() < f64::EPSILON);
        assert!((hsa::insurance_eligibility_percentage(399_900) - 100.0).abs() < f64::EPSILON);
        // Over 100% should cap at 100
        assert!((hsa::insurance_eligibility_percentage(800_000) - 100.0).abs() < f64::EPSILON);
    }
}
