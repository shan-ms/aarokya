# Backend Test Suite Review

**Reviewer:** Senior QA Engineer
**Date:** 2026-03-18
**Files Reviewed:**
- `tests/hsa_contributions_test.rs`
- `tests/insurance_claims_test.rs`
- `tests/partners_auth_test.rs`
- `tests/security_test.rs`
- All corresponding source files in `src/api/`, `src/domain/`, `src/infrastructure/`

---

## 1. Missing Test Cases

### 1.1 Integer Overflow on Balance Accumulation (CRITICAL)

The `balance_paise` and `total_contributed_paise` fields are `i64`. No test verifies behavior when accumulated contributions approach `i64::MAX`. The API handler in `contributions.rs` performs `hsa_account.total_contributed_paise + body.amount_paise` in Rust before passing to SQL. If both values are large, this addition silently wraps in release mode or panics in debug mode.

**Missing tests:**
- Contribution that would cause `total_contributed_paise` to overflow `i64::MAX`
- Balance accumulation at extreme values (e.g., `i64::MAX - 1` balance + contribution of 2)
- Verify the domain or API layer rejects contributions that would cause overflow

### 1.2 Negative Balance After Premium Deduction (CRITICAL)

`balance_after_premium()` in `src/domain/insurance.rs` simply returns `balance_paise - premium_paise` with no guard against negative results. The test `balance_after_premium_exact_premium_leaves_zero` checks the zero case, but there is no test for the scenario where `balance_paise < premium_paise`. While `check_balance_for_premium()` should prevent this, a defense-in-depth test is needed to verify `balance_after_premium()` itself handles or documents the negative-result case.

**Missing test:**
- `balance_after_premium(50_000, 99_900)` returns `-49_900` -- is this acceptable? Should it clamp to 0 or error?

### 1.3 Claim Status Transition Enforcement is Incomplete (HIGH)

The tests for claim status transitions in `insurance_claims_test.rs` only verify that `is_claim_finalized()` and `is_valid_review_status()` return correct booleans independently. They do **not** test invalid transitions as a combined rule. The actual handler in `api/insurance.rs` enforces a two-step check (finalized? then valid review status?), but the domain layer has no single `is_valid_transition(from, to)` function. This means:

**Missing tests:**
- `submitted -> submitted` (should this be blocked? currently allowed since "submitted" is not finalized and the handler does not check for no-op transitions)
- `under_review -> under_review` (same no-op concern)
- `approved -> under_review` (handler correctly blocks via `is_claim_finalized`, but no explicit transition test)
- `rejected -> approved` (same)
- No test verifies the combined behavior: "if current status is X, can I transition to Y?"

**Recommendation:** Add a `is_valid_transition(current: &str, new: &str) -> bool` domain function and test the full 5x3 transition matrix (5 possible current states x 3 review statuses).

### 1.4 RBAC Permission Matrix is Incomplete (HIGH)

The RBAC tests cover claim review authorization well (operator_insurance_ops, operator_super_admin, customer, partner, operator_support, operator_analytics, unknown). However, the following permission checks present in API handlers are not tested end-to-end:

| Action | Required Role | Tested? |
|--------|--------------|---------|
| Create HSA | `customer` only (hardcoded check) | Partial -- tests `assert_ne!` on user_type, not `require_role` |
| Create contribution | Any authenticated (no role check) | Not tested for role restrictions |
| Register partner | `partner` only (hardcoded check) | Tested in `partners_auth_test.rs` |
| Add worker | Partner (implicit via `fetch_partner`) | Not explicitly role-tested |
| Bulk contribute | Partner (implicit via `fetch_partner`) | Not explicitly role-tested |
| Review claim | `OperatorInsuranceOps` or `OperatorSuperAdmin` | Well tested |
| Subscribe to insurance | Any authenticated (no role check) | Not tested -- should a partner be able to subscribe? |
| Submit claim | Any authenticated (no role check) | Not tested -- should a partner be able to file claims? |

**Missing tests:**
- Can a partner subscribe to insurance and file claims? The handlers don't prevent it.
- `operator_partner_manager` role is defined but never tested against any endpoint permission.
- The `create_hsa` handler uses a string comparison (`auth.user_type != "customer"`) instead of `require_role`, which means `operator_super_admin` CANNOT create an HSA despite being the super-admin. This inconsistency is untested.

### 1.5 Idempotency Key Edge Cases (MEDIUM)

The tests verify idempotency key validation (empty, too long, max length, deserialization). However:

**Missing tests:**
- Idempotency key with special characters (SQL injection patterns, unicode, null bytes)
- Same idempotency key used by different users for different HSAs (should succeed independently)
- Same idempotency key with different `amount_paise` or `source_type` (conflicting replay) -- the handler returns the existing contribution without checking if the new request body matches
- Idempotency key collision across different HSA accounts (the handler correctly scopes by `hsa_id`, but no test verifies this)

### 1.6 Concurrency / Race Condition Patterns (MEDIUM)

No tests simulate concurrent scenarios:

**Missing tests:**
- Two simultaneous contributions with the same idempotency key (race on the SELECT-then-INSERT)
- Two simultaneous subscribe requests for the same plan (race on the COUNT-then-INSERT for duplicate policy detection)
- Concurrent bulk contributions updating the same HSA balance
- The handler reads HSA state, computes `new_total` in Rust, then updates SQL with `balance_paise + $1`. This is safe because SQL does the addition, but `insurance_eligible` is computed in Rust based on a potentially stale `total_contributed_paise`. Under concurrent contributions, the eligibility flag could be set incorrectly.

### 1.7 Subscribe Handler Business Logic (MEDIUM)

**Missing tests:**
- Subscribing to the accident-cover plan (all domain tests focus on basic and premium; accident plan eligibility is never tested end-to-end)
- Subscribing when `total_contributed_paise` meets threshold but `balance_paise` does not (they are tested separately in domain tests but not as a combined scenario where contributed >= threshold but balance < premium due to prior withdrawals)
- Policy expiry: what happens when a policy is expired? The subscribe handler checks `status = 'active'` but there is no test for subscribing to the same plan after a prior policy expires

### 1.8 Error Response Format Verification (LOW)

The `AppError` enum maps to specific HTTP status codes and JSON error responses. Tests verify error messages via `format!("{}", err)` and string containment, but never verify:

**Missing tests:**
- The actual HTTP status code returned by `AppError::error_response()` for each variant
- The JSON response body format (`{"error": "...", "message": "..."}`)
- That `AppError::Database` maps to 500 (not leaking DB errors to client)
- That `AppError::TooManyRequests` maps to 429

### 1.9 Input Sanitization Integration (LOW)

The `security_test.rs` tests verify `sanitize_input()` and `contains_sql_injection()` as standalone functions, but there are no tests verifying these functions are actually called on incoming request data at the middleware or handler level. If the middleware is not wired up, all sanitization is inert.

---

## 2. Test Quality Issues

### 2.1 Weak RBAC Assertions Using `assert_ne!` Instead of `require_role`

In `hsa_contributions_test.rs`, tests like `partner_cannot_create_hsa` and `operator_cannot_create_hsa` use:
```rust
assert_ne!(partner.user_type, "customer");
```
This only checks a string mismatch. It does not test the actual authorization logic. If the handler logic changes from a string check to a role-based check, these tests would still pass while the behavior changes.

**Recommendation:** Replace with `assert!(require_role(&partner, &[Role::Customer]).is_err())` or test against the actual handler's authorization logic.

### 2.2 Serialization Tests Are Over-Represented

Approximately 40% of tests across all files are serialization/deserialization roundtrip tests. While useful for catching serde regressions, they provide diminishing returns since Rust's type system and serde derive macros are well-tested. The ratio of serialization tests to behavior/logic tests is disproportionate.

### 2.3 Duplicated VALID_SOURCE_TYPES Constant

`src/api/contributions.rs` defines its own `VALID_SOURCE_TYPES` constant that duplicates `src/domain/contribution.rs::VALID_SOURCE_TYPES`. If these diverge, the domain validation and API validation would disagree. No test catches this divergence.

**Recommendation:** Add a test that asserts `api::VALID_SOURCE_TYPES == domain::VALID_SOURCE_TYPES`, or eliminate the duplication.

### 2.4 Coverage Rate Can Exceed 1.0

`compute_coverage_rate()` returns `eligible_workers / total_workers` with no capping. If `eligible_workers > total_workers` (a data inconsistency bug), the rate exceeds 1.0. No test checks this defensive case.

### 2.5 `basic_progress` Accepts Negative Inputs Without Flooring

The unit test `test_basic_progress_negative` in `src/domain/hsa.rs` explicitly documents that `basic_progress(-100)` returns a negative value. This is a domain logic concern: negative progress makes no business sense. The integration test suite does not test this.

### 2.6 Flaky Pattern: Timing-Dependent OTP Tests

In `partners_auth_test.rs`, OTP expiry tests use `chrono::Duration::seconds()` manipulation. The `test_otp_entry_boundary_ttl` test with TTL=0 acknowledges it "might or might not be expired depending on timing." This is a documented flaky pattern.

### 2.7 Mock-Based Route Tests Provide Low Value

In `src/api/partners.rs`, integration tests like `test_register_partner_route_exists` use mock handlers that return hardcoded responses. These only verify that Actix-web routing is configured correctly, not that the real handlers work. Since the routes are defined in `main.rs` or `mod.rs` (not in the test app), these tests don't even verify production routing.

### 2.8 Database Integration Tests Are All `#[ignore]`

All integration tests in `src/api/insurance.rs` that exercise the full request-database-response cycle are marked `#[ignore]`. This means CI likely does not run them unless explicitly configured with `--ignored`. There is no indication in the README or CI config that these are ever run.

---

## 3. Suggestions for New Test Cases

### 3.1 Financial Arithmetic Edge Cases (CRITICAL)

```
Test: overflow_protection_on_contribution_accumulation
Description: Create an HSA with total_contributed_paise = i64::MAX - 100,
  then attempt a contribution of 200 paise. Verify the system rejects
  the contribution rather than overflowing.

Test: balance_after_premium_negative_result
Description: Call balance_after_premium(50_000, 99_900) and verify the
  result is negative (-49_900). Document whether this is intentional.
  If not, add a guard and test that it errors.

Test: maximum_paise_value_serialization
Description: Create a HealthSavingsAccount with balance_paise = i64::MAX,
  serialize to JSON, and verify the value is preserved without precision
  loss (JSON numbers are f64, which cannot represent all i64 values above
  2^53). This is a real production risk for large balances.
```

### 3.2 State Machine Transition Matrix (HIGH)

```
Test: claim_transition_matrix_exhaustive
Description: For each (current_status, new_status) pair in the 5x3 matrix:
  {submitted, under_review, approved, rejected, None} x {approved, rejected, under_review}
  Assert the expected outcome:
  - submitted -> approved: ALLOWED
  - submitted -> rejected: ALLOWED
  - submitted -> under_review: ALLOWED
  - under_review -> approved: ALLOWED
  - under_review -> rejected: ALLOWED
  - under_review -> under_review: ALLOWED (but is this desirable?)
  - approved -> *: BLOCKED (finalized)
  - rejected -> *: BLOCKED (finalized)
  - None -> *: ALLOWED (but should it be?)

Test: no_op_transition_submitted_to_submitted
Description: Verify that setting a claim from "submitted" to "submitted"
  (not a valid review status) is blocked.
```

### 3.3 RBAC Full Permission Matrix (HIGH)

```
Test: rbac_full_permission_matrix
Description: For each (role, action) pair, verify the expected outcome:
  Roles: customer, partner, operator_super_admin, operator_insurance_ops,
         operator_support, operator_analytics, operator_partner_manager
  Actions: create_hsa, create_contribution, subscribe_insurance,
           submit_claim, review_claim, register_partner, add_worker,
           bulk_contribute, view_dashboard

Test: super_admin_cannot_create_hsa_via_string_check
Description: Verify that operator_super_admin is blocked from creating
  an HSA because the handler uses string equality (user_type != "customer")
  rather than require_role. Document this as intentional or flag as a bug.
```

### 3.4 Idempotency Conflict Detection (MEDIUM)

```
Test: idempotency_key_replay_with_different_amount
Description: Create a contribution with key "abc" and amount 10000.
  Then submit another contribution with key "abc" but amount 20000.
  Verify the handler returns the original contribution (amount 10000)
  without creating a new one. Assess whether this is the correct behavior
  or if it should return a 409 Conflict when the payload differs.

Test: idempotency_key_scoped_to_hsa
Description: Two different users each submit a contribution with the
  same idempotency key "shared-key". Verify both succeed independently
  because the idempotency check is scoped by hsa_id.
```

### 3.5 Concurrency Safety (MEDIUM)

```
Test: concurrent_duplicate_hsa_creation
Description: Simulate two concurrent create_hsa requests for the same user.
  Verify the database unique constraint prevents a duplicate and the second
  request returns 409 Conflict. (Requires integration test with real DB.)

Test: concurrent_insurance_subscription
Description: Simulate two concurrent subscribe requests for the same plan.
  Verify only one policy is created and the second returns 409 Conflict.

Test: bulk_contribution_partial_failure_atomicity
Description: Submit a bulk contribution where item 3 of 5 fails.
  Verify the transaction semantics: currently the handler commits the
  entire transaction including partial successes. Test that succeeded
  items are committed and failed items are tracked in the errors array.
  Note: This means a bulk contribution is NOT atomic per-item, which
  may be a design concern.
```

### 3.6 Security Integration (MEDIUM)

```
Test: sanitize_input_called_on_request_body
Description: Submit a contribution with source_type containing
  "<script>alert(1)</script>". Verify the stored value is sanitized.
  (This test may reveal that sanitize_input is NOT called on request
  bodies, since no handler code calls it.)

Test: sql_injection_in_abha_id
Description: Create an HSA with abha_id = "'; DROP TABLE users--".
  Verify the request is either rejected by validation or safely handled
  by parameterized queries (it should be, since SQLx uses bind params,
  but the test documents the guarantee).

Test: xss_in_claim_description
Description: Submit a claim with description containing XSS payload.
  Verify the stored/returned value does not contain executable script.
```

### 3.7 Boundary Values for Insurance Plans (LOW)

```
Test: accident_plan_eligibility_at_threshold
Description: Verify accident plan eligibility at exactly 199_900 paise
  (one below) and 199_900 (at threshold). The accident plan is defined
  but has no explicit eligibility boundary tests.

Test: accident_plan_premium_deduction
Description: Verify balance_after_premium for accident plan:
  balance=199_900, premium=49_900, remaining=150_000.
```

### 3.8 Error Response HTTP Status Code Mapping (LOW)

```
Test: app_error_status_codes
Description: For each AppError variant, call error_response() and
  verify the HTTP status code:
  - NotFound -> 404
  - BadRequest -> 400
  - Unauthorized -> 401
  - Forbidden -> 403
  - Conflict -> 409
  - Validation -> 400
  - TooManyRequests -> 429
  - Internal -> 500
  - Database -> 500

Test: app_error_response_body_format
Description: Verify the JSON response body contains "error" and
  "message" keys for each AppError variant.
```

### 3.9 Coverage Rate Edge Cases (LOW)

```
Test: coverage_rate_eligible_exceeds_total
Description: Call compute_coverage_rate(15, 10). Verify behavior when
  eligible workers > total workers (data inconsistency). Currently returns
  1.5, which is likely a bug. Should cap at 1.0 or return an error.

Test: coverage_rate_negative_values
Description: Call compute_coverage_rate(-1, 10) and compute_coverage_rate(5, -10).
  Verify behavior with invalid inputs. Currently produces negative or
  unexpected results.
```

---

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| Missing: Financial arithmetic edge cases | 3 | CRITICAL |
| Missing: State machine transition coverage | 2 | HIGH |
| Missing: RBAC permission matrix | 2 | HIGH |
| Missing: Idempotency conflict scenarios | 2 | MEDIUM |
| Missing: Concurrency patterns | 3 | MEDIUM |
| Missing: Security integration | 3 | MEDIUM |
| Missing: Insurance plan boundary tests | 2 | LOW |
| Missing: Error response verification | 2 | LOW |
| Missing: Coverage rate edge cases | 2 | LOW |
| Quality: Weak assertions (assert_ne) | -- | HIGH |
| Quality: Duplicated constants | -- | MEDIUM |
| Quality: Over-represented serialization tests | -- | LOW |
| Quality: Ignored integration tests | -- | MEDIUM |
| **Total missing test cases** | **21** | |
