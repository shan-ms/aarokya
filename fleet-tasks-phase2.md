# Aarokya Phase 2: Core Features Implementation

## Backend HSA Engine
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement the HSA engine in the Rust backend at /home/user/aarokya/backend/. Read existing code first.

1. Implement POST /api/v1/hsa - Create HSA account (requires auth, links to user's ABHA ID)
2. Implement GET /api/v1/hsa - Get user's HSA account with balance
3. Implement GET /api/v1/hsa/dashboard - Dashboard data (balance, goal progress, insurance eligibility %, contribution velocity)
4. Implement POST /api/v1/contributions - Create contribution with idempotency_key, source_type, amount. Use database transaction for double-entry: insert contribution + update HSA balance atomically.
5. Implement GET /api/v1/contributions - List contributions with filters (source_type, date range, pagination)
6. Implement GET /api/v1/contributions/summary - Aggregated contribution stats (by source, by month)
7. Implement insurance eligibility calculation: balance >= 399900 paise → eligible for basic; >= 1000000 → eligible for premium
8. Add comprehensive input validation using validator crate
9. Add audit logging for all financial operations
10. Write unit tests for all business logic
11. Write integration tests for all API endpoints
12. Ensure all tests pass

## Backend Auth System
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement authentication in the Rust backend at /home/user/aarokya/backend/. Read existing code first.

1. Implement POST /api/v1/auth/send-otp - Send OTP to phone (mock SMS for now, store OTP in Redis/memory)
2. Implement POST /api/v1/auth/verify-otp - Verify OTP, create user if new, return JWT tokens
3. Implement POST /api/v1/auth/refresh - Refresh access token
4. Implement auth middleware that extracts and validates JWT, attaches user to request
5. Implement RBAC middleware with roles: customer, partner, operator_super_admin, operator_insurance_ops, operator_support, operator_analytics, operator_partner_manager
6. Add rate limiting: 5 OTP requests per phone per 10 minutes
7. Write tests for auth flows
8. Ensure all existing tests still pass

## Backend Insurance & Claims
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement insurance features in the Rust backend at /home/user/aarokya/backend/. Read existing code first.

1. Implement GET /api/v1/insurance/plans - List available insurance plans
2. Implement POST /api/v1/insurance/subscribe - Subscribe to plan (deduct premium from HSA, create policy)
3. Implement GET /api/v1/insurance/policies - List user's policies
4. Implement POST /api/v1/claims - Submit claim with documents (JSON metadata)
5. Implement GET /api/v1/claims - List user's claims
6. Implement PATCH /api/v1/claims/:id/review - Review claim (operator only, approve/reject with reason)
7. Seed insurance plans data
8. Write tests for all insurance flows
9. Ensure all existing tests still pass

## Backend Partner APIs
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement partner features in the Rust backend at /home/user/aarokya/backend/. Read existing code first.

1. Implement POST /api/v1/partners/register - Register as partner (requires auth)
2. Implement GET /api/v1/partners/me - Get partner profile
3. Implement POST /api/v1/partners/workers - Add worker by phone/ABHA
4. Implement GET /api/v1/partners/workers - List enrolled workers with HSA status
5. Implement POST /api/v1/partners/contributions/bulk - Bulk contribution (array of worker_id + amount pairs, processed in single transaction)
6. Implement GET /api/v1/partners/dashboard - Partner dashboard (total workers, total contributed, coverage rate)
7. Implement GET /api/v1/partners/reports - Contribution reports with date range, exportable format
8. Write tests for all partner flows
9. Ensure all existing tests still pass

## Customer App Screens
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement full customer app screens in /home/user/aarokya/apps/customer/. Read existing code first.

1. Complete onboarding flow: WelcomeScreen → PhoneInputScreen → OTPScreen → ABHALinkScreen → HealthProfileSetupScreen
2. Implement HomeScreen with real API integration: fetch HSA balance, show insurance progress bar, display recent contributions
3. Create HSADetailScreen: full contribution history with pull-to-refresh, source filters, monthly chart
4. Create ContributeScreen: self-contribution amount input, UPI payment initiation
5. Create InsuranceScreen: eligibility meter, available plans, subscribe flow, active policies
6. Create ClaimsScreen: submit claim form, claims history
7. Create HealthProfileScreen: view/edit health info, medication reminders
8. Create ProfileScreen: user info, language change, logout
9. Connect all screens to Zustand stores and React Query API calls
10. Add loading states, error handling, empty states for all screens
11. Add pull-to-refresh on list screens

## Partner App Screens
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement full partner app screens in /home/user/aarokya/apps/partner/. Read existing code first.

1. Complete partner onboarding: BusinessTypeScreen → VerificationScreen → ContributionSchemeScreen
2. Implement DashboardScreen with real API: total workers, total contributed, coverage rate chart
3. Create WorkerListScreen: searchable list, add worker modal, individual worker detail
4. Create AddWorkerScreen: search by phone or ABHA, confirm enrollment
5. Create ContributeScreen: individual contribution (select worker, enter amount) and bulk contribution (upload CSV or select multiple workers)
6. Create PaymentScreen: contribution summary, UPI payment, confirmation
7. Create ReportsScreen: date range selector, contribution summary, CSR report, export to CSV
8. Connect all screens to stores and API
9. Add loading/error/empty states

## Control Center Features
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement full control center features in /home/user/aarokya/apps/control-center/. Read existing code first.

1. Complete login flow with JWT auth
2. Dashboard page: system health cards (total users, total HSA value, daily contributions, active policies), user growth line chart, contribution bar chart
3. Users page: searchable/filterable table, click to user detail, verification workflow buttons
4. User detail page: user info, HSA balance, contribution history, policies, claims
5. Finances page: transaction table with filters (date, type, amount range), reconciliation status badges
6. Insurance page: policies table, claims review queue with approve/reject actions, provider list
7. Analytics page: recharts charts for user growth, contribution trends, insurance funnel, geographic distribution
8. Settings page: role management table, permission toggles
9. Add role-based access: hide/show sections based on operator role
10. Add real API integration with React Query
11. Add toast notifications for actions
