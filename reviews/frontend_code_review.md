# Frontend Code Review — Aarokya

**Reviewer:** Senior Frontend Engineer
**Date:** 2026-03-18
**Scope:** Customer app (React Native), Partner app (React Native), Control Center (Next.js)
**Files Reviewed:** All `.ts` and `.tsx` files in `apps/customer/src/`, `apps/partner/src/`, `apps/control-center/src/`

---

## 1. Critical Issues

### F1. API Path Mismatches Will Cause Runtime Errors

**Files:** Multiple frontend API files
**Severity:** Critical

Several frontend API calls use paths that don't match the backend routes:

- `apps/customer/src/api/insurance.ts:42` — `POST /insurance/claims` should be `POST /claims`
- The base URL for customer app is `https://api.aarokya.in/v1` (missing `/api` prefix)
- Claims endpoint in customer app goes to `/insurance/claims` but backend route is `/claims`

### F2. camelCase/snake_case Mismatch on Request Bodies

**Files:** `apps/customer/src/api/hsa.ts:15`, `apps/customer/src/api/insurance.ts:28`
**Severity:** Critical

Frontend sends `{ abhaId, planId }` but backend expects `{ abha_id, plan_id }`. These requests will silently fail or be rejected.

**Remediation:** Either:
- Add `#[serde(rename_all = "camelCase")]` to all backend request types, or
- Use snake_case in frontend API calls:
```typescript
await client.post('/hsa', { abha_id: abhaId });
```

### F3. Control Center Dashboard Falls Back to Hardcoded Mock Data

**File:** `apps/control-center/src/app/dashboard/page.tsx:22-76`
**Severity:** High

The dashboard initializes state with hardcoded fallback data (`fallbackStats`, `fallbackUserGrowth`, etc.) and silently uses it when API calls fail. The `Promise.allSettled` pattern means partial failures are invisible — the dashboard shows a mix of real and fake data with no visual indicator.

**Impact:** Operators may make decisions based on mock data displayed as if it were real.

**Remediation:** Show a clear "data unavailable" state for each section that fails, rather than falling back to fake data silently.

---

## 2. Important Issues

### F4. No Token Refresh Logic in Customer or Partner Apps

**Files:** `apps/customer/src/api/client.ts:26-34`, `apps/partner/src/api/client.ts`
**Severity:** High

Both mobile apps store a `refreshToken` but never use it. When the access token expires (401), the response interceptor immediately logs the user out. Users on unreliable mobile networks in India will be frequently force-logged out.

**Remediation:** Implement token refresh in the 401 interceptor:
```typescript
async (error) => {
  if (error.response?.status === 401 && !error.config._retry) {
    error.config._retry = true;
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      const { data } = await axios.post('/auth/refresh', { refresh_token: refreshToken });
      useAuthStore.getState().setToken(data.access_token, refreshToken);
      error.config.headers.Authorization = `Bearer ${data.access_token}`;
      return client(error.config);
    }
  }
  useAuthStore.getState().logout();
  return Promise.reject(error);
}
```

### F5. Auth State Not Persisted in Mobile Apps

**Files:** `apps/customer/src/store/authStore.ts`, `apps/partner/src/store/authStore.ts`
**Severity:** High

Zustand stores use no persistence middleware. Every app restart requires re-authentication. For gig workers using low-end Android devices with aggressive background app killing, this means frequent re-login.

**Remediation:** Add `zustand/middleware` with `AsyncStorage`:
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(
  persist<AuthState>(
    (set) => ({ /* ... */ }),
    { name: 'auth-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

### F6. Control Center RBAC Not Enforced on Routes

**File:** `apps/control-center/src/lib/rbac.ts`
**Severity:** Medium

The RBAC module defines `hasPermission`, `canAccessRoute`, and `SIDEBAR_PERMISSIONS`, but:
1. No middleware or layout component checks `canAccessRoute` before rendering pages
2. The sidebar visibility is defined but not wired to actual component rendering
3. An `operator_analytics` user can navigate directly to `/dashboard/users` or `/dashboard/settings` via URL

**Remediation:** Add route-level protection in the layout:
```typescript
// In app/dashboard/layout.tsx
const permissions = getUserPermissions(role);
if (!canAccessRoute(permissions, pathname)) {
  redirect('/dashboard');
}
```

### F7. No Error Boundaries in React Native Apps

**Files:** `apps/customer/App.tsx`, `apps/partner/App.tsx`
**Severity:** Medium

Neither app has error boundaries. An unhandled exception in any component will crash the entire app with a white screen — particularly problematic for gig workers who may not know how to force-quit and restart.

### F8. No Offline Support or Network Status Handling

**Files:** All mobile app screens
**Severity:** Medium

The mobile apps make no use of:
- `@react-native-community/netinfo` for network detection
- React Query's `networkMode` for offline queuing
- Any offline-first data caching

For India's gig worker demographic (frequently on 2G/3G with intermittent connectivity), offline support is essential.

---

## 3. Code Quality Issues

### F9. Indian Currency Formatting Duplicated

**Files:** `apps/customer/src/components/home/BalanceCard.tsx:17-41`, `apps/control-center/src/lib/utils.ts`
**Severity:** Medium

The `formatCurrency` function in `BalanceCard.tsx` implements Indian numbering (lakhs/crores grouping) manually. The control center has its own `formatCurrencyCompact`. These should be a shared utility.

**Note:** The manual implementation in `BalanceCard.tsx` is correct — it handles the Indian grouping pattern (last 3 digits, then groups of 2) properly.

### F10. `useEffect` Dependency Array Warnings Suppressed

**File:** `apps/control-center/src/app/dashboard/page.tsx:119`
**Severity:** Low

```typescript
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

The `toast` function from the Toast context is used inside the effect but excluded from dependencies. If `toast` identity changes, the effect won't re-run, which is actually the desired behavior here — but the eslint suppression masks any future dependency issues.

### F11. No TypeScript Strict Mode

**Severity:** Medium

Neither the customer app nor partner app appear to have `"strict": true` in their TypeScript configs. Without strict mode, `null` and `undefined` can be assigned to any type, defeating much of TypeScript's value.

### F12. Control Center Auth Uses localStorage for JWT

**File:** `apps/control-center/src/lib/auth.ts`
**Severity:** Medium (also covered in security review)

For a web application managing healthcare and financial data, storing JWTs in localStorage is a security concern. Any XSS vulnerability gives full access to the token.

### F13. No Loading States for Navigation in Mobile Apps

**Severity:** Low

Screen transitions that depend on API calls don't show loading indicators before navigation. Users may see partially loaded screens.

---

## 4. Architecture Observations

### F14. No Shared Package Between Apps

**Severity:** Medium

The three apps (`customer`, `partner`, `control-center`) share types, API patterns, and theme values, but there is no shared package. This leads to:
- Duplicated type definitions (each app defines its own `Contribution`, `Policy`, etc.)
- Duplicated API client setup (nearly identical Axios configuration)
- Duplicated currency formatting logic

**Recommendation:** Create a `packages/shared` directory with:
- `types/` — shared TypeScript interfaces
- `api/` — base API client factory
- `utils/` — currency formatting, date helpers

### F15. i18n Setup Present But Incomplete

**Files:** `apps/customer/src/i18n/index.ts`, `apps/partner/src/i18n/index.ts`
**Severity:** Low

i18n is configured in both mobile apps (i18next), which is good for India's multilingual user base. However, the actual translation files and language count would need to be verified.

---

## 5. Positive Observations

1. **Well-structured theme system** — Both mobile apps have a consistent theme with `colors.ts`, `typography.ts`, `spacing.ts` matching the Aarokya design system.

2. **Zustand for state management** — Clean, minimal state management. No over-engineered Redux setup.

3. **React Query pattern** — The apps are structured to use `@tanstack/react-query` for server state, which is the right choice for API-heavy mobile apps.

4. **Indian locale support** — Currency formatting uses Indian numbering (lakhs/crores), which is correct for the target market.

5. **Control center uses Recharts** — Good charting library for the dashboard with proper data visualization components.

6. **Proper Axios interceptors** — Both mobile apps and control center have request/response interceptors for auth token injection and 401 handling.

7. **Component composition** — Clean component hierarchy with reusable common components (`Button`, `Card`, `LoadingSpinner`, `EmptyState`).

8. **`Promise.allSettled` for dashboard** — The control center dashboard loads all data in parallel and handles partial failures gracefully (even if the fallback approach needs improvement).

---

## Summary

| Severity | Count | Theme |
|----------|-------|-------|
| Critical | 2 | API path/field name mismatches (runtime errors) |
| High | 3 | No token refresh, no state persistence, mock data fallback |
| Medium | 7 | RBAC not enforced, no error boundaries, no offline support, no shared package |
| Low | 3 | Dependency warnings, i18n completeness, loading states |

**Top 3 Priorities:**
1. Fix API path and field name mismatches (F1, F2) — these are active bugs
2. Implement token refresh logic in mobile apps (F4) — critical for user retention
3. Add auth state persistence in mobile apps (F5) — mandatory for gig worker UX
