use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsurancePlan {
    pub id: String,
    pub name: String,
    pub description: String,
    pub premium_paise: i64,
    pub coverage_paise: i64,
    pub min_balance_paise: i64,
    pub plan_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InsurancePolicy {
    pub id: Uuid,
    pub hsa_id: Uuid,
    pub plan_id: String,
    pub plan_name: String,
    pub premium_paise: i64,
    pub coverage_paise: i64,
    pub status: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    pub plan_id: String,
}

// ── Plan constants ───────────────────────────────────────────────────────────

/// Basic health plan: min balance 3999 INR (399_900 paise)
pub const BASIC_PLAN_ID: &str = "basic-health";
pub const BASIC_PLAN_PREMIUM_PAISE: i64 = 99_900; // Rs 999
pub const BASIC_PLAN_COVERAGE_PAISE: i64 = 10_000_000; // Rs 1 lakh
pub const BASIC_PLAN_MIN_BALANCE_PAISE: i64 = 399_900; // Rs 3999

/// Premium health plan: min balance 10000 INR (1_000_000 paise)
pub const PREMIUM_PLAN_ID: &str = "premium-health";
pub const PREMIUM_PLAN_PREMIUM_PAISE: i64 = 249_900; // Rs 2499
pub const PREMIUM_PLAN_COVERAGE_PAISE: i64 = 50_000_000; // Rs 5 lakh
pub const PREMIUM_PLAN_MIN_BALANCE_PAISE: i64 = 1_000_000; // Rs 10000

/// Accident cover plan
pub const ACCIDENT_PLAN_ID: &str = "accident-cover";
pub const ACCIDENT_PLAN_PREMIUM_PAISE: i64 = 49_900; // Rs 499
pub const ACCIDENT_PLAN_COVERAGE_PAISE: i64 = 20_000_000; // Rs 2 lakh
pub const ACCIDENT_PLAN_MIN_BALANCE_PAISE: i64 = 199_900; // Rs 1999

/// Return the list of available insurance plans (seed data).
pub fn available_plans() -> Vec<InsurancePlan> {
    vec![
        InsurancePlan {
            id: BASIC_PLAN_ID.to_string(),
            name: "Basic Health Cover".to_string(),
            description: "Basic health insurance covering hospitalization up to Rs 1 lakh"
                .to_string(),
            premium_paise: BASIC_PLAN_PREMIUM_PAISE,
            coverage_paise: BASIC_PLAN_COVERAGE_PAISE,
            min_balance_paise: BASIC_PLAN_MIN_BALANCE_PAISE,
            plan_type: "basic".to_string(),
        },
        InsurancePlan {
            id: PREMIUM_PLAN_ID.to_string(),
            name: "Premium Health Cover".to_string(),
            description: "Comprehensive health insurance covering hospitalization up to Rs 5 lakh"
                .to_string(),
            premium_paise: PREMIUM_PLAN_PREMIUM_PAISE,
            coverage_paise: PREMIUM_PLAN_COVERAGE_PAISE,
            min_balance_paise: PREMIUM_PLAN_MIN_BALANCE_PAISE,
            plan_type: "premium".to_string(),
        },
        InsurancePlan {
            id: ACCIDENT_PLAN_ID.to_string(),
            name: "Personal Accident Cover".to_string(),
            description:
                "Accident insurance covering accidental death and disability up to Rs 2 lakh"
                    .to_string(),
            premium_paise: ACCIDENT_PLAN_PREMIUM_PAISE,
            coverage_paise: ACCIDENT_PLAN_COVERAGE_PAISE,
            min_balance_paise: ACCIDENT_PLAN_MIN_BALANCE_PAISE,
            plan_type: "accident".to_string(),
        },
    ]
}

/// Find a plan by its ID.
pub fn find_plan(plan_id: &str) -> Option<InsurancePlan> {
    available_plans().into_iter().find(|p| p.id == plan_id)
}

/// Check eligibility: user's total contributions must meet the plan minimum.
pub fn check_eligibility(total_contributed_paise: i64, plan: &InsurancePlan) -> Result<(), String> {
    if total_contributed_paise < plan.min_balance_paise {
        return Err(format!(
            "Insufficient contributions. Need {} paise total contributions, have {} paise",
            plan.min_balance_paise, total_contributed_paise
        ));
    }
    Ok(())
}

/// Check if user's HSA balance is enough to pay the premium.
pub fn check_balance_for_premium(balance_paise: i64, plan: &InsurancePlan) -> Result<(), String> {
    if balance_paise < plan.premium_paise {
        return Err(format!(
            "Insufficient balance. Need {} paise, have {} paise",
            plan.premium_paise, balance_paise
        ));
    }
    Ok(())
}

/// Calculate the net balance after premium deduction.
pub fn balance_after_premium(balance_paise: i64, premium_paise: i64) -> i64 {
    balance_paise - premium_paise
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_available_plans_count() {
        assert_eq!(available_plans().len(), 3);
    }

    #[test]
    fn test_available_plans_ids() {
        let plans = available_plans();
        let ids: Vec<&str> = plans.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"basic-health"));
        assert!(ids.contains(&"premium-health"));
        assert!(ids.contains(&"accident-cover"));
    }

    #[test]
    fn test_basic_plan_thresholds() {
        let plan = find_plan("basic-health").unwrap();
        assert_eq!(plan.min_balance_paise, 399_900); // 3999 INR
        assert_eq!(plan.premium_paise, 99_900);
        assert_eq!(plan.coverage_paise, 10_000_000);
    }

    #[test]
    fn test_premium_plan_thresholds() {
        let plan = find_plan("premium-health").unwrap();
        assert_eq!(plan.min_balance_paise, 1_000_000); // 10000 INR
        assert_eq!(plan.premium_paise, 249_900);
        assert_eq!(plan.coverage_paise, 50_000_000);
    }

    #[test]
    fn test_find_plan_existing() {
        assert!(find_plan("basic-health").is_some());
        assert!(find_plan("premium-health").is_some());
        assert!(find_plan("accident-cover").is_some());
    }

    #[test]
    fn test_find_plan_nonexistent() {
        assert!(find_plan("nonexistent-plan").is_none());
        assert!(find_plan("").is_none());
    }

    #[test]
    fn test_check_eligibility_basic_eligible() {
        let plan = find_plan("basic-health").unwrap();
        assert!(check_eligibility(399_900, &plan).is_ok());
        assert!(check_eligibility(500_000, &plan).is_ok());
    }

    #[test]
    fn test_check_eligibility_basic_not_eligible() {
        let plan = find_plan("basic-health").unwrap();
        assert!(check_eligibility(399_899, &plan).is_err());
        assert!(check_eligibility(0, &plan).is_err());
    }

    #[test]
    fn test_check_eligibility_premium_eligible() {
        let plan = find_plan("premium-health").unwrap();
        assert!(check_eligibility(1_000_000, &plan).is_ok());
        assert!(check_eligibility(2_000_000, &plan).is_ok());
    }

    #[test]
    fn test_check_eligibility_premium_not_eligible() {
        let plan = find_plan("premium-health").unwrap();
        assert!(check_eligibility(999_999, &plan).is_err());
        assert!(check_eligibility(399_900, &plan).is_err());
    }

    #[test]
    fn test_check_balance_for_premium_sufficient() {
        let plan = find_plan("basic-health").unwrap();
        assert!(check_balance_for_premium(100_000, &plan).is_ok());
        assert!(check_balance_for_premium(99_900, &plan).is_ok());
    }

    #[test]
    fn test_check_balance_for_premium_insufficient() {
        let plan = find_plan("basic-health").unwrap();
        assert!(check_balance_for_premium(99_899, &plan).is_err());
        assert!(check_balance_for_premium(0, &plan).is_err());
    }

    #[test]
    fn test_balance_after_premium() {
        assert_eq!(balance_after_premium(500_000, 99_900), 400_100);
        assert_eq!(balance_after_premium(99_900, 99_900), 0);
    }

    #[test]
    fn test_premium_calculation_basic() {
        let plan = find_plan("basic-health").unwrap();
        let balance = 500_000i64;
        let remaining = balance_after_premium(balance, plan.premium_paise);
        assert_eq!(remaining, 500_000 - 99_900);
    }

    #[test]
    fn test_premium_calculation_premium() {
        let plan = find_plan("premium-health").unwrap();
        let balance = 1_000_000i64;
        let remaining = balance_after_premium(balance, plan.premium_paise);
        assert_eq!(remaining, 1_000_000 - 249_900);
    }

    #[test]
    fn test_eligibility_boundary_basic() {
        let plan = find_plan("basic-health").unwrap();
        // Exactly at threshold
        assert!(check_eligibility(BASIC_PLAN_MIN_BALANCE_PAISE, &plan).is_ok());
        // One paise below
        assert!(check_eligibility(BASIC_PLAN_MIN_BALANCE_PAISE - 1, &plan).is_err());
    }

    #[test]
    fn test_eligibility_boundary_premium() {
        let plan = find_plan("premium-health").unwrap();
        assert!(check_eligibility(PREMIUM_PLAN_MIN_BALANCE_PAISE, &plan).is_ok());
        assert!(check_eligibility(PREMIUM_PLAN_MIN_BALANCE_PAISE - 1, &plan).is_err());
    }
}
