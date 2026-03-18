# Aarokya Customer App - Automated Regression Test (ART) Suite

## Test Matrix

### Stores

| Test File | Module | Test Cases | Coverage |
|-----------|--------|------------|----------|
| `stores/authStore.test.ts` | `authStore` | 14 | Initial state, login, logout, setUser, setToken, re-login, state isolation |
| `stores/hsaStore.test.ts` | `hsaStore` | 14 | Initial state, fetchDashboard (success/error/loading), fetchContributions (page 1 replace, page N append, default page), reset |

### API Layer

| Test File | Module | Test Cases | Coverage |
|-----------|--------|------------|----------|
| `api/auth.test.ts` | `auth` | 7 | sendOtp (success, network error, rate limit), verifyOtp (success, invalid, expired), refreshToken (success, invalid) |
| `api/hsa.test.ts` | `hsa` | 8 | getHsa (success, 404), getDashboard (success, 401, 500), createHsa (success, 409 duplicate, 422 validation) |
| `api/contributions.test.ts` | `contributions` | 10 | createContribution (self, employer, payment fail, zero amount), listContributions (paginated, filter by source, date range, empty, error), getContributionSummary (full, zero, error) |
| `api/insurance.test.ts` | `insurance` | 11 | getPlans (list, empty, error), subscribe (success, insufficient balance, invalid plan), getPolicies (list, empty), submitClaim (success, invalid policy, exceeds coverage), getClaims (list, empty) |

### Screens

| Test File | Screen | Test Cases | Coverage |
|-----------|--------|------------|----------|
| `screens/HomeScreen.test.tsx` | `HomeScreen` | 7 | Loading spinner, error state with retry, greeting display, contributions section, view all navigation, empty contributions state, API call on mount |
| `screens/OTPScreen.test.tsx` | `OTPScreen` | 13 | Render (title, subtitle, verify button, timer), OTP input (numeric, strip non-numeric, max 6), Verification (incomplete OTP error, API call, auth store login, navigation, failure Alert, fallback error), Resend (timer countdown, sendOtp call, timer reset, failure Alert) |

### Components

| Test File | Component | Test Cases | Coverage |
|-----------|-----------|------------|----------|
| `components/BalanceCard.test.tsx` | `BalanceCard` + `formatCurrency` | 22 | formatCurrency: paise to rupees (0, 100, 50, 999, 10000), Indian numbering (5k, 1L, 10L, 1Cr, <1k, thresholds), edge cases. Component: label, rupee symbol, formatted balance, zero, large balance, add money button press, no action on balance press |

## Summary

| Category | Files | Test Cases |
|----------|-------|------------|
| Stores | 2 | 28 |
| API | 4 | 36 |
| Screens | 2 | 26 |
| Components | 1 | 22 |
| **Total** | **9** | **122** |

## Key Test Patterns

### Mocking Strategy
- **API calls**: `jest.mock('../../api/client')` with mocked axios methods
- **Navigation**: `jest.mock('@react-navigation/native')` with mock `navigate`/`goBack`
- **i18n**: Returns translation keys as-is for assertion simplicity
- **React Query**: Wrapped in `QueryClientProvider` with `retry: false`
- **Timers**: `jest.useFakeTimers()` for resend countdown tests

### Domain Rules Verified
- Money always in paise (BIGINT), displayed as rupees with Indian numbering
- Insurance thresholds: basic at 399900 paise, premium at 1000000 paise
- Contribution sources: self, employer, government, platform_cashback, referral
- OTP: 6 digits, 30-second resend cooldown

### How to Run

```bash
# Run all tests
cd apps/customer && npx jest

# Run specific test suite
npx jest --testPathPattern="stores/authStore"

# Run with coverage
npx jest --coverage

# Run in watch mode
npx jest --watch
```
