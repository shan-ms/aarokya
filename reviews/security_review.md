# Security Review — Aarokya Platform

**Reviewer:** Security Engineer
**Date:** 2026-03-18
**Scope:** Authentication, authorization, input validation, data protection, infrastructure security
**Files Reviewed:**
- `backend/src/api/auth.rs`
- `backend/src/infrastructure/auth.rs`
- `backend/src/infrastructure/security.rs`
- `backend/src/infrastructure/error.rs`
- `backend/src/config/mod.rs`
- `backend/src/main.rs`
- `apps/customer/src/api/client.ts`
- `apps/control-center/src/lib/auth.ts`
- `apps/control-center/src/lib/rbac.ts`
- `docker/docker-compose.prod.yml`

---

## 1. Critical Vulnerabilities

### S1. OTP Returned in API Response — Complete Authentication Bypass

**File:** `backend/src/api/auth.rs:140-143`
**CVSS:** 9.8 (Critical)

The `send_otp` handler returns the actual OTP in the response body (`otp_hint: Some(otp)`). The comment says "Remove in production" but there is no environment check, feature flag, or compile-time guard. Since this is an open-source project, any attacker can read the source, call the endpoint, and authenticate as any phone number.

**Attack scenario:**
1. Attacker calls `POST /api/v1/auth/send-otp` with victim's phone
2. Response contains `otp_hint: "482917"`
3. Attacker calls `POST /api/v1/auth/verify-otp` with that OTP
4. Attacker receives valid JWT for victim's account

**Remediation:**
```rust
#[cfg(debug_assertions)]
let otp_hint = Some(otp.clone());
#[cfg(not(debug_assertions))]
let otp_hint: Option<String> = None;
```

### S2. JWT Secret Hardcoded Fallback — Token Forgery

**File:** `backend/src/config/mod.rs:16-17`
**CVSS:** 9.1 (Critical)

```rust
jwt_secret: std::env::var("JWT_SECRET")
    .unwrap_or_else(|_| "dev-secret-change-in-prod".to_string()),
```

If `JWT_SECRET` is not set in production, any attacker can forge JWTs for any user, including `operator_super_admin`, using the publicly known fallback.

**Remediation:** Fail hard if `JWT_SECRET` is missing:
```rust
jwt_secret: std::env::var("JWT_SECRET")
    .map_err(|_| "JWT_SECRET must be set")?,
```

### S3. User Type Self-Assignment — Privilege Escalation to Super Admin

**File:** `backend/src/api/auth.rs:176-180`
**CVSS:** 8.8 (High)

During OTP verification, the client can supply any `user_type` string. A malicious client can set `user_type` to `"operator_super_admin"` during first-time registration. The code at line 198 inserts this directly into the database with no validation.

**Attack scenario:**
```json
POST /api/v1/auth/verify-otp
{
  "phone": "+919999999999",
  "otp": "123456",
  "user_type": "operator_super_admin"
}
```
The attacker is now a super admin who can approve claims, access all accounts, and manage the platform.

**Remediation:**
```rust
if !matches!(user_type.as_str(), "customer" | "partner") {
    return Err(AppError::Validation("Invalid user_type".to_string()));
}
```

### S4. CORS Allows Any Origin — Cross-Origin Attacks

**File:** `backend/src/main.rs:42-46`
**CVSS:** 7.5 (High)

```rust
let cors = Cors::default()
    .allow_any_origin()
    .allow_any_method()
    .allow_any_header()
```

Any website can make authenticated cross-origin requests to the API. Combined with S1, a malicious site can:
1. Silently obtain OTPs for any phone number
2. Authenticate as any user
3. Access/modify financial data

**Remediation:** Whitelist specific origins.

---

## 2. High-Severity Issues

### S5. No Brute-Force Protection on OTP Verification

**File:** `backend/src/api/auth.rs:146-174`
**Severity:** High

Rate limiting is applied to `send_otp` but NOT to `verify_otp`. A 6-digit OTP has 1,000,000 possibilities. Without rate limiting on verification, an attacker can enumerate all OTPs in minutes.

**Remediation:** Track verification attempts per phone. Lock after 5 failed attempts.

### S6. Same Secret for Access and Refresh Tokens

**File:** `backend/src/infrastructure/auth.rs:28-66`
**Severity:** High

Both token types use the same `jwt_secret`. Compromise of the signing context for one compromises both. Refresh tokens (7-day lifetime) should use a separate derived key.

### S7. In-Memory OTP/Rate-Limit Stores Not Shared Across Workers

**File:** `backend/src/main.rs:37-38`
**Severity:** High

OTP and rate-limit stores use `RwLock<HashMap>`. With multiple Actix workers:
- Rate limiting is per-worker (attacker targets different workers)
- OTP verified on wrong worker fails (false rejection)
- No cleanup — unbounded memory growth

**Remediation:** Use Redis (already in docker-compose).

### S8. Database Error Details Leaked to Clients

**File:** `backend/src/infrastructure/error.rs:49-57`
**Severity:** High

The `AppError::Database` variant serializes the full `sqlx::Error` to the client via `self.to_string()`. This leaks table names, column names, constraint details, and internal SQL.

```rust
// Current: message: self.to_string()
// This returns: "Database error: error returned from database: ..."
```

**Remediation:** Log the full error server-side, return generic message to client.

### S9. Phone Number Validation Is Insufficient

**File:** `backend/src/api/auth.rs:104-107`
**Severity:** Medium

Validation is only `phone.len() < 10`. This accepts `"aaaaaaaaaa"`, `"----------"`, or any 10+ character string. No format checking.

**Remediation:** Use a regex: `^\+?[1-9]\d{9,14}$`

---

## 3. Frontend Security Issues

### S10. JWT Token Stored in localStorage (Control Center)

**File:** `apps/control-center/src/lib/auth.ts:1-11`
**Severity:** Medium

```typescript
const TOKEN_KEY = 'aarokya_cc_token';
localStorage.setItem(TOKEN_KEY, token);
```

Tokens in localStorage are accessible to any JavaScript running on the page, including XSS payloads. For a financial/healthcare platform, this is a significant risk.

**Remediation:** Use httpOnly cookies for the control center (a web application), or implement a Backend-For-Frontend (BFF) pattern.

### S11. JWT Payload Parsed via atob() Without Validation

**File:** `apps/control-center/src/lib/auth.ts:34-37`
**Severity:** Medium

```typescript
const payload = JSON.parse(atob(token.split('.')[1]));
const expiry = payload.exp * 1000;
return Date.now() < expiry;
```

The token payload is decoded client-side without signature verification. If an attacker can inject a crafted token into localStorage, `isAuthenticated()` will return true, potentially giving access to the control center UI (though API calls would fail).

### S12. Customer App Auth Store Not Persisted

**File:** `apps/customer/src/store/authStore.ts`
**Severity:** Low (but noteworthy)

The Zustand store has no persistence middleware. On app restart, the user is logged out. This is actually safer than persisting tokens insecurely, but it impacts UX.

### S13. No Token Refresh Mechanism on 401 in Customer App

**File:** `apps/customer/src/api/client.ts:26-34`
**Severity:** Medium

When a 401 is received, the interceptor calls `logout()` immediately. There is no attempt to use the refresh token first. This means users get forcefully logged out whenever their access token expires (24 hours), instead of silently refreshing.

---

## 4. Input Sanitization Assessment

### S14. `sanitize_input` and `contains_sql_injection` Are Dead Code

**Files:** `backend/src/infrastructure/security.rs:24-91`
**Severity:** Medium

Both functions are defined but never called in any middleware or handler. The `sanitize_input` function is not integrated into the request pipeline. Input sanitization is effectively absent.

However, SQL injection is not a real risk because all queries use parameterized binds via SQLx. The XSS sanitization would only matter if the backend stores and serves HTML content, which it doesn't currently.

**Recommendation:** Either integrate `sanitize_input` into a middleware or remove the dead code to avoid a false sense of security.

### S15. Regex Recompilation on Every Call

**File:** `backend/src/infrastructure/security.rs:28-50`
**Severity:** Low (performance)

Six regexes are compiled from scratch on every call to `sanitize_input`. Use `std::sync::LazyLock` for one-time compilation.

---

## 5. Infrastructure Security

### S16. Redis Exposed Without Authentication (Dev)

**File:** `docker/docker-compose.yml:30-31`
**Severity:** High (in dev environments on shared networks)

Dev Redis has no password and is bound to `0.0.0.0`. If a developer runs this on a shared network, Redis is openly accessible.

### S17. Redis Password in Process List (Prod)

**File:** `docker/docker-compose.prod.yml:54`
**Severity:** Medium

```yaml
test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
```

The `-a` flag exposes the password in `ps` output.

### S18. No Network Segmentation in Production Docker

**File:** `docker/docker-compose.prod.yml`
**Severity:** Medium

All services share one network. The control center can directly access Postgres and Redis, which it should never need.

---

## 6. Positive Security Observations

1. **Parameterized queries throughout** — Zero string interpolation in SQL. SQL injection is effectively impossible at the driver level.

2. **Access/refresh token separation** — The `AuthenticatedUser` extractor correctly rejects refresh tokens for protected routes (auth.rs:104-108).

3. **Security headers middleware** — HSTS, CSP (`default-src 'self'`), X-Frame-Options (DENY), X-Content-Type-Options (nosniff), X-XSS-Protection are all set.

4. **Request ID tracking** — Every response includes `X-Request-Id` for correlation.

5. **Body size limiting** — JSON payloads are limited to 1 MB by default, preventing denial-of-service via large payloads.

6. **IP-based rate limiting infrastructure** — The `check_ip_rate_limit` function exists with configurable windows and proper pruning. It just needs to be applied more broadly.

7. **RBAC with super_admin bypass** — Well-structured role system with clean `require_role` checks.

8. **Financial amount validation** — Contribution amounts are capped at 100,000,000 paise (Rs 10 lakh) via the `validator` crate.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 4 | Auth bypass (OTP leak, JWT secret, user_type, CORS) |
| High | 5 | Brute force, token architecture, error leaks, dev Redis |
| Medium | 6 | localStorage tokens, dead sanitization, network segmentation |
| Low | 2 | Regex performance, store persistence |

**Top 3 Immediate Actions:**
1. **Remove OTP from response** (S1) and **remove JWT secret fallback** (S2) — these are one-line fixes that eliminate two critical vulnerabilities
2. **Validate user_type on registration** (S3) — prevents privilege escalation to super admin
3. **Restrict CORS origins** (S4) — prevents cross-origin attacks against all endpoints
