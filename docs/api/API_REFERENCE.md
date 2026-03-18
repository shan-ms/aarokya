# Aarokya API Reference

Base URL: `http://localhost:8080` (development) | `https://api.aarokya.in` (production)

All monetary values are in **paise** (1 INR = 100 paise).

---

## Quick Start

```bash
# 1. Send OTP
curl -X POST http://localhost:8080/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# 2. Verify OTP and get tokens
curl -X POST http://localhost:8080/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'

# 3. Use the access_token for authenticated requests
curl http://localhost:8080/api/v1/hsa \
  -H "Authorization: Bearer <access_token>"
```

---

## Authentication

Aarokya uses phone OTP-based authentication with JWT tokens.

### Flow

1. **Send OTP** - `POST /api/v1/auth/send-otp` with a phone number.
2. **Verify OTP** - `POST /api/v1/auth/verify-otp` with phone + OTP. Returns an `access_token` (24h) and a `refresh_token` (7 days). New users are created automatically.
3. **Use access token** - Include `Authorization: Bearer <access_token>` on all protected endpoints.
4. **Refresh** - When the access token expires, call `POST /api/v1/auth/refresh` with the refresh token to get a new access token.

### Token Types

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access token | 24 hours (configurable) | API authentication |
| Refresh token | 7 days | Obtain new access tokens |

### User Types

| Type | Description |
|------|-------------|
| `customer` | Gig workers (default) |
| `partner` | Employers/platforms |
| `operator_super_admin` | Full system access |
| `operator_insurance_ops` | Claims review |
| `operator_support` | Customer support |
| `operator_analytics` | Read-only analytics |
| `operator_partner_manager` | Partner management |

---

## Security

### Headers

Every response includes the following security headers:

| Header | Value |
|--------|-------|
| `X-Request-Id` | Unique UUID for request tracing |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-XSS-Protection` | `1; mode=block` |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'` |

### Request Body Limits

| Endpoint type | Max size |
|---------------|----------|
| Standard JSON | 1 MB |
| File uploads | 10 MB |

### Input Sanitization

All string inputs are sanitized to remove:
- `<script>` tags and JavaScript URIs
- HTML event handler attributes (`onerror`, `onclick`, etc.)
- Dangerous HTML elements (`<iframe>`, `<object>`, `<embed>`, `<form>`)

SQL injection patterns are detected and rejected.

---

## Rate Limiting

### OTP Endpoint

- **Limit:** 5 requests per phone number per 10-minute window.
- Exceeding returns `400 Bad Request`.

### General API

- **Default:** 100 requests per IP per 60-second window.
- Configurable per endpoint.
- When rate-limited, the response is `429 Too Many Requests`.

---

## Endpoints

### Health

#### `GET /health`

Check server health.

```bash
curl http://localhost:8080/health
```

**Response 200:**
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

---

### Auth

#### `POST /api/v1/auth/send-otp`

Send a one-time password to a phone number.

```bash
curl -X POST http://localhost:8080/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number (min 10 chars) |

**Response 200:**
```json
{
  "message": "OTP sent successfully",
  "otp_hint": "123456"
}
```

> Note: `otp_hint` is only present in development mode.

---

#### `POST /api/v1/auth/verify-otp`

Verify OTP and receive JWT tokens. Creates a new user if one does not exist.

```bash
curl -X POST http://localhost:8080/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456", "user_type": "customer"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number |
| `otp` | string | Yes | 6-digit OTP |
| `user_type` | string | No | `customer` (default) or `partner` |

**Response 200:**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_type": "customer",
  "is_new_user": true
}
```

---

#### `POST /api/v1/auth/refresh`

Exchange a refresh token for a new access token.

```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOi..."}'
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOi..."
}
```

---

### HSA (Health Savings Account)

#### `POST /api/v1/hsa`

Create a Health Savings Account. Requires `customer` role.

```bash
curl -X POST http://localhost:8080/api/v1/hsa \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"abha_id": "ABHA-12345678"}'
```

**Response 201:**
```json
{
  "id": "...",
  "user_id": "...",
  "abha_id": "ABHA-12345678",
  "balance_paise": 0,
  "total_contributed_paise": 0,
  "insurance_eligible": false,
  "status": "active"
}
```

---

#### `GET /api/v1/hsa`

Get the current user's HSA details.

```bash
curl http://localhost:8080/api/v1/hsa \
  -H "Authorization: Bearer <token>"
```

---

#### `GET /api/v1/hsa/dashboard`

Get HSA dashboard with insurance progress and contribution velocity.

```bash
curl http://localhost:8080/api/v1/hsa/dashboard \
  -H "Authorization: Bearer <token>"
```

**Response 200:**
```json
{
  "balance_paise": 500000,
  "total_contributed_paise": 750000,
  "insurance_eligible": true,
  "basic_insurance_progress": 1.0,
  "premium_insurance_progress": 0.75,
  "contribution_count": 15,
  "contribution_velocity_paise_per_month": 100000.0,
  "insurance_tier": "basic"
}
```

---

### Contributions

#### `POST /api/v1/contributions`

Create a contribution to the user's HSA. Requires an `idempotency_key`.

```bash
curl -X POST http://localhost:8080/api/v1/contributions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "self",
    "amount_paise": 50000,
    "idempotency_key": "contrib-2024-01-15-001"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_type` | string | Yes | One of: `self`, `employer`, `platform`, `family`, `tip`, `csr`, `community`, `government` |
| `amount_paise` | integer | Yes | Amount in paise (1 to 100,000,000) |
| `idempotency_key` | string | Yes | Unique key (1-255 chars) |
| `source_id` | uuid | No | Contributing entity ID |
| `metadata` | object | No | Arbitrary JSON metadata |

---

#### `GET /api/v1/contributions`

List contributions with pagination and optional filters.

```bash
curl "http://localhost:8080/api/v1/contributions?page=1&per_page=20&source_type=self" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max 100) |
| `source_type` | string | - | Filter by source type |
| `date_from` | date | - | Filter from date (inclusive) |
| `date_to` | date | - | Filter to date (inclusive) |

---

#### `GET /api/v1/contributions/summary`

Get contribution summary grouped by source type and month.

```bash
curl http://localhost:8080/api/v1/contributions/summary \
  -H "Authorization: Bearer <token>"
```

---

### Insurance

#### `GET /api/v1/insurance/plans`

List available insurance plans. No authentication required.

```bash
curl http://localhost:8080/api/v1/insurance/plans
```

**Response 200:**
```json
[
  {
    "id": "basic-health",
    "name": "Basic Health Cover",
    "premium_paise": 99900,
    "coverage_paise": 10000000,
    "min_balance_paise": 399900
  }
]
```

---

#### `POST /api/v1/insurance/subscribe`

Subscribe to an insurance plan. Deducts the premium from HSA balance.

**Eligibility thresholds:**
- Basic plans: total contributions >= 3,999 INR (399,900 paise)
- Premium plans: total contributions >= 10,000 INR (1,000,000 paise)

```bash
curl -X POST http://localhost:8080/api/v1/insurance/subscribe \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": "basic-health"}'
```

---

#### `GET /api/v1/insurance/policies`

List the authenticated user's insurance policies.

```bash
curl http://localhost:8080/api/v1/insurance/policies \
  -H "Authorization: Bearer <token>"
```

---

### Claims

#### `POST /api/v1/claims`

Submit an insurance claim against an active policy.

```bash
curl -X POST http://localhost:8080/api/v1/claims \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "550e8400-e29b-41d4-a716-446655440000",
    "claim_type": "hospitalization",
    "amount_paise": 500000,
    "hospital_name": "Apollo Hospital",
    "diagnosis": "Appendicitis",
    "document_urls": ["https://example.com/doc1.pdf"],
    "description": "Emergency surgery"
  }'
```

---

#### `GET /api/v1/claims`

List the authenticated user's claims.

```bash
curl http://localhost:8080/api/v1/claims \
  -H "Authorization: Bearer <token>"
```

---

#### `PATCH /api/v1/claims/{id}/review`

Review a claim. **Requires `operator_insurance_ops` or `operator_super_admin` role.**

Approving a claim credits the claim amount to the user's HSA.

```bash
curl -X PATCH http://localhost:8080/api/v1/claims/550e8400-e29b-41d4-a716-446655440000/review \
  -H "Authorization: Bearer <operator_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "review_notes": "Documentation verified"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `approved`, `rejected`, or `under_review` |
| `review_notes` | string | No | Reviewer comments |

---

### Partners

#### `POST /api/v1/partners/register`

Register as a partner. Requires `partner` user type.

```bash
curl -X POST http://localhost:8080/api/v1/partners/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Logistics Pvt Ltd",
    "partner_type": "employer",
    "gstin": "22AAAAA0000A1Z5",
    "contact_email": "hr@acme.com",
    "contact_phone": "+919876543210"
  }'
```

**Partner types:** `employer`, `platform`, `ngo`, `government`

---

#### `GET /api/v1/partners/me`

Get partner profile with worker count and contribution stats.

```bash
curl http://localhost:8080/api/v1/partners/me \
  -H "Authorization: Bearer <token>"
```

---

#### `POST /api/v1/partners/workers`

Add a worker to the partner. Provide at least one of `worker_phone` or `abha_id`.

```bash
curl -X POST http://localhost:8080/api/v1/partners/workers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"worker_phone": "+919876543210", "external_worker_id": "EMP-001"}'
```

---

#### `GET /api/v1/partners/workers`

List workers with their HSA and insurance status.

```bash
curl http://localhost:8080/api/v1/partners/workers \
  -H "Authorization: Bearer <token>"
```

---

#### `POST /api/v1/partners/contributions/bulk`

Bulk contribute to multiple workers' HSAs in a single transaction. Max 1000 items.

```bash
curl -X POST http://localhost:8080/api/v1/partners/contributions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contributions": [
      {"worker_phone": "+919876543210", "amount_paise": 10000, "idempotency_key": "bulk-001"},
      {"worker_phone": "+919876543211", "amount_paise": 15000, "idempotency_key": "bulk-002"}
    ]
  }'
```

**Response 200:**
```json
{
  "succeeded": 2,
  "failed": 0,
  "errors": []
}
```

---

#### `GET /api/v1/partners/dashboard`

Partner analytics dashboard.

```bash
curl http://localhost:8080/api/v1/partners/dashboard \
  -H "Authorization: Bearer <token>"
```

**Response 200:**
```json
{
  "total_workers": 150,
  "total_contributed_paise": 5000000,
  "contribution_count": 300,
  "coverage_rate": 0.75
}
```

---

#### `GET /api/v1/partners/reports`

Detailed contribution reports with pagination and date filtering.

```bash
curl "http://localhost:8080/api/v1/partners/reports?date_from=2024-01-01&date_to=2024-01-31&page=1&per_page=50" \
  -H "Authorization: Bearer <token>"
```

---

## Error Codes

| HTTP Status | Error Type | Description |
|-------------|-----------|-------------|
| 400 | `bad_request` | Invalid request parameters |
| 400 | `validation_error` | Input validation failed |
| 401 | `unauthorized` | Missing or invalid authentication |
| 403 | `forbidden` | Insufficient permissions for this action |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource already exists |
| 413 | `payload_too_large` | Request body exceeds size limit |
| 429 | `too_many_requests` | Rate limit exceeded |
| 500 | `internal_error` | Unexpected server error |

**Error response format:**
```json
{
  "error": "not_found",
  "message": "HSA account not found"
}
```

---

## Idempotency

All financial endpoints (contributions, subscriptions) require an `idempotency_key`. Sending the same key with the same HSA will return the original result without creating a duplicate. Keys must be 1-255 characters.
