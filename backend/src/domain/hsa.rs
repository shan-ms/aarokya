use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HealthSavingsAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub abha_id: String,
    pub balance_paise: i64,
    pub total_contributed_paise: i64,
    pub insurance_eligible: Option<bool>,
    pub status: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateHsaRequest {
    #[validate(length(
        min = 8,
        max = 50,
        message = "ABHA ID must be between 8 and 50 characters"
    ))]
    pub abha_id: String,
}

#[derive(Debug, Serialize)]
pub struct HsaDashboard {
    pub balance_paise: i64,
    pub total_contributed_paise: i64,
    pub insurance_eligible: bool,
    pub basic_insurance_progress: f64,
    pub premium_insurance_progress: f64,
    pub contribution_count: i64,
    pub contribution_velocity_paise_per_month: f64,
    pub insurance_tier: String,
}

/// Insurance eligibility thresholds in paise
pub const BASIC_INSURANCE_THRESHOLD: i64 = 399_900; // 3999 INR
pub const PREMIUM_INSURANCE_THRESHOLD: i64 = 1_000_000; // 10000 INR

/// Determine the insurance tier based on total contributions
pub fn insurance_tier(total_contributed_paise: i64) -> &'static str {
    if total_contributed_paise >= PREMIUM_INSURANCE_THRESHOLD {
        "premium"
    } else if total_contributed_paise >= BASIC_INSURANCE_THRESHOLD {
        "basic"
    } else {
        "none"
    }
}

/// Check if eligible for basic insurance
pub fn is_basic_eligible(total_contributed_paise: i64) -> bool {
    total_contributed_paise >= BASIC_INSURANCE_THRESHOLD
}

/// Check if eligible for premium insurance
pub fn is_premium_eligible(total_contributed_paise: i64) -> bool {
    total_contributed_paise >= PREMIUM_INSURANCE_THRESHOLD
}

/// Calculate progress toward basic insurance threshold (0.0 to 1.0)
pub fn basic_progress(total_contributed_paise: i64) -> f64 {
    (total_contributed_paise as f64 / BASIC_INSURANCE_THRESHOLD as f64).min(1.0)
}

/// Calculate progress toward premium insurance threshold (0.0 to 1.0)
pub fn premium_progress(total_contributed_paise: i64) -> f64 {
    (total_contributed_paise as f64 / PREMIUM_INSURANCE_THRESHOLD as f64).min(1.0)
}

/// Calculate contribution velocity in paise per month.
/// account_age_days: number of days the HSA has been active.
pub fn contribution_velocity(total_contributed_paise: i64, account_age_days: i64) -> f64 {
    if account_age_days <= 0 {
        // Account created today; treat the entire contribution as the velocity for 1 day extrapolated
        return total_contributed_paise as f64 * 30.0;
    }
    let months = account_age_days as f64 / 30.0;
    total_contributed_paise as f64 / months
}

/// Calculate the insurance eligibility percentage (0.0 to 100.0)
/// Uses basic threshold as the reference for eligibility percentage
pub fn insurance_eligibility_percentage(total_contributed_paise: i64) -> f64 {
    (total_contributed_paise as f64 / BASIC_INSURANCE_THRESHOLD as f64 * 100.0).min(100.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_insurance_tier_none() {
        assert_eq!(insurance_tier(0), "none");
        assert_eq!(insurance_tier(100_000), "none");
        assert_eq!(insurance_tier(399_899), "none");
    }

    #[test]
    fn test_insurance_tier_basic() {
        assert_eq!(insurance_tier(399_900), "basic");
        assert_eq!(insurance_tier(500_000), "basic");
        assert_eq!(insurance_tier(999_999), "basic");
    }

    #[test]
    fn test_insurance_tier_premium() {
        assert_eq!(insurance_tier(1_000_000), "premium");
        assert_eq!(insurance_tier(2_000_000), "premium");
    }

    #[test]
    fn test_is_basic_eligible() {
        assert!(!is_basic_eligible(0));
        assert!(!is_basic_eligible(399_899));
        assert!(is_basic_eligible(399_900));
        assert!(is_basic_eligible(1_000_000));
    }

    #[test]
    fn test_is_premium_eligible() {
        assert!(!is_premium_eligible(0));
        assert!(!is_premium_eligible(399_900));
        assert!(!is_premium_eligible(999_999));
        assert!(is_premium_eligible(1_000_000));
        assert!(is_premium_eligible(2_000_000));
    }

    #[test]
    fn test_basic_progress() {
        assert!((basic_progress(0) - 0.0).abs() < f64::EPSILON);
        assert!((basic_progress(199_950) - 0.5).abs() < 0.001);
        assert!((basic_progress(399_900) - 1.0).abs() < f64::EPSILON);
        // Should cap at 1.0
        assert!((basic_progress(1_000_000) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_premium_progress() {
        assert!((premium_progress(0) - 0.0).abs() < f64::EPSILON);
        assert!((premium_progress(500_000) - 0.5).abs() < f64::EPSILON);
        assert!((premium_progress(1_000_000) - 1.0).abs() < f64::EPSILON);
        assert!((premium_progress(2_000_000) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_contribution_velocity() {
        // 0 days: extrapolate
        let v = contribution_velocity(100_000, 0);
        assert!((v - 3_000_000.0).abs() < f64::EPSILON);

        // 30 days = 1 month
        let v = contribution_velocity(100_000, 30);
        assert!((v - 100_000.0).abs() < 0.01);

        // 60 days = 2 months
        let v = contribution_velocity(100_000, 60);
        assert!((v - 50_000.0).abs() < 0.01);
    }

    #[test]
    fn test_insurance_eligibility_percentage() {
        assert!((insurance_eligibility_percentage(0) - 0.0).abs() < f64::EPSILON);
        assert!((insurance_eligibility_percentage(199_950) - 50.0).abs() < 0.1);
        assert!((insurance_eligibility_percentage(399_900) - 100.0).abs() < f64::EPSILON);
        // Should cap at 100.0
        assert!((insurance_eligibility_percentage(1_000_000) - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_create_hsa_request_validation_valid() {
        let req = CreateHsaRequest {
            abha_id: "12345678".to_string(),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_hsa_request_validation_too_short() {
        let req = CreateHsaRequest {
            abha_id: "1234567".to_string(), // 7 chars, min is 8
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_hsa_request_validation_too_long() {
        let req = CreateHsaRequest {
            abha_id: "a".repeat(51),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_hsa_request_validation_empty() {
        let req = CreateHsaRequest {
            abha_id: "".to_string(),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_hsa_request_validation_exact_min() {
        let req = CreateHsaRequest {
            abha_id: "12345678".to_string(), // exactly 8 chars
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_hsa_request_validation_exact_max() {
        let req = CreateHsaRequest {
            abha_id: "a".repeat(50), // exactly 50 chars
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_insurance_tier_at_boundaries() {
        // Exactly at basic threshold
        assert_eq!(insurance_tier(BASIC_INSURANCE_THRESHOLD), "basic");
        // One below basic threshold
        assert_eq!(insurance_tier(BASIC_INSURANCE_THRESHOLD - 1), "none");
        // Exactly at premium threshold
        assert_eq!(insurance_tier(PREMIUM_INSURANCE_THRESHOLD), "premium");
        // One below premium threshold
        assert_eq!(insurance_tier(PREMIUM_INSURANCE_THRESHOLD - 1), "basic");
    }

    #[test]
    fn test_contribution_velocity_negative_days() {
        // Negative days treated same as 0
        let v = contribution_velocity(100_000, -5);
        assert!((v - 3_000_000.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_contribution_velocity_large_period() {
        // 365 days
        let v = contribution_velocity(1_200_000, 365);
        let expected = 1_200_000.0 / (365.0 / 30.0);
        assert!((v - expected).abs() < 0.01);
    }

    #[test]
    fn test_basic_progress_negative() {
        // Negative values should give negative progress (no artificial floor at 0)
        // This tests the function doesn't panic
        let p = basic_progress(-100);
        assert!(p < 0.0);
    }

    #[test]
    fn test_premium_progress_zero() {
        assert!((premium_progress(0) - 0.0).abs() < f64::EPSILON);
    }
}
