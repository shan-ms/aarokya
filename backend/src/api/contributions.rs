use actix_web::{web, HttpResponse};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::domain::contribution::{
    Contribution, ContributionListParams, ContributionSummary, ContributionSummaryResponse,
    CreateContributionRequest, MonthlySummary,
};
use crate::domain::hsa::{self, HealthSavingsAccount};
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
    let hsa_account = sqlx::query_as::<_, HealthSavingsAccount>(
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
    .bind(hsa_account.id)
    .fetch_optional(pool.get_ref())
    .await?;

    if let Some(existing_contribution) = existing {
        tracing::info!(
            event = "contribution_idempotent_hit",
            user_id = %auth.user_id,
            hsa_id = %hsa_account.id,
            idempotency_key = %body.idempotency_key,
            "Idempotent contribution request detected"
        );
        return Ok(HttpResponse::Ok().json(existing_contribution));
    }

    // Use a transaction for double-entry atomicity
    let mut tx = pool.begin().await?;

    let contribution_id = Uuid::new_v4();
    let contribution = sqlx::query_as::<_, Contribution>(
        r#"INSERT INTO contributions (id, hsa_id, source_type, source_id, amount_paise, currency, idempotency_key, status, metadata)
           VALUES ($1, $2, $3, $4, $5, 'INR', $6, 'completed', $7)
           RETURNING *"#,
    )
    .bind(contribution_id)
    .bind(hsa_account.id)
    .bind(&body.source_type)
    .bind(body.source_id)
    .bind(body.amount_paise)
    .bind(&body.idempotency_key)
    .bind(&body.metadata)
    .fetch_one(&mut *tx)
    .await?;

    // Update HSA balance and total atomically in the same transaction
    let new_total = hsa_account.total_contributed_paise + body.amount_paise;
    let insurance_eligible = hsa::is_basic_eligible(new_total);

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
    .bind(hsa_account.id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Audit log for financial operation
    tracing::info!(
        event = "contribution_created",
        user_id = %auth.user_id,
        hsa_id = %hsa_account.id,
        contribution_id = %contribution_id,
        amount_paise = body.amount_paise,
        source_type = %body.source_type,
        idempotency_key = %body.idempotency_key,
        new_total_contributed = new_total,
        insurance_eligible = insurance_eligible,
        insurance_tier = %hsa::insurance_tier(new_total),
        "Contribution created and HSA balance updated"
    );

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
    let hsa_account = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * per_page;

    // Build dynamic query with optional filters
    let has_source = params.source_type.is_some();
    let has_date_from = params.date_from.is_some();
    let has_date_to = params.date_to.is_some();

    // Data query
    let mut query = String::from("SELECT * FROM contributions WHERE hsa_id = $1");
    let mut count_query = String::from("SELECT COUNT(*) FROM contributions WHERE hsa_id = $1");

    let mut param_idx = 2;

    if has_source {
        query.push_str(&format!(" AND source_type = ${}", param_idx));
        count_query.push_str(&format!(" AND source_type = ${}", param_idx));
        param_idx += 1;
    }

    if has_date_from {
        query.push_str(&format!(" AND created_at >= ${}", param_idx));
        count_query.push_str(&format!(" AND created_at >= ${}", param_idx));
        param_idx += 1;
    }

    if has_date_to {
        query.push_str(&format!(
            " AND created_at < ${} + INTERVAL '1 day'",
            param_idx
        ));
        count_query.push_str(&format!(
            " AND created_at < ${} + INTERVAL '1 day'",
            param_idx
        ));
        param_idx += 1;
    }

    query.push_str(&format!(
        " ORDER BY created_at DESC LIMIT ${} OFFSET ${}",
        param_idx,
        param_idx + 1
    ));

    // Build and execute the data query
    let mut data_q = sqlx::query_as::<_, Contribution>(&query).bind(hsa_account.id);
    let mut count_q = sqlx::query_as::<_, (i64,)>(&count_query).bind(hsa_account.id);

    if let Some(ref source_type) = params.source_type {
        data_q = data_q.bind(source_type.clone());
        count_q = count_q.bind(source_type.clone());
    }

    if let Some(ref date_from) = params.date_from {
        data_q = data_q.bind(*date_from);
        count_q = count_q.bind(*date_from);
    }

    if let Some(ref date_to) = params.date_to {
        data_q = data_q.bind(*date_to);
        count_q = count_q.bind(*date_to);
    }

    data_q = data_q.bind(per_page).bind(offset);

    let contributions = data_q.fetch_all(pool.get_ref()).await?;
    let total: (i64,) = count_q.fetch_one(pool.get_ref()).await?;

    tracing::info!(
        event = "contributions_listed",
        user_id = %auth.user_id,
        hsa_id = %hsa_account.id,
        page = page,
        per_page = per_page,
        total = total.0,
        "Contributions listed"
    );

    Ok(HttpResponse::Ok().json(PaginatedContributions {
        data: contributions,
        page,
        per_page,
        total: total.0,
    }))
}

pub async fn contribution_summary(
    auth: AuthenticatedUser,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AppError> {
    let hsa_account = sqlx::query_as::<_, HealthSavingsAccount>(
        "SELECT * FROM health_savings_accounts WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;

    // By source type
    let by_source = sqlx::query_as::<_, ContributionSummary>(
        r#"SELECT source_type, SUM(amount_paise) as total_paise, COUNT(*) as count
           FROM contributions
           WHERE hsa_id = $1 AND status = 'completed'
           GROUP BY source_type
           ORDER BY total_paise DESC"#,
    )
    .bind(hsa_account.id)
    .fetch_all(pool.get_ref())
    .await?;

    // By month
    let by_month = sqlx::query_as::<_, MonthlySummary>(
        r#"SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(amount_paise) as total_paise, COUNT(*) as count
           FROM contributions
           WHERE hsa_id = $1 AND status = 'completed'
           GROUP BY TO_CHAR(created_at, 'YYYY-MM')
           ORDER BY month DESC"#,
    )
    .bind(hsa_account.id)
    .fetch_all(pool.get_ref())
    .await?;

    // Grand totals
    let grand_totals: (Option<i64>, i64) = sqlx::query_as(
        r#"SELECT COALESCE(SUM(amount_paise), 0), COUNT(*)
           FROM contributions
           WHERE hsa_id = $1 AND status = 'completed'"#,
    )
    .bind(hsa_account.id)
    .fetch_one(pool.get_ref())
    .await?;

    let response = ContributionSummaryResponse {
        by_source,
        by_month,
        grand_total_paise: grand_totals.0.unwrap_or(0),
        grand_total_count: grand_totals.1,
    };

    tracing::info!(
        event = "contribution_summary_viewed",
        user_id = %auth.user_id,
        hsa_id = %hsa_account.id,
        grand_total_paise = response.grand_total_paise,
        grand_total_count = response.grand_total_count,
        "Contribution summary viewed"
    );

    Ok(HttpResponse::Ok().json(response))
}

#[cfg(test)]
mod tests {
    use crate::domain::contribution::{CreateContributionRequest, VALID_SOURCE_TYPES};
    use crate::domain::hsa;
    use validator::Validate;

    #[test]
    fn test_valid_source_types_constant() {
        assert!(VALID_SOURCE_TYPES.contains(&"self"));
        assert!(VALID_SOURCE_TYPES.contains(&"employer"));
        assert!(VALID_SOURCE_TYPES.contains(&"platform"));
        assert!(VALID_SOURCE_TYPES.contains(&"family"));
        assert!(VALID_SOURCE_TYPES.contains(&"tip"));
        assert!(VALID_SOURCE_TYPES.contains(&"csr"));
        assert!(VALID_SOURCE_TYPES.contains(&"community"));
        assert!(VALID_SOURCE_TYPES.contains(&"government"));
        assert!(!VALID_SOURCE_TYPES.contains(&"invalid"));
    }

    #[test]
    fn test_contribution_request_validation_all_fields() {
        let req = CreateContributionRequest {
            source_type: "employer".to_string(),
            source_id: Some(uuid::Uuid::new_v4()),
            amount_paise: 50000,
            idempotency_key: "unique-key-123".to_string(),
            metadata: Some(serde_json::json!({"note": "test"})),
        };
        assert!(req.validate().is_ok());
        assert!(req.validate_source_type().is_ok());
    }

    #[test]
    fn test_contribution_request_minimal() {
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_insurance_eligibility_updates_on_contribution() {
        // Before basic threshold
        let total = 300_000;
        assert!(!hsa::is_basic_eligible(total));
        assert_eq!(hsa::insurance_tier(total), "none");

        // After contribution pushes past basic threshold
        let new_total = total + 100_000; // 400_000 > 399_900
        assert!(hsa::is_basic_eligible(new_total));
        assert_eq!(hsa::insurance_tier(new_total), "basic");
    }

    #[test]
    fn test_insurance_eligibility_premium_upgrade() {
        let total = 900_000;
        assert!(hsa::is_basic_eligible(total));
        assert!(!hsa::is_premium_eligible(total));
        assert_eq!(hsa::insurance_tier(total), "basic");

        let new_total = total + 200_000; // 1_100_000 > 1_000_000
        assert!(hsa::is_premium_eligible(new_total));
        assert_eq!(hsa::insurance_tier(new_total), "premium");
    }

    #[test]
    fn test_contribution_amount_boundaries() {
        // Min valid amount
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());

        // Max valid amount
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_000,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_ok());

        // Over max
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 100_000_001,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());

        // Zero
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 0,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());

        // Negative
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: -500,
            idempotency_key: "k".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_idempotency_key_validation() {
        // Empty key
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1000,
            idempotency_key: "".to_string(),
            metadata: None,
        };
        assert!(req.validate().is_err());

        // Very long key (over 255)
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1000,
            idempotency_key: "x".repeat(256),
            metadata: None,
        };
        assert!(req.validate().is_err());

        // Max length key (255)
        let req = CreateContributionRequest {
            source_type: "self".to_string(),
            source_id: None,
            amount_paise: 1000,
            idempotency_key: "x".repeat(255),
            metadata: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_source_type_validation_method() {
        for source in VALID_SOURCE_TYPES {
            let req = CreateContributionRequest {
                source_type: source.to_string(),
                source_id: None,
                amount_paise: 1000,
                idempotency_key: "k".to_string(),
                metadata: None,
            };
            assert!(
                req.validate_source_type().is_ok(),
                "Expected '{}' to be valid",
                source
            );
        }

        let invalid_sources = vec!["bank", "loan", "credit", "", "SELF", "Self"];
        for source in invalid_sources {
            let req = CreateContributionRequest {
                source_type: source.to_string(),
                source_id: None,
                amount_paise: 1000,
                idempotency_key: "k".to_string(),
                metadata: None,
            };
            assert!(
                req.validate_source_type().is_err(),
                "Expected '{}' to be invalid",
                source
            );
        }
    }
}
