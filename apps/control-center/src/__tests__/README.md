# Automated Regression Testing (ART) – Control Center

## Test Matrix

| # | Test File | Module Under Test | Test Cases | Key Coverage |
|---|-----------|-------------------|------------|--------------|
| 1 | `lib/rbac.test.ts` | RBAC helpers | 20 | ALL_PERMISSIONS constant, hasPermission (single/multi/wildcard), canAccessRoute (all sidebar routes), getUserPermissions (null/undefined/empty), 7-role access matrix |
| 2 | `lib/utils.test.ts` | Utility functions | 28 | cn() class merging, formatCurrency (paise to INR, Indian grouping), formatCurrencyCompact (K/L/Cr), formatDate/formatDateTime, formatPhone (+91), truncate |
| 3 | `lib/auth.test.ts` | JWT token management | 16 | getToken/setToken/removeToken, getRefreshToken/setRefreshToken, isAuthenticated (valid/expired/malformed JWT), getTokenPayload (parsing, custom claims) |
| 4 | `store/authStore.test.ts` | Zustand auth store | 10 | initialize (localStorage sync), login (API call, token storage, user/role set), logout (clear all), fetchUser (success, no-role, API error) |
| 5 | `components/StatCard.test.tsx` | StatCard component | 9 | Label/value rendering, trend icons (up/down/neutral), trend label, no-trend state, custom className |
| 6 | `components/Table.test.tsx` | Table component | 14 | Column headers, data rows, custom render, empty state, loading state, sort indicators, sort click handler, pagination (page info, prev/next, disabled states) |
| 7 | `pages/login.test.tsx` | Login page | 13 | Phone input step, +91 prefix, phone validation (10 digits), OTP request flow, OTP verification, error display, change phone number, already-authenticated redirect, redirect query param |
| 8 | `pages/dashboard.test.tsx` | Dashboard page | 9 | 4 stat cards rendered, fallback data display, trend percentages, chart components, recent activity table, API success scenario, partial API failure handling |
| 9 | `pages/users.test.tsx` | Users page | 12 | User table rendering, column headers, RBAC verify/reject gating, search filtering, type/status filter dropdowns, API data usage, verify/reject actions, no-role handling |
| 10 | `middleware.test.ts` | Next.js middleware | 11 | Public path passthrough (login, _next, favicon, api, root), valid token access, expired token redirect with redirect param, malformed token redirect, no-cookie client-side fallback |

## Total: ~142 test cases across 10 test suites

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run a single suite
npm test -- --testPathPattern=rbac

# Run in watch mode
npm test -- --watch
```

## Operator Roles Tested (7 roles)

| Role | Permissions | Dashboard | Users | Finances | Insurance | Analytics | Settings |
|------|-------------|-----------|-------|----------|-----------|-----------|----------|
| super_admin | all | Y | Y | Y | Y | Y | Y |
| insurance_ops | insurance.*, users.read | Y | Y | N | Y | N | N |
| support | users.* | Y | Y | N | N | N | N |
| analytics | analytics.read | Y | N | N | N | Y | N |
| partner_manager | users.read, finances.read | Y | Y | Y | N | N | N |
| finance_auditor | finances.* | Y | N | Y | N | N | N |
| readonly_viewer | *.read | Y | Y | Y | Y | Y | Y |

## Domain Rules Verified

- Currency: paise stored as integers, formatted as INR with Indian grouping (lakhs/crores)
- HSA thresholds: Basic insurance at 399900 paise (₹3,999), Premium at 1000000 paise (₹10,000)
- Phone format: +91 XXXXX XXXXX
- JWT: Base64-decoded payload, exp claim in seconds
- Auth flow: Phone OTP → verify → JWT token → localStorage + cookie sync
- Middleware: Cookie-based server-side auth check, fallback to client-side localStorage auth

## Test Architecture

- **Mocking strategy**: All API calls mocked with `jest.fn()`, no network requests
- **Component mocks**: lucide-react icons, recharts (charts), next/navigation
- **State management**: Zustand store tested via direct state manipulation and action calls
- **RBAC testing**: Permission matrix tested with `it.each()` for all role/route combinations
