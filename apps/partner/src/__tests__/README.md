# Aarokya Partner App — Automated Regression Test (ART) Matrix

## Overview

Comprehensive Jest test suites for the Partner React Native app. All tests use `jest.mock()` for API calls, navigation, and external dependencies. Tests cover happy paths, error cases, loading/empty states, and data formatting (paise to rupees).

## Running Tests

```bash
cd apps/partner
npm test                    # Run all tests
npm test -- --coverage      # Run with coverage report
npm test -- --watch         # Watch mode
npm test -- --testPathPattern=stores   # Run only store tests
npm test -- --testPathPattern=api      # Run only API tests
npm test -- --testPathPattern=screens  # Run only screen tests
```

## Test Matrix

### 1. Store Tests

#### `stores/authStore.test.ts` — Auth Store (9 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | Initial state defaults | State | token=null, partner=null, isAuthenticated=false |
| 2 | Login sets tokens and partner | Happy path | Token/partner/isAuthenticated set correctly |
| 3 | Login calls setAuthToken/setRefreshToken | Side effect | API client tokens updated |
| 4 | Login for new partner (no partner object) | Edge case | partner=null, isNewPartner=true |
| 5 | Login with undefined partner sets null | Edge case | partner ?? null coalescing |
| 6 | setPartner clears isNewPartner | State | Onboarding completion flow |
| 7 | updateToken updates only access token | State | Other fields unchanged |
| 8 | Logout clears all state | Happy path | Full state reset |
| 9 | Logout is idempotent | Edge case | No error when already logged out |

#### `stores/partnerStore.test.ts` — Partner Store (18 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | Initial state defaults | State | Empty workers, null dashboard, empty contributions |
| 2 | fetchWorkers success | Happy path | Workers populated with correct data |
| 3 | fetchWorkers with search param | API call | Search parameter passed correctly |
| 4 | fetchWorkers with page param | API call | Page parameter passed correctly |
| 5 | fetchWorkers error handling | Error | workersError set, loading cleared |
| 6 | fetchWorkers non-Error fallback | Error | Default error message used |
| 7 | fetchWorkers loading state | Loading | workersLoading=true during fetch |
| 8 | fetchMoreWorkers appends data | Pagination | Workers array concatenated |
| 9 | fetchMoreWorkers requests page+1 | Pagination | Correct page number requested |
| 10 | fetchMoreWorkers skips when hasMore=false | Guard | No API call made |
| 11 | fetchMoreWorkers skips when loading | Guard | Concurrent fetch prevention |
| 12 | fetchMoreWorkers error | Error | Error set, loading cleared |
| 13 | fetchDashboard success | Happy path | Dashboard data set correctly |
| 14 | fetchDashboard paise values | Data format | Paise-to-rupee conversion verified |
| 15 | fetchDashboard error | Error | dashboardError set |
| 16 | fetchContributions success | Happy path | Contributions populated |
| 17 | fetchContributions with filters | API call | Date/worker filters passed |
| 18 | reset clears all state | State | Full state reset to initial |

### 2. API Tests

#### `api/auth.test.ts` — Auth API (7 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | sendOtp POST | Happy path | Correct endpoint and payload |
| 2 | sendOtp invalid phone error | Error | Error propagation |
| 3 | sendOtp network error | Error | Network failure handling |
| 4 | verifyOtp POST | Happy path | Phone/OTP/requestId sent correctly |
| 5 | verifyOtp new partner response | Edge case | isNewPartner=true, no partnerId |
| 6 | verifyOtp wrong OTP error | Error | Error propagation |
| 7 | refreshToken POST | Happy path | Refresh token exchange |

#### `api/partner.test.ts` — Partner API (7 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | registerPartner POST | Happy path | Registration payload sent |
| 2 | registerPartner paise amount | Data format | contributionAmountPaise in paise |
| 3 | registerPartner validation error | Error | Duplicate registration |
| 4 | getPartner GET | Happy path | Partner data retrieved |
| 5 | getPartner 404 | Error | Unknown partner handling |
| 6 | getDashboard GET | Happy path | Dashboard metrics retrieved |
| 7 | getDashboard zero values | Edge case | New partner with no data |

#### `api/workers.test.ts` — Workers API (10 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | addWorker by phone | Happy path | POST with phone payload |
| 2 | addWorker by ABHA ID | Happy path | POST with abhaId payload |
| 3 | addWorker duplicate error | Error | Already linked worker |
| 4 | listWorkers with pagination | Happy path | Page/pageSize params |
| 5 | listWorkers with search | Happy path | Search query passed |
| 6 | listWorkers without params | Edge case | Optional params omitted |
| 7 | listWorkers empty list | Edge case | Zero workers |
| 8 | listWorkers network error | Error | Error propagation |
| 9 | getWorkerDetail GET | Happy path | Worker with HSA balance in paise |
| 10 | searchWorker null result | Edge case | Worker not found returns null |

#### `api/contributions.test.ts` — Contributions API (10 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | createContribution POST | Happy path | Contribution created with paise amount |
| 2 | createContribution source types | Happy path | All 4 source types (employer, platform_fee, csr, grant) |
| 3 | createContribution error | Error | Insufficient funds |
| 4 | bulkContribute POST | Happy path | Multiple workers, total calculated |
| 5 | bulkContribute partial failure | Edge case | successCount/failureCount |
| 6 | bulkContribute empty workers error | Error | Validation error |
| 7 | getContributionHistory with params | Happy path | Date/worker filters |
| 8 | getContributionHistory no params | Edge case | Optional params omitted |
| 9 | getContributionHistory paise amounts | Data format | Insurance threshold amounts |
| 10 | getReports with date range | Happy path | Report totals in paise |

### 3. Screen Tests

#### `screens/DashboardScreen.test.tsx` — Dashboard Screen (17 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | Loading spinner shown | Loading | Full-screen spinner during fetch |
| 2 | Error state displayed | Error | Error message + retry button |
| 3 | Retry button shown | Error | User can retry after failure |
| 4 | Partner name in greeting | Happy path | Business name displayed |
| 5 | Total workers count | Happy path | Numeric worker count |
| 6 | Total contributed formatted | Data format | Paise to ₹75.0K |
| 7 | Coverage rate percentage | Happy path | 72% displayed |
| 8 | Coverage hint text | Threshold | "Good progress" for 50-74% |
| 9 | Recent contribution names | Happy path | Worker names in activity |
| 10 | Contribution amounts (paise→₹) | Data format | ₹500, ₹250 from paise |
| 11 | Action buttons displayed | UI | Add Worker + Contribute buttons |
| 12 | Navigate to AddWorker | Navigation | Button press navigates |
| 13 | Navigate to Contribute | Navigation | Button press navigates |
| 14 | Empty activity message | Empty state | No contributions message |
| 15 | Large amount in lakhs (₹L) | Data format | ₹1.5L for 15M paise |
| 16 | Zero contributions | Data format | ₹0 display |
| 17 | No partner = no fetch | Guard | Query not enabled without partner |

#### `screens/WorkersScreen.test.tsx` — Workers Screen (15 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | Worker names displayed | Happy path | All 3 worker names |
| 2 | Worker phone numbers | Happy path | Phone numbers visible |
| 3 | HSA balances formatted | Data format | Paise to ₹5,000 / ₹2,000 / ₹3,999 |
| 4 | Insurance status badges | Happy path | Insured/No Insurance/Pending |
| 5 | Screen title | UI | Title i18n key rendered |
| 6 | Search input rendered | UI | Placeholder text shown |
| 7 | Search debounced (300ms) | Behavior | fetchWorkers called after timeout |
| 8 | Loading spinner (no data) | Loading | Full-screen spinner |
| 9 | No full-screen loading with data | Loading | List shown during refresh |
| 10 | Error state with retry | Error | Error message + retry button |
| 11 | Empty state message | Empty | No workers text |
| 12 | Empty state add worker button | Empty | Navigation action |
| 13 | Empty state navigates to AddWorker | Navigation | Button press works |
| 14 | FAB rendered | UI | + symbol displayed |
| 15 | FAB navigates to AddWorker | Navigation | Floating button works |

#### `screens/ContributeScreen.test.tsx` — Contribute Screen (18 tests)

| # | Test Case | Category | Validates |
|---|-----------|----------|-----------|
| 1 | Individual/Bulk tabs | UI | Both tabs displayed |
| 2 | Default to individual tab | State | "Select Worker" (singular) |
| 3 | Switch to bulk tab | Interaction | "Select Workers" (plural) |
| 4 | Clear selection on tab switch | State | Workers deselected |
| 5 | Worker chips displayed | UI | All worker names shown |
| 6 | Selected count shown | State | "1 worker selected" |
| 7 | Single select in individual mode | Behavior | Only last selection kept |
| 8 | Multi-select in bulk mode | Behavior | Multiple workers selected |
| 9 | Toggle deselect in bulk mode | Behavior | Worker toggled off |
| 10 | Amount input displayed | UI | Placeholder visible |
| 11 | Individual amount label | UI | "Amount (₹)" |
| 12 | Bulk amount label | UI | "Amount Per Worker (₹)" |
| 13 | Source type options | UI | All 4 types shown |
| 14 | Total calculation (single) | Data format | ₹500 total |
| 15 | Total calculation (bulk) | Data format | 2 workers * ₹250 = ₹500 |
| 16 | Invalid amount validation | Validation | Error message shown |
| 17 | No worker selected validation | Validation | Error message shown |
| 18 | Rupee-to-paise conversion | Data format | ₹39.99 = 3999 paise |

## Coverage Summary

| Layer | Files | Test Count | Areas |
|-------|-------|------------|-------|
| Stores | 2 | 27 | State management, side effects, guards |
| API | 4 | 34 | HTTP calls, payloads, error propagation |
| Screens | 3 | 50 | UI rendering, navigation, formatting |
| **Total** | **9** | **111** | |

## Key Domain Rules Validated

- **Currency**: All monetary values stored/transmitted in paise (1/100 ₹), displayed as formatted rupees
- **Insurance thresholds**: ₹3,999 (399900 paise) basic, ₹10,000 (1000000 paise) premium
- **Source types**: employer, platform_fee, csr, grant
- **Contribution modes**: individual (single worker) vs bulk (multiple workers)
- **Coverage rate thresholds**: <50% (low), 50-74% (good), >=75% (excellent)
- **Pagination**: 20 items per page, append on fetchMore, guard against concurrent loads
