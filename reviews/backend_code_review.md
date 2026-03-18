# Aarokya Backend Code Review

**Reviewer:** Senior Rust Engineer
**Date:** 2026-03-18
**Scope:** Full backend review -- security, correctness, financial logic, error handling
**Commit:** Pre-release audit

---

## 1. Critical Issues (Must Fix)

### C1. OTP Returned in API Response -- Production Credential Leak

**File:** `src/api/auth.rs`, line 142
**Description:** The `send_otp` handler returns the actual OTP in the HTTP response body via `otp_hint`. The comment says "Remove in production" but there is no compile-time gate, feature flag, or environment check to prevent this from shipping. Any attacker can call the endpoint and obtain the OTP without access to the user's phone.

**Impact:** Complete authentication bypass. An attacker can create accounts and impersonate any phone number.

**Suggested fix:**
```rust
// Replace lines 140-143 with:
let is_dev = std::env::var("ENVIRONMENT")
    .unwrap_or_else(|_| "development".to_string()) != "production";

Ok(HttpResponse::Ok().json(SendOtpResponse {
    message: "OTP sent successfully".to_string(),
    otp_hint: if is_dev { Some(otp) } else { None },
}))
```
Better yet, gate it behind `#[cfg(debug_assertions)]` so it is impossible in release builds.

---

### C2. CORS Allows Any Origin -- Token Theft via CSRF

**File:** `src/main.rs`, lines 42-46
**Description:** The CORS configuration uses `.allow_any_origin()`, `.allow_any_method()`, and `.allow_any_header()`. This means any website on the internet can make authenticated cross-origin requests to the API (if the browser sends cookies, or if a malicious site obtains a token through other means).

**Impact:** Enables cross-origin attacks. Combined with C1, an attacker's site can silently call the API on behalf of a logged-in user.

**Suggested fix:**
```rust
let cors = Cors::default()
    .allowed_origin("https://app.aarokya.in")   // production app
    .allowed_origin("http://localhost:3000")      // dev only; gate behind cfg
    .allowed_methods(vec!["GET", "POST", "PATCH", "DELETE"])
    .allowed_headers(vec![
        actix_web::http::header::AUTHORIZATION,
        actix_web::http::header::CONTENT_TYPE,
    ])
    .max_age(3600);
```

---

### C3. JWT Secret Has a Hardcoded Fallback -- Trivially Forgeable Tokens

**File:** `src/config/mod.rs`, lines 16-17
**Description:** When `JWT_SECRET` is not set, the code falls back to `"dev-secret-change-in-prod"`. If the environment variable is accidentally omitted in production, any attacker who reads the source code (it is open source per CLAUDE.md) can forge valid JWTs for any user, including `operator_super_admin`.

**Impact:** Full privilege escalation. Attacker can approve/reject claims, access all accounts.

**Suggested fix:**
```rust
jwt_secret: std::env::var("JWT_SECRET")
    .map_err(|_| "JWT_SECRET environment variable is required")?,
```
Fail hard if the secret is missing -- never fall back.

---

### C4. In-Memory OTP and Rate-Limit Stores Are Not Shared Across Workers

**File:** `src/main.rs`, lines 37-38; `src/api/auth.rs`, lines 38, 49
**Description:** `OtpStore` and `RateLimitStore` are `RwLock<HashMap<...>>` wrapped in `web::Data`. Because `HttpServer::new` takes a closure and Actix can spawn multiple workers, each worker gets its own clone of the `Arc` (via `web::Data`). However, `RwLock<HashMap>` is NOT shared across OS processes if `workers()` > 1 with `fork`-based workers. Even in the single-process/multi-thread model, these stores are never cleaned up -- they grow unboundedly.

**Impact:**
- Rate limiting is ineffective if Actix uses multiple workers (attacker hits different workers).
- OTP verified on a different worker than the one that generated it will fail (false rejection).
- Memory leak: old entries are never garbage-collected.

**Suggested fix:**
Use Redis (already in docker-compose per CLAUDE.md) for OTP and rate-limit storage, or at minimum add a periodic cleanup task:
```rust
// 1. Use a single worker in the meantime:
HttpServer::new(move || { ... }).workers(1)

// 2. Add a background task to prune stale entries
// 3. Migrate to Redis for multi-instance deployments
```

---

### C5. Race Condition in HSA Creation -- Duplicate Accounts Possible

**File:** `src/api/hsa.rs`, lines 28-51
**Description:** The check for an existing HSA (line 28-33) and the INSERT (line 42-51) are separate queries without a transaction or database-level UNIQUE constraint enforcement in the application code. Two concurrent requests can both pass the existence check and both insert, creating duplicate HSA accounts for the same user.

**Impact:** A user ends up with two HSA accounts. Contributions and balances become split and inconsistent.

**Suggested fix:**
```rust
// Option A: Use INSERT ... ON CONFLICT (preferred)
let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
    r#"INSERT INTO health_savings_accounts (id, user_id, abha_id, balance_paise, total_contributed_paise, insurance_eligible, status)
       VALUES ($1, $2, $3, 0, 0, false, 'active')
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *"#,
)
.bind(id)
.bind(auth.user_id)
.bind(&body.abha_id)
.fetch_optional(pool.get_ref())
.await?;

match hsa {
    Some(hsa) => Ok(HttpResponse::Created().json(hsa)),
    None => Err(AppError::Conflict("User already has an HSA account".to_string())),
}
```
Also ensure the `health_savings_accounts` table has `UNIQUE(user_id)`.

---

### C6. HSA Balance Can Go Negative -- No Database-Level Guard

**File:** `src/api/insurance.rs`, lines 68-74
**Description:** The insurance `subscribe` handler deducts the premium from the HSA balance with `balance_paise = balance_paise - $1`. Although there is an application-level check (`check_balance_for_premium`), two concurrent subscribe requests can both pass the check and both deduct, driving the balance negative.

**Impact:** Financial integrity violation. Users get free insurance.

**Suggested fix:**
Add a `CHECK (balance_paise >= 0)` constraint to the `health_savings_accounts` table, and handle the constraint violation error:
```sql
ALTER TABLE health_savings_accounts ADD CONSTRAINT balance_non_negative CHECK (balance_paise >= 0);
```
Or use `SELECT ... FOR UPDATE` within the transaction:
```rust
let hsa = sqlx::query_as::<_, HealthSavingsAccount>(
    "SELECT * FROM health_savings_accounts WHERE user_id = $1 FOR UPDATE",
)
.bind(auth.user_id)
.fetch_optional(&mut *tx)
.await?;
```

---

### C7. Bulk Contribution Commits Partial Failures Inside a Single Transaction

**File:** `src/api/partners.rs`, lines 310-425
**Description:** The `bulk_contribute` handler opens a single transaction, processes all items, `continue`s on errors (incrementing `failed`), but still calls `tx.commit()` at line 425. This means that if item 3 fails at INSERT but item 4 succeeds, the failed item's partial side-effects (if any) are committed. More critically, if any of the DB operations fail with an error that poisons the transaction (Postgres aborts the TX on error), the subsequent operations and the final commit will also fail, losing ALL work.

**Impact:** In PostgreSQL, any error inside a transaction marks it as aborted. All subsequent queries return `"current transaction is aborted"`. The entire batch silently fails while reporting partial success.

**Suggested fix:**
Use SAVEPOINTs for per-item isolation, or process each item in its own transaction:
```rust
for item in &body.contributions {
    // Use SAVEPOINT per item
    sqlx::query("SAVEPOINT item_save").execute(&mut *tx).await?;

    match process_single_contribution(&mut tx, &partner, item).await {
        Ok(_) => {
            sqlx::query("RELEASE SAVEPOINT item_save").execute(&mut *tx).await?;
            succeeded += 1;
        }
        Err(e) => {
            sqlx::query("ROLLBACK TO SAVEPOINT item_save").execute(&mut *tx).await?;
            failed += 1;
            errors.push(e);
        }
    }
}
```

---

## 2. Important Issues (Should Fix)

### I1. No Brute-Force Protection on OTP Verification

**File:** `src/api/auth.rs`, lines 146-174
**Description:** Rate limiting is applied to `send_otp` but NOT to `verify_otp`. An attacker who obtains or guesses a phone number can attempt all 1,000,000 possible 6-digit OTPs. With no rate limit on verification attempts, this is feasible in minutes.

**Suggested fix:**
Add attempt counting per phone. After 5 failed attempts, lock out the phone for 15 minutes and invalidate the OTP:
```rust
// Track failed attempts in the OTP store
pub struct OtpEntry {
    pub otp: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub ttl_secs: i64,
    pub attempts: u32,   // NEW
}
// In verify_otp, before comparing:
if entry.attempts >= 5 {
    store.remove(&phone);
    return Err(AppError::TooManyRequests("Too many verification attempts".into()));
}
entry.attempts += 1;
```

---

### I2. User Type Is Client-Controlled at Registration -- Privilege Escalation

**File:** `src/api/auth.rs`, lines 176-180
**Description:** The `user_type` field in `VerifyOtpRequest` is supplied by the client and defaults to `"customer"`. A malicious client can set `user_type` to `"operator_super_admin"` when verifying their OTP for the first time. The code at line 198 inserts this directly into the database.

**Impact:** A new user can self-assign any role, including super admin.

**Suggested fix:**
Validate `user_type` against an allow-list for self-registration:
```rust
let user_type = body
    .user_type
    .as_deref()
    .unwrap_or("customer");

if !matches!(user_type, "customer" | "partner") {
    return Err(AppError::Validation(
        "user_type must be 'customer' or 'partner'".to_string(),
    ));
}
```
Operator accounts should only be created by existing super admins via a separate admin endpoint.

---

### I3. Same JWT Secret for Access and Refresh Tokens

**File:** `src/infrastructure/auth.rs`, lines 28-66
**Description:** Both access tokens and refresh tokens are signed with the same secret key. While the `token_type` claim distinguishes them, using the same key means a compromise of one signing context compromises both. Additionally, refresh tokens (7-day lifetime) have the same signature strength as short-lived access tokens.

**Suggested fix:**
Use separate secrets, or at minimum separate keys derived from the master secret:
```rust
pub fn refresh_secret(base: &str) -> String {
    format!("{}-refresh", base)
}
```

---

### I4. Phone Number Validation Is Insufficient

**File:** `src/api/auth.rs`, lines 104-107
**Description:** The only validation is `phone.len() < 10`. This accepts inputs like `"aaaaaaaaaa"`, `"----------"`, or any 10+ character string. No regex or format check is applied.

**Suggested fix:**
```rust
let phone_re = regex_lite::Regex::new(r"^\+?[1-9]\d{9,14}$").unwrap();
if !phone_re.is_match(&phone) {
    return Err(AppError::Validation("Invalid phone number format".to_string()));
}
```

---

### I5. Insurance Subscribe Has No Idempotency Key

**File:** `src/api/insurance.rs`, lines 26-99
**Description:** The `subscribe` endpoint performs a financial operation (deducting premium from HSA balance) but has no idempotency key. The only protection is the check for an existing active policy of the same plan, but this check-and-insert is not atomic (see C6).

**Suggested fix:**
Add an `idempotency_key` field to `SubscribeRequest` and check it before processing, similar to contributions.

---

### I6. Claim Submission Has No Idempotency Key

**File:** `src/api/insurance.rs`, lines 128-178
**Description:** The `submit_claim` endpoint creates a claim record but has no idempotency protection. A network retry could create duplicate claims for the same incident.

**Suggested fix:**
Add an `idempotency_key` field to `SubmitClaimRequest` and enforce uniqueness.

---

### I7. Database Error Details Leaked to Clients

**File:** `src/infrastructure/error.rs`, lines 49-52
**Description:** The `AppError::Database` variant wraps `sqlx::Error` and the `ResponseError` implementation serializes the full error message via `self.to_string()`. This can leak table names, column names, constraint names, and internal SQL details to the client.

**Suggested fix:**
```rust
AppError::Internal(_) | AppError::Database(_) => (
    actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
    "internal_error",
),
// ...
let message = match self {
    AppError::Database(e) => {
        tracing::error!("Database error: {}", e);
        "An internal error occurred".to_string()
    }
    _ => self.to_string(),
};
```

---

### I8. Missing `FOR UPDATE` Lock on Contribution Balance Update

**File:** `src/api/contributions.rs`, lines 43-49, 90-106
**Description:** The `create_contribution` handler reads the HSA balance outside the transaction (line 43-49), then updates it inside the transaction (line 94-106). A concurrent contribution can read the same stale balance, causing `insurance_eligible` to be calculated incorrectly (based on stale `total_contributed_paise`).

**Suggested fix:**
Move the HSA fetch inside the transaction with `FOR UPDATE`:
```rust
let mut tx = pool.begin().await?;
let hsa_account = sqlx::query_as::<_, HealthSavingsAccount>(
    "SELECT * FROM health_savings_accounts WHERE user_id = $1 FOR UPDATE",
)
.bind(auth.user_id)
.fetch_optional(&mut *tx)
.await?
.ok_or_else(|| AppError::NotFound("HSA account not found".to_string()))?;
```

---

### I9. SQL Injection Detection Is Regex-Based and Easily Bypassed

**File:** `src/infrastructure/security.rs`, lines 57-91
**Description:** The `contains_sql_injection` function uses string pattern matching, which is a blocklist approach. It catches `--` (line 74) which is a common SQL comment, but this also matches legitimate inputs (e.g., date ranges like "2024-01-01 -- 2024-12-31", or text with double dashes). More importantly, it is not actually called anywhere in the request pipeline -- it is dead code.

Since all database queries use parameterized queries via SQLx (`$1`, `$2`, etc.), SQL injection is already prevented at the driver level. This function provides a false sense of security.

**Suggested fix:**
Either integrate it into an actual middleware (with care about false positives) or remove it entirely. Parameterized queries are the correct defense. Add a comment explaining the defense model:
```rust
// NOTE: SQL injection is prevented by using parameterized queries exclusively.
// This function is retained only for input logging/alerting, not blocking.
```

---

### I10. No Pagination Limit Enforcement on Claims/Policies Listings

**File:** `src/api/insurance.rs`, lines 115-122 (list_policies), lines 194-201 (list_claims)
**Description:** Both `list_policies` and `list_claims` return ALL records for the user with no pagination. A user with many claims/policies will trigger unbounded result sets.

**Suggested fix:**
Add pagination similar to `list_contributions`:
```rust
let page = params.page.unwrap_or(1).max(1);
let per_page = params.per_page.unwrap_or(20).min(100).max(1);
let offset = (page - 1) * per_page;
// ... LIMIT $2 OFFSET $3
```

---

### I11. Partner Endpoints Missing RBAC Check

**File:** `src/api/partners.rs`, lines 30-91 (register_partner), 140-229 (add_worker), 299-440 (bulk_contribute)
**Description:** The `register_partner` handler checks `auth.user_type != "partner"` (string comparison, line 35), but `add_worker`, `bulk_contribute`, `partner_dashboard`, `partner_reports`, and `list_workers` only call `fetch_partner` which checks if a partner record exists -- they do not verify the user's role. A customer who somehow gets a partner record (e.g., through a bug or direct DB manipulation) could access partner features.

**Suggested fix:**
Add explicit role checks to all partner endpoints:
```rust
require_role(&auth, &[Role::Partner])?;
```

---

## 3. Minor Issues (Nice to Fix)

### M1. Duplicate `VALID_SOURCE_TYPES` Constant

**File:** `src/api/contributions.rs`, line 15 and `src/domain/contribution.rs`, line 22
**Description:** The `VALID_SOURCE_TYPES` array is defined in both files. If one is updated without the other, validation will be inconsistent.

**Suggested fix:** Remove the duplicate in `api/contributions.rs` and import from `domain::contribution::VALID_SOURCE_TYPES`.

---

### M2. Duplicate `BASIC_INSURANCE_THRESHOLD` Constant

**File:** `src/api/partners.rs`, line 15 and `src/domain/hsa.rs`, line 39
**Description:** Same threshold duplicated. Use the canonical constant from `domain::hsa`.

---

### M3. `health_profile.rs` Is Declared but Unused

**File:** `src/domain/health_profile.rs`, `src/domain/mod.rs`
**Description:** The `HealthProfile` struct is defined and the module is declared in `mod.rs`, but it is never referenced by any API handler or other module.

---

### M4. OTP Generation Uses `rand::random::<u32>() % 1_000_000`

**File:** `src/api/auth.rs`, line 129
**Description:** Modulo bias: `u32::MAX` (4,294,967,295) is not evenly divisible by 1,000,000. The first 967,296 values (0..967295) are slightly more likely. The bias is small (~0.02%) but for security-sensitive code, using `rand::Rng::gen_range` is more correct:
```rust
use rand::Rng;
let otp = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000));
```

---

### M5. `contains_sql_injection` Matches `--` in Normal Text

**File:** `src/infrastructure/security.rs`, line 74
**Description:** The pattern `"--"` will match any text containing a double dash, such as names with em-dash, comments, or even UUID segments in certain formats. This is a false positive risk if the function is ever integrated into request validation.

---

### M6. Missing `#[serde(deny_unknown_fields)]` on Request DTOs

**Files:** Multiple request structs across `api/auth.rs`, `domain/claim.rs`, `domain/insurance.rs`
**Description:** Without `deny_unknown_fields`, clients can send arbitrary extra fields that are silently ignored. This makes it harder to detect client bugs and versioning issues.

---

### M7. Regex Compilation on Every Request in `sanitize_input`

**File:** `src/infrastructure/security.rs`, lines 28-52
**Description:** Six regexes are compiled from scratch on every call to `sanitize_input`. Use `std::sync::LazyLock` (stable since Rust 1.80) or `once_cell::sync::Lazy` for one-time compilation.

---

### M8. `chrono::Duration::days(365)` for Policy End Date

**File:** `src/api/insurance.rs`, line 78
**Description:** Using 365 days does not account for leap years. Consider using `chrono::Months` or documenting that policies are 365 calendar days, not one calendar year.

---

## 4. Positive Observations

1. **Parameterized queries throughout.** All SQL uses `$1`, `$2` bind parameters via SQLx. There is zero string interpolation of user input into SQL, which eliminates SQL injection at the driver level. This is excellent.

2. **Paise-based financial arithmetic.** All monetary values use `i64` paise, avoiding floating-point rounding errors in financial calculations. This is the correct approach for an Indian currency system.

3. **Transaction usage for financial operations.** Contributions and insurance subscriptions wrap related DB operations in explicit transactions (`pool.begin()` / `tx.commit()`). The pattern is correct even if locking could be tighter.

4. **Idempotency on contributions.** The `create_contribution` handler checks for existing contributions with the same idempotency key, which is critical for payment reliability in unreliable mobile networks.

5. **Well-structured domain layer.** Business logic (eligibility checks, tier calculations, progress functions) is extracted into `src/domain/` with pure functions that are independently testable. The separation of concerns is clean.

6. **Comprehensive test coverage.** Every domain module and most API handlers have unit tests. Boundary conditions are tested (threshold - 1, exact threshold, over threshold). Integration tests use Actix's test framework properly.

7. **RBAC with super_admin bypass.** The role system is well-designed with an explicit super_admin override and a clean `require_role` function. Refresh tokens are correctly rejected by the `AuthenticatedUser` extractor.

8. **Security headers middleware.** HSTS, CSP, X-Frame-Options, and X-Content-Type-Options are set on all responses. Request IDs enable distributed tracing.

9. **Input validation with `validator` crate.** Request DTOs use derive-based validation with clear constraints (min/max amounts, string lengths). The `CreateContributionRequest` correctly caps amounts at 100,000,000 paise (Rs 10 lakh).

10. **Structured logging.** Financial operations include structured `tracing::info!` events with relevant IDs, amounts, and states, which is essential for audit trails and debugging.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| Critical | 7 | Auth bypass, race conditions, financial integrity |
| Important | 11 | Missing rate limits, privilege escalation, data leaks |
| Minor | 8 | Code style, dead code, minor correctness |

**Top 3 priorities before any production deployment:**
1. Remove OTP from response (C1) and fix JWT secret fallback (C3)
2. Add `FOR UPDATE` locking and DB constraints to prevent negative balances (C6) and race conditions (C5, I8)
3. Validate `user_type` on registration to prevent privilege escalation (I2)
