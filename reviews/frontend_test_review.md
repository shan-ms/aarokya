# Frontend Test Review — Aarokya

**Reviewer:** Senior QA Engineer
**Date:** 2026-03-18
**Scope:** All frontend test coverage across customer app, partner app, and control center

---

## 1. Critical Finding: No Frontend Tests Exist

**Severity:** Critical

After thorough examination of all three frontend applications, **there are zero test files** in the source directories:

| App | Test Files Found | Test Framework Configured |
|-----|-----------------|--------------------------|
| `apps/customer/` | 0 | Jest via React Native preset (in `package.json`) |
| `apps/partner/` | 0 | Jest via React Native preset (in `package.json`) |
| `apps/control-center/` | 0 | None configured |

The only test files found are in `node_modules/` (from third-party packages), which are not project tests.

The CI pipeline (`ci.yml`) does include test steps for the mobile apps, but since no tests exist, these steps pass vacuously (0 tests = 0 failures = green CI).

---

## 2. What Should Be Tested

### 2.1 Critical Business Logic Tests (Must Have)

These are pure functions that can be tested without React rendering:

#### Currency Formatting
```
File: apps/customer/src/components/home/BalanceCard.tsx
Function: formatCurrency(paise: number): string

Test cases needed:
- formatCurrency(0) → "0.00"
- formatCurrency(100) → "1.00"
- formatCurrency(99999) → "999.99"
- formatCurrency(100000) → "1,000.00"
- formatCurrency(10000000) → "1,00,000.00"  (Indian grouping: lakhs)
- formatCurrency(1000000000) → "1,00,00,000.00"  (Indian grouping: crores)
- formatCurrency(-100) → handle negative correctly
- formatCurrency(1) → "0.01"  (single paisa)
```

#### RBAC Permission Checking
```
File: apps/control-center/src/lib/rbac.ts
Functions: hasPermission, canAccessRoute

Test cases needed:
- hasPermission(['all'], 'users.read') → true
- hasPermission(['users.read'], 'users.write') → false
- hasPermission(['users.read', 'users.write'], 'users.read') → true
- hasPermission([], 'users.read') → false
- canAccessRoute(['users.read'], '/dashboard') → true (no permissions required)
- canAccessRoute(['users.read'], '/dashboard/users') → true
- canAccessRoute([], '/dashboard/users') → false
- canAccessRoute(['all'], '/dashboard/settings') → true
```

#### Auth Token Validation
```
File: apps/control-center/src/lib/auth.ts
Functions: isAuthenticated, getTokenPayload

Test cases needed:
- isAuthenticated() with no token → false
- isAuthenticated() with valid non-expired token → true
- isAuthenticated() with expired token → false
- isAuthenticated() with malformed token → false
- getTokenPayload() with valid JWT → parsed payload
- getTokenPayload() with null → null
```

### 2.2 API Client Tests (Should Have)

#### Request Interceptor
```
File: apps/customer/src/api/client.ts

Test cases needed:
- Authenticated request includes Authorization header
- Unauthenticated request has no Authorization header
- 401 response triggers logout
- Network error does not trigger logout
```

#### API Function Tests (with mocked Axios)
```
Files: apps/customer/src/api/hsa.ts, insurance.ts, contributions.ts, auth.ts

Test cases needed per API function:
- Correct HTTP method and path
- Request body matches expected schema
- Response unwrapping works correctly
- Error propagation
```

### 2.3 Store Tests (Should Have)

#### Auth Store
```
File: apps/customer/src/store/authStore.ts

Test cases needed:
- Initial state: token is null, isAuthenticated is false
- login() sets token, refreshToken, user, and isAuthenticated
- logout() clears all state
- setUser() updates only user
- setToken() updates both tokens
```

#### HSA Store
```
File: apps/customer/src/store/hsaStore.ts

Test cases needed:
- Initial state
- State updates on data fetch
- Balance display derivation from paise
```

### 2.4 Component Tests (Nice to Have)

#### BalanceCard
```
- Renders formatted currency correctly
- Shows add money button
- Calls onAddMoney callback on press
```

#### InsuranceProgressCard
```
- Shows correct progress percentage
- Handles 0% and 100% cases
- Shows correct threshold text
```

### 2.5 Integration / E2E Tests (Recommended)

```
- Full auth flow: send OTP → verify → get token → access protected route
- Contribution flow: view HSA → contribute → verify balance update
- Insurance flow: check eligibility → subscribe → verify policy created
- Claim flow: submit claim → view in list → operator reviews
```

---

## 3. Recommended Test Setup

### Customer & Partner Apps (React Native)

Both apps already have Jest configured via the React Native preset. Setup needed:

```bash
# Install testing dependencies
npm install -D @testing-library/react-native @testing-library/jest-native
npm install -D msw  # for API mocking
```

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-native/extend-expect';
```

### Control Center (Next.js)

No test framework is configured. Setup needed:

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
npm install -D jest-environment-jsdom
```

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest';
const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
export default config;
```

---

## 4. Test Priority Matrix

| Priority | Category | Estimated Tests | Effort |
|----------|----------|-----------------|--------|
| P0 | Currency formatting (BalanceCard) | 8 | 1 hour |
| P0 | RBAC permission checks | 10 | 1 hour |
| P0 | Auth token validation | 6 | 1 hour |
| P1 | Auth store state management | 5 | 1 hour |
| P1 | API client interceptors | 4 | 2 hours |
| P1 | API function correct paths/methods | 15 | 2 hours |
| P2 | Component rendering tests | 10 | 3 hours |
| P2 | HSA store | 5 | 1 hour |
| P3 | E2E auth flow | 3 | 4 hours |
| P3 | E2E contribution flow | 3 | 4 hours |
| **Total** | | **~69 tests** | **~20 hours** |

---

## 5. CI Integration Gaps

### 5.1 Test Steps Pass Vacuously

The CI workflow runs:
```yaml
- name: Run tests
  run: npm test -- --passWithNoTests
```

The `--passWithNoTests` flag means CI always passes for the mobile apps. For the control center, there is no test step at all.

**Recommendation:** Remove `--passWithNoTests` once tests exist. Add a minimum coverage threshold:
```yaml
- name: Run tests
  run: npm test -- --coverage --coverageThreshold='{"global":{"branches":50,"functions":50,"lines":50}}'
```

### 5.2 No Visual Regression Testing

For a healthcare platform with a branded design system, visual regressions (broken layouts, wrong colors, missing elements) can erode user trust. Consider adding:
- Storybook for component documentation
- Chromatic or Percy for visual regression testing

---

## Summary

| Finding | Severity |
|---------|----------|
| Zero frontend tests across all 3 apps | Critical |
| CI passes vacuously due to `--passWithNoTests` | High |
| No test framework configured for control center | High |
| Pure business logic (currency, RBAC, auth) completely untested | High |
| API client integration untested | Medium |
| No E2E test coverage | Medium |

**Estimated effort to reach minimum viable test coverage:** ~20 hours (69 tests across all apps)

**Top 3 Immediate Actions:**
1. Write tests for `formatCurrency`, `hasPermission`, and `isAuthenticated` — these are pure functions, easy to test, high business value
2. Write auth store tests — validates the core auth flow
3. Write API client path/method tests — will catch the existing path mismatches (F1, F2 from frontend code review)
