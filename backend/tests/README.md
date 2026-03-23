# Automated Regression Testing (ART) - Test Matrix

## Test File: `hsa_contributions_test.rs`

**Total Tests: 77**
**Modules: 3** (hsa_tests, contribution_tests, auth_integration_tests)

---

## HSA Tests (`hsa_tests` module)

### 1. Create HSA Account - Success

| Test | Description | Asserts |
|------|-------------|---------|
| `create_hsa_request_valid_abha_id` | Valid ABHA ID passes validation | Validation OK |
| `create_hsa_request_serialization_roundtrip` | JSON deserialization of CreateHsaRequest | Field values match |
| `create_hsa_only_customer_role_allowed` | Only customer user_type can create HSA | Role check passes for customer, fails for partner |
| `hsa_account_struct_serializes_correctly` | HealthSavingsAccount serializes all fields to JSON | All JSON fields present and correct |

### 2. Create HSA - Duplicate Returns Conflict

| Test | Description | Asserts |
|------|-------------|---------|
| `duplicate_hsa_returns_conflict_error` | AppError::Conflict contains correct message | Error message includes "Conflict" and "already has an HSA" |
| `abha_id_validation_too_short` | ABHA ID < 8 chars fails | Validation error |
| `abha_id_validation_too_long` | ABHA ID > 50 chars fails | Validation error |
| `abha_id_validation_empty` | Empty ABHA ID fails | Validation error |
| `abha_id_validation_boundary_min` | Exactly 8 chars passes | Validation OK |
| `abha_id_validation_boundary_max` | Exactly 50 chars passes | Validation OK |

### 3. Get HSA - Returns Correct Balance

| Test | Description | Asserts |
|------|-------------|---------|
| `hsa_balance_returned_in_paise` | Balance is serialized as integer paise | JSON value is exact integer |
| `hsa_zero_balance_initial` | New account starts at zero | balance=0, total=0, not eligible |

### 4. Get HSA - Unauthenticated Returns 401

| Test | Description | Asserts |
|------|-------------|---------|
| `unauthenticated_request_produces_401_error` | Missing auth header produces Unauthorized | Error message correct |
| `invalid_token_produces_401_error` | Garbage JWT fails decoding | Decode error |
| `expired_token_produces_error` | Expired JWT is rejected | Decode error |
| `wrong_secret_produces_error` | Wrong JWT secret fails | Decode error |

### 5. HSA Dashboard - Returns Eligibility Percentages

| Test | Description | Asserts |
|------|-------------|---------|
| `dashboard_basic_progress_at_zero` | 0 contributions = 0.0 progress | Exact 0.0 |
| `dashboard_basic_progress_at_half` | Half threshold = ~0.5 progress | Within 0.01 |
| `dashboard_basic_progress_capped_at_one` | Over threshold caps at 1.0 | Exact 1.0 |
| `dashboard_premium_progress_at_half` | Half premium threshold = 0.5 | Exact 0.5 |
| `dashboard_premium_progress_capped_at_one` | Over premium threshold caps at 1.0 | Exact 1.0 |
| `dashboard_eligibility_percentage_zero_to_hundred` | 0% at zero, 100% at threshold, capped over | Exact values |
| `dashboard_struct_serializes_all_fields` | HsaDashboard JSON has all 8 fields | All fields present |

### 6. HSA Dashboard - Basic Insurance Eligible at 399900 Paise

| Test | Description | Asserts |
|------|-------------|---------|
| `basic_eligible_at_threshold` | 399900 paise = basic eligible | is_basic_eligible=true, tier="basic" |
| `basic_not_eligible_one_below_threshold` | 399899 paise = not eligible | is_basic_eligible=false, tier="none" |
| `basic_eligible_above_threshold` | 500000 paise = basic eligible | is_basic_eligible=true, tier="basic" |

### 7. HSA Dashboard - Premium Insurance Eligible at 1000000 Paise

| Test | Description | Asserts |
|------|-------------|---------|
| `premium_eligible_at_threshold` | 1000000 paise = premium eligible | is_premium_eligible=true, tier="premium" |
| `premium_not_eligible_one_below_threshold` | 999999 paise = basic only | is_premium_eligible=false, tier="basic" |
| `premium_eligible_well_above_threshold` | 5000000 paise = premium | is_premium_eligible=true, tier="premium" |

### 8. HSA Dashboard - Not Eligible Below Threshold

| Test | Description | Asserts |
|------|-------------|---------|
| `not_eligible_at_zero` | 0 paise = no eligibility | Both basic and premium false, tier="none" |
| `not_eligible_small_balance` | 100000 paise = no eligibility | Both basic and premium false, tier="none" |
| `insurance_tier_progression` | Full tier progression from 0 to 2M paise | 8 balance/tier pairs verified |

### Dashboard Velocity Tests

| Test | Description | Asserts |
|------|-------------|---------|
| `velocity_new_account_extrapolates` | 0-day account: velocity = total * 30 | Exact value |
| `velocity_one_month_account` | 30-day account: velocity = total / 1 | Within 0.01 |
| `velocity_three_month_account` | 90-day account: velocity = total / 3 | Within 0.01 |
| `velocity_negative_days_treated_as_new` | Negative days behave as 0 days | Exact value |

---

## Contribution Tests (`contribution_tests` module)

### 1. Create Contribution - Success with Idempotency Key

| Test | Description | Asserts |
|------|-------------|---------|
| `valid_contribution_request_with_idempotency_key` | Minimal valid request passes validation | Both validate() and validate_source_type() OK |
| `valid_contribution_with_all_fields` | Full request with metadata passes validation | Validation OK |
| `contribution_request_deserialization` | JSON round-trip preserves all fields | Fields match expected values |
| `all_valid_source_types_pass_validation` | All 8 source types pass both validators | 8 source types verified |

### 2. Duplicate Idempotency Key Returns Same Result

| Test | Description | Asserts |
|------|-------------|---------|
| `idempotency_key_uniqueness_concept` | Key preserved through JSON deserialization | Key matches after roundtrip |
| `contribution_struct_serializes_for_idempotent_response` | Contribution struct serializes with idempotency_key | JSON contains key, status, amount |

### 3. Create Contribution - Updates HSA Balance Atomically

| Test | Description | Asserts |
|------|-------------|---------|
| `contribution_updates_insurance_eligibility_none_to_basic` | Contribution pushes past basic threshold | Tier changes from "none" to "basic" |
| `contribution_updates_insurance_eligibility_basic_to_premium` | Contribution pushes past premium threshold | Tier changes from "basic" to "premium" |
| `balance_arithmetic_is_exact_integer` | Paise arithmetic uses exact integers | 999999 + 1 = 1000000 exactly |
| `multiple_contributions_accumulate_correctly` | Multiple contributions sum correctly | Sum of 4 contributions = 399900 |

### 4. Create Contribution - Invalid Amount Returns 400

| Test | Description | Asserts |
|------|-------------|---------|
| `zero_amount_fails_validation` | amount_paise=0 fails | Validation error |
| `negative_amount_fails_validation` | amount_paise=-500 fails | Validation error |
| `minimum_valid_amount_is_one_paise` | amount_paise=1 passes | Validation OK |
| `maximum_valid_amount` | amount_paise=100000000 passes | Validation OK |
| `over_maximum_amount_fails` | amount_paise=100000001 fails | Validation error |
| `invalid_source_type_fails` | "invalid_source" rejected | validate_source_type() error |
| `case_sensitive_source_type` | "Self", "SELF", "Employer", "EMPLOYER" rejected | Case-sensitive validation |
| `validation_error_maps_to_bad_request` | AppError::Validation message format | Error contains "Validation" |

### 5. Create Contribution - Missing Idempotency Key Returns 400

| Test | Description | Asserts |
|------|-------------|---------|
| `empty_idempotency_key_fails_validation` | Empty string fails | Validation error |
| `idempotency_key_too_long_fails` | 256 chars fails | Validation error |
| `idempotency_key_max_length_passes` | 255 chars passes | Validation OK |
| `missing_idempotency_key_in_json_fails_deserialization` | Missing field in JSON fails | Deserialization error |

### 6. List Contributions - Pagination Works

| Test | Description | Asserts |
|------|-------------|---------|
| `pagination_params_defaults` | Empty JSON deserializes with all None | All fields None |
| `pagination_params_with_values` | page=2, per_page=50 parsed correctly | Values match |
| `pagination_offset_calculation` | page=3, per_page=20 => offset=40 | Exact offset |
| `pagination_per_page_clamped_to_100` | Requested 200 clamped to 100 | Clamped value = 100 |
| `pagination_per_page_clamped_to_minimum_1` | Requested 0 clamped to 1 | Clamped value = 1 |
| `pagination_page_clamped_to_minimum_1` | Requested -5 clamped to 1 | Clamped value = 1 |

### 7. List Contributions - Filter by Source Type

| Test | Description | Asserts |
|------|-------------|---------|
| `filter_params_with_source_type` | source_type="employer" parsed | Field matches |
| `filter_params_with_date_range` | date_from and date_to parsed as NaiveDate | Dates match |
| `filter_params_combined` | All filter params together | All fields correct |

### 8. Contribution Summary - Aggregates Correctly by Source

| Test | Description | Asserts |
|------|-------------|---------|
| `contribution_summary_struct_serialization` | ContributionSummary JSON correct | All fields present |
| `monthly_summary_struct_serialization` | MonthlySummary JSON correct | All fields present |
| `contribution_summary_response_full_serialization` | Full response with by_source and by_month | Grand totals and array lengths correct |
| `contribution_summary_aggregation_logic` | Simulated aggregation by source type | self=150000/3, employer=300000/2, tip=10000/1 |
| `empty_summary_response` | Empty summary with zero totals | Zeros and empty arrays |
| `summary_with_null_optional_fields` | Null optional fields serialize as null | JSON null values |

---

## Auth Integration Tests (`auth_integration_tests` module)

| Test | Description | Asserts |
|------|-------------|---------|
| `valid_customer_token_decodes_correctly` | Customer JWT encodes and decodes | Claims match |
| `partner_cannot_create_hsa` | Partner user_type != "customer" | Type mismatch confirmed |
| `operator_cannot_create_hsa` | Operator user_type != "customer" | Type mismatch confirmed |
| `refresh_token_not_accepted_as_access` | Refresh token has token_type="refresh" | Type is "refresh", not "access" |

---

## Running Tests

```bash
# Run all HSA/Contribution tests
cargo test --test hsa_contributions_test

# Run only HSA tests
cargo test --test hsa_contributions_test hsa_tests

# Run only contribution tests
cargo test --test hsa_contributions_test contribution_tests

# Run a specific test
cargo test --test hsa_contributions_test premium_eligible_at_threshold

# Compile check only
cargo check --test hsa_contributions_test
```

## Domain Rules Verified

| Rule | Threshold | Tests |
|------|-----------|-------|
| Basic insurance eligibility | >= 399,900 paise (INR 3,999) | 6 tests |
| Premium insurance eligibility | >= 1,000,000 paise (INR 10,000) | 5 tests |
| Contribution amount range | 1 to 100,000,000 paise | 5 tests |
| Idempotency key length | 1 to 255 characters | 4 tests |
| ABHA ID length | 8 to 50 characters | 5 tests |
| Valid source types | self, employer, platform, family, tip, csr, community, government | 3 tests |
| Money stored in paise | Integer arithmetic, never floating point | 2 tests |
| Auth: customer only for HSA | user_type must be "customer" | 3 tests |
