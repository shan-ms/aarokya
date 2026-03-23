# Database Schema & Migrations Review — Aarokya

**Reviewer:** Database Engineer
**Date:** 2026-03-18
**Files Reviewed:**
- `backend/migrations/20240101000000_initial_schema.sql`
- `backend/migrations/20240102000000_add_claim_metadata.sql`
- All corresponding Rust domain models and API handlers

---

## 1. Critical Issues

### D1. No CHECK Constraint on `balance_paise` — Negative Balances Possible

**Table:** `health_savings_accounts`
**Severity:** Critical

The `balance_paise` column has no `CHECK (balance_paise >= 0)` constraint. The application-level check in `subscribe` and contribution handlers can be bypassed by concurrent requests (TOCTOU race condition). Two concurrent premium deductions can both pass the balance check and both succeed, resulting in a negative balance.

**Remediation:**
```sql
ALTER TABLE health_savings_accounts
  ADD CONSTRAINT balance_non_negative CHECK (balance_paise >= 0);
```

### D2. No `UNIQUE` Constraint on `contributions.idempotency_key` per HSA

**Table:** `contributions`
**Severity:** Critical

The idempotency key has a regular index (`idx_contributions_idempotency` on `idempotency_key, hsa_id`) but no UNIQUE constraint. Two concurrent requests with the same idempotency key can both pass the application-level check and both insert, creating duplicate contributions.

**Remediation:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_idempotency_unique
  ON contributions(idempotency_key, hsa_id) WHERE idempotency_key IS NOT NULL;
```

### D3. No Constraint Preventing Duplicate Active Policies

**Table:** `insurance_policies`
**Severity:** High

The subscribe handler checks `COUNT(*) WHERE hsa_id = $1 AND plan_id = $2 AND status = 'active'` but there is no database-level uniqueness constraint. Concurrent subscribe requests can both pass the check and both create active policies.

**Remediation:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_policy
  ON insurance_policies(hsa_id, plan_id) WHERE status = 'active';
```

---

## 2. Important Issues

### D4. VARCHAR(20) for `user_type` Without CHECK Constraint

**Table:** `users`
**Column:** `user_type VARCHAR(20) NOT NULL DEFAULT 'customer'`
**Severity:** High

There is no CHECK constraint limiting `user_type` to valid values. Combined with the privilege escalation vulnerability (user_type is client-controlled during registration), any string up to 20 characters can be stored.

**Remediation:**
```sql
ALTER TABLE users ADD CONSTRAINT valid_user_type
  CHECK (user_type IN ('customer', 'partner', 'operator_super_admin',
    'operator_insurance_ops', 'operator_support', 'operator_analytics',
    'operator_partner_manager'));
```

### D5. No CHECK Constraint on `status` Fields

**Tables:** All tables with `status VARCHAR(20)`
**Severity:** Medium

No table constrains the `status` column to valid values. Invalid statuses can be inserted through bugs or direct DB access.

**Remediation:** Add CHECK constraints to all status columns:
```sql
-- health_savings_accounts
ALTER TABLE health_savings_accounts
  ADD CONSTRAINT valid_hsa_status CHECK (status IN ('active', 'suspended', 'closed'));

-- insurance_policies
ALTER TABLE insurance_policies
  ADD CONSTRAINT valid_policy_status CHECK (status IN ('active', 'expired', 'cancelled'));

-- claims
ALTER TABLE claims
  ADD CONSTRAINT valid_claim_status CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected'));

-- partner_workers
ALTER TABLE partner_workers
  ADD CONSTRAINT valid_worker_status CHECK (status IN ('active', 'inactive'));
```

### D6. Missing `updated_at` Trigger — Stale Timestamps

**Tables:** `users`, `health_savings_accounts`, `claims`, `health_profiles`
**Severity:** Medium

Several tables have `updated_at TIMESTAMPTZ DEFAULT NOW()` but no trigger to auto-update on row modification. The application sets `updated_at = NOW()` in some UPDATE statements but not all. If a handler forgets, the timestamp becomes stale.

**Remediation:**
```sql
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
-- Repeat for all tables with updated_at
```

### D7. `contributions` Table Lacks `updated_at` Column

**Table:** `contributions`
**Severity:** Low

Contributions only have `created_at`. If a contribution's status needs to be updated (e.g., from pending to completed), there's no audit trail of when it was modified.

### D8. `insurance_policies` Table Missing `user_id` Column

**Table:** `insurance_policies`
**Severity:** Medium

Policies reference `hsa_id` but not `user_id` directly. To find a user's policies, queries must join through `health_savings_accounts`. This works but is indirect. For audit and reporting queries, a direct `user_id` reference would be more efficient.

### D9. No `created_at` Index for Paginated Queries

**Tables:** `insurance_policies`, `claims`
**Severity:** Medium

The `list_policies` and `list_claims` handlers use `ORDER BY created_at DESC` but the `insurance_policies` table has no index on `created_at`. The `claims` table has no descending index on `created_at`. For large datasets, these queries will require full table scans.

**Remediation:**
```sql
CREATE INDEX IF NOT EXISTS idx_insurance_policies_created_at
  ON insurance_policies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_created_at
  ON claims(created_at DESC);
```

---

## 3. Schema Design Observations

### D10. `phone` Column Allows Any String Up to 20 Characters

**Table:** `users`
**Severity:** Low

No format validation at the database level. Combined with weak application-level validation (`len() < 10`), invalid phone numbers can be stored.

**Remediation:**
```sql
ALTER TABLE users ADD CONSTRAINT valid_phone
  CHECK (phone ~ '^\+?[1-9][0-9]{9,14}$');
```

### D11. `abha_id` in Both `users` and `health_savings_accounts`

**Tables:** `users.abha_id` and `health_savings_accounts.abha_id`
**Severity:** Low

The ABHA ID appears in both tables. The `users.abha_id` has a UNIQUE constraint but `health_savings_accounts.abha_id` does not. It's unclear which is the source of truth. If they diverge, there's no constraint catching the inconsistency.

**Recommendation:** Store ABHA ID in one canonical location (likely `users`) and reference it via join.

### D12. `metadata JSONB` on Contributions Is Unstructured

**Table:** `contributions`
**Column:** `metadata JSONB`
**Severity:** Low

No JSON schema validation or GIN index. If this field is used for search or filtering in the future, queries will be slow.

### D13. `document_urls JSONB` on Claims Stores URLs as JSON Array

**Table:** `claims`
**Column:** `document_urls JSONB`
**Severity:** Low

Storing document URLs as a JSON array means there's no foreign key referencing a documents table, no size limits on the array, and no validation that URLs are valid.

---

## 4. Migration Quality

### D14. Second Migration Uses `ADD COLUMN IF NOT EXISTS` Correctly

**File:** `20240102000000_add_claim_metadata.sql`
**Quality:** Good

The migration is idempotent, which prevents errors on re-run. However, it does not add any indexes on the new columns (`hospital_name`, `diagnosis`, `document_urls`). If claims are searched by hospital or diagnosis, these will need indexes.

### D15. No Down Migrations

**Severity:** Medium

There are no rollback migrations. If a migration causes issues in production, there's no automated way to revert. SQLx supports reversible migrations via `.up.sql` / `.down.sql` naming.

### D16. Initial Migration Is a Single Monolithic File

**Severity:** Low (acceptable for greenfield)

All tables are in a single migration file. This is fine for a new project but makes it harder to selectively revert individual table changes later.

---

## 5. Positive Observations

1. **UUID primary keys** — All tables use UUID PKs, which avoids sequential ID enumeration attacks and supports distributed ID generation.

2. **BIGINT for monetary values** — `balance_paise` and `amount_paise` are `BIGINT` (8 bytes, max ~9.2 quintillion paise). This is more than sufficient and avoids floating-point issues.

3. **Proper foreign keys** — All relationships have FK constraints with cascading references. `partner_workers` has a composite `UNIQUE(partner_id, worker_user_id)` preventing duplicate associations.

4. **Appropriate indexes** — The initial schema includes indexes on all frequently queried columns: `user_id`, `hsa_id`, `phone`, `abha_id`, `status`.

5. **CHECK constraint on amounts** — `contributions.amount_paise > 0` and `claims.amount_paise > 0` prevent zero or negative financial entries at the DB level.

6. **`IF NOT EXISTS` guards** — All CREATE TABLE and CREATE INDEX statements use `IF NOT EXISTS`, making migrations idempotent.

7. **TIMESTAMPTZ for dates** — All timestamps use `TIMESTAMPTZ` (timezone-aware), which is the correct choice for a system serving users across Indian time zones.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| Critical | 3 | Missing uniqueness/check constraints enabling race conditions |
| Important | 6 | Missing status constraints, no update triggers, missing indexes |
| Low | 5 | Schema design, migration quality |

**Top 3 Priorities:**
1. Add `CHECK (balance_paise >= 0)` to `health_savings_accounts` (D1)
2. Add `UNIQUE` partial index on `contributions(idempotency_key, hsa_id)` (D2)
3. Add `UNIQUE` partial index on `insurance_policies(hsa_id, plan_id) WHERE status = 'active'` (D3)
