# API Documentation & OpenAPI Review — Aarokya

**Reviewer:** API Architect
**Date:** 2026-03-18
**Scope:** API design, documentation completeness, OpenAPI spec, client-server contract alignment
**Files Reviewed:**
- `backend/src/main.rs` (route definitions)
- `backend/src/api/*.rs` (all handlers)
- `backend/src/domain/*.rs` (request/response types)
- `apps/customer/src/api/*.ts` (customer app API client)
- `apps/customer/src/types/index.ts` (frontend type definitions)
- `apps/partner/src/api/*.ts` (partner app API client)
- `apps/control-center/src/lib/api.ts` (control center API client)
- `docs/` (existing documentation)

---

## 1. Critical Issues

### A1. No OpenAPI/Swagger Specification Exists

**Severity:** Critical

There is no `openapi.yaml`, `openapi.json`, or any machine-readable API specification in the repository. This means:
- No auto-generated API documentation
- No contract testing between frontend and backend
- No SDK generation for mobile clients
- API consumers must read Rust source code to understand endpoints

**Recommendation:** Generate an OpenAPI 3.1 spec. Options for Actix-web:
- [`utoipa`](https://crates.io/crates/utoipa) — Derive-based OpenAPI generation from Rust types
- [`paperclip`](https://crates.io/crates/paperclip) — Full OpenAPI integration
- Manual YAML maintained alongside code

### A2. Frontend-Backend Type Mismatch on Contribution Source Types

**Severity:** High

**Backend** (`src/domain/contribution.rs` and `src/api/contributions.rs`):
```rust
const VALID_SOURCE_TYPES: &[&str] = &[
    "self", "employer", "platform", "family", "tip", "csr", "community", "government"
];
```

**Frontend** (`apps/customer/src/types/index.ts:29-34`):
```typescript
export type ContributionSource =
  | 'self'
  | 'employer'
  | 'government'
  | 'platform_cashback'
  | 'referral';
```

Mismatches:
- Backend has `platform`, frontend has `platform_cashback`
- Backend has `family`, `tip`, `csr`, `community` — frontend doesn't
- Frontend has `referral` — backend doesn't accept it

A customer app submitting `source: "referral"` or `source: "platform_cashback"` will get a 400 validation error.

### A3. Frontend-Backend Type Mismatch on Claim Status

**Severity:** Medium

**Backend** (`src/domain/claim.rs`): statuses are `submitted`, `under_review`, `approved`, `rejected`

**Frontend** (`apps/customer/src/types/index.ts:95-100`):
```typescript
export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
```

The frontend includes `'paid'` which the backend does not support or produce.

### A4. Frontend-Backend Type Mismatch on Insurance Plan Types

**Severity:** Medium

**Backend** (`src/domain/insurance.rs`): Plans are `basic-health`, `premium-health`, `accident-cover` (IDs), with no `type` field.

**Frontend** (`apps/customer/src/types/index.ts:62`):
```typescript
export type PlanType = 'basic' | 'standard' | 'premium';
```

The frontend includes `'standard'` which doesn't exist in the backend. The backend has `accident-cover` which has no corresponding frontend type.

---

## 2. API Design Issues

### A5. Inconsistent Response Envelope

**Severity:** High

The frontend types define:
```typescript
interface ApiResponse<T> { data: T; message?: string; }
interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; hasMore: boolean; }
```

But the backend returns:
- `list_plans` → raw JSON array (no envelope)
- `subscribe` → raw `InsurancePolicy` object (no envelope)
- `list_policies` → raw JSON array (no envelope)
- `list_claims` → raw JSON array (no envelope)
- `create_contribution` → raw `Contribution` object (no envelope)
- Error responses → `{ "error": "...", "message": "..." }` (no `data` wrapper)

**None** of the backend handlers wrap responses in `{ data: T }`. The frontend API clients call `response.data` (Axios's response wrapper) but then return `response.data` which would be the raw object, not `{ data: T }`.

This means either:
- The frontend types are aspirational and not yet aligned
- Or there is a mismatch that causes runtime errors

### A6. Missing Pagination on Multiple Endpoints

**Severity:** Medium

Endpoints that return unbounded lists:
- `GET /api/v1/insurance/policies` — returns all policies, no pagination
- `GET /api/v1/claims` — returns all claims, no pagination
- `GET /api/v1/partners/workers` — returns all workers, no pagination

Only `GET /api/v1/contributions` supports pagination.

### A7. API Versioning Not Enforced

**Severity:** Low

Routes use `/api/v1/` prefix which is good, but there's no mechanism to serve multiple versions simultaneously. This is acceptable for an early-stage project.

### A8. No HATEOAS or Resource Links

**Severity:** Low

API responses don't include links to related resources. For example, a contribution response doesn't link to the HSA, and a claim response doesn't link to the policy. This is typical for a REST API but limits discoverability.

---

## 3. Documentation Gaps

### A9. No Endpoint Documentation

**Severity:** High

The `docs/` directory contains vision, PRD, design system, implementation strategy, and development/testing guides. None of these contain API endpoint documentation with:
- Request/response schemas
- Authentication requirements
- Error codes
- Rate limiting behavior
- Idempotency requirements

### A10. Handler Doc Comments Are Minimal

**Severity:** Medium

Backend handlers have brief doc comments (e.g., `/// POST /api/v1/insurance/subscribe`) but lack:
- Full request body schema
- All possible error responses
- Authentication/authorization requirements
- Idempotency behavior description
- Example requests/responses

### A11. No API Changelog

**Severity:** Low

No mechanism to track API changes across versions. Important for mobile clients that may be running older versions.

---

## 4. Endpoint Inventory

| Method | Path | Auth | Documented | Tested |
|--------|------|------|------------|--------|
| POST | `/api/v1/auth/send-otp` | No | Comment only | Integration |
| POST | `/api/v1/auth/verify-otp` | No | Comment only | Integration |
| POST | `/api/v1/auth/refresh` | No | Comment only | Integration |
| POST | `/api/v1/hsa` | JWT | Comment only | Unit only |
| GET | `/api/v1/hsa` | JWT | Comment only | No |
| GET | `/api/v1/hsa/dashboard` | JWT | Comment only | No |
| POST | `/api/v1/contributions` | JWT | Comment only | Unit only |
| GET | `/api/v1/contributions` | JWT | Comment only | No |
| GET | `/api/v1/contributions/summary` | JWT | Comment only | No |
| POST | `/api/v1/partners/register` | JWT | Comment only | Unit only |
| GET | `/api/v1/partners/me` | JWT | Comment only | No |
| POST | `/api/v1/partners/workers` | JWT | Comment only | No |
| GET | `/api/v1/partners/workers` | JWT | Comment only | No |
| POST | `/api/v1/partners/contributions/bulk` | JWT | Comment only | Unit only |
| GET | `/api/v1/partners/dashboard` | JWT | Comment only | No |
| GET | `/api/v1/partners/reports` | JWT | Comment only | No |
| GET | `/api/v1/insurance/plans` | No* | Comment only | Unit |
| POST | `/api/v1/insurance/subscribe` | JWT | Comment only | Integration |
| GET | `/api/v1/insurance/policies` | JWT | Comment only | Integration |
| POST | `/api/v1/claims` | JWT | Comment only | Integration |
| GET | `/api/v1/claims` | JWT | Comment only | Integration |
| PATCH | `/api/v1/claims/{id}/review` | JWT+RBAC | Comment only | Integration |
| GET | `/health` | No | None | No |

*`list_plans` doesn't require auth but probably should for consistency.

**23 endpoints total, 0 have formal documentation.**

---

## 5. Client-Server Contract Analysis

### A12. Customer App API Client Uses Wrong Endpoint Paths

**File:** `apps/customer/src/api/insurance.ts:42`

```typescript
export const submitClaim = async (data: SubmitClaimData) => {
  const response = await client.post('/insurance/claims', data);
```

But the backend route is `POST /api/v1/claims`, not `/api/v1/insurance/claims`. The base URL includes `/v1` but not the `/insurance` prefix for claims — claims are at `/api/v1/claims`.

### A13. Customer App HSA API Uses camelCase Field Names

**File:** `apps/customer/src/api/hsa.ts:15`

```typescript
const response = await client.post('/hsa', { abhaId });
```

But the backend `CreateHsaRequest` expects `abha_id` (snake_case). This will cause a 400 or silently ignore the field.

### A14. Customer App Insurance Subscribe Uses camelCase

**File:** `apps/customer/src/api/insurance.ts:28`

```typescript
const response = await client.post('/insurance/subscribe', { planId });
```

Backend expects `plan_id`. Same camelCase/snake_case mismatch.

---

## 6. Recommendations

1. **Add utoipa-based OpenAPI generation** — This is the most impactful single improvement. It auto-generates a spec from Rust types and doc comments.

2. **Standardize response envelope** — All endpoints should return `{ data: T, message?: string }` for consistency with frontend types.

3. **Add pagination to all list endpoints** — Use a consistent `?page=1&per_page=20` pattern.

4. **Resolve frontend-backend type mismatches** — Contribution sources, claim statuses, and plan types must be synchronized.

5. **Add serde rename** — Use `#[serde(rename_all = "camelCase")]` on all response types to match JavaScript conventions, or have the frontend use snake_case.

6. **Create `docs/api/` directory** — Minimum viable documentation: one markdown file per resource (auth, hsa, contributions, insurance, claims, partners).

---

## Summary

| Severity | Count | Theme |
|----------|-------|-------|
| Critical | 1 | No OpenAPI spec |
| High | 3 | Type mismatches, inconsistent envelope, no endpoint docs |
| Medium | 5 | Missing pagination, endpoint path mismatches, camelCase issues |
| Low | 3 | Versioning, HATEOAS, changelog |

**Top 3 Priorities:**
1. Generate an OpenAPI spec from Rust types using utoipa
2. Fix frontend-backend type and field name mismatches (these are runtime errors)
3. Standardize the response envelope across all endpoints
