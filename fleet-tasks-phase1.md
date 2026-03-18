# Aarokya Phase 1: Foundation Infrastructure

## Backend Core Setup
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Implement the Aarokya backend foundation in Rust using Actix-web. Set up in /home/user/aarokya/backend/.

1. Initialize Cargo project with workspace support
2. Add dependencies: actix-web, sqlx (postgres), serde, tokio, tracing, tracing-subscriber, jsonwebtoken, argon2, uuid, chrono, validator, dotenv, actix-cors, reqwest
3. Create src/main.rs with Actix-web server, CORS, tracing setup
4. Create src/config/mod.rs with environment-based configuration (DATABASE_URL, JWT_SECRET, PORT, etc.)
5. Create src/infrastructure/database.rs with PostgreSQL connection pool (sqlx::PgPool)
6. Create database migrations in migrations/ folder with the full schema (users, health_savings_accounts, contributions, partners, partner_workers, insurance_policies, claims, health_profiles, audit_logs tables with all indexes and constraints). Store money in paise (BIGINT).
7. Create src/domain/ with models: user.rs, hsa.rs, contribution.rs, partner.rs, insurance.rs, claim.rs, health_profile.rs
8. Create src/api/ with route modules: health.rs (GET /health), auth.rs placeholder, hsa.rs placeholder, contributions.rs placeholder
9. Create src/infrastructure/error.rs with AppError enum implementing actix ResponseError
10. Create Dockerfile and docker-compose.yml (postgres + redis + backend)
11. Create .env.example
12. Ensure it compiles with `cargo check`

## Customer App Setup
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Set up the React Native customer app in /home/user/aarokya/apps/customer/.

1. Initialize React Native project with TypeScript template using npx react-native init
2. Install dependencies: @react-navigation/native, @react-navigation/stack, @react-navigation/bottom-tabs, zustand, axios, @tanstack/react-query, react-native-vector-icons, react-native-safe-area-context, react-native-screens, i18next, react-i18next
3. Create src/ directory structure: screens/, components/, navigation/, store/, api/, i18n/, theme/, types/
4. Create theme/colors.ts with the design system colors (Primary #2563EB, Secondary #10B981, Accent #F59E0B, etc.)
5. Create theme/typography.ts and theme/spacing.ts
6. Create navigation/AppNavigator.tsx with bottom tabs: Home, Insurance, Health, Profile
7. Create navigation/AuthNavigator.tsx with: Welcome, PhoneInput, OTPVerification
8. Create screens/HomeScreen.tsx with HSA balance card, insurance progress bar, quick actions, recent contributions
9. Create screens/auth/WelcomeScreen.tsx, PhoneInputScreen.tsx, OTPScreen.tsx
10. Create components/common/: Button.tsx, Card.tsx, Input.tsx, ProgressBar.tsx, BottomSheet.tsx
11. Create store/authStore.ts with Zustand (token, user, login/logout actions)
12. Create store/hsaStore.ts with Zustand (balance, contributions, fetch actions)
13. Create api/client.ts with Axios instance (base URL, auth interceptor)
14. Create api/endpoints/: auth.ts, hsa.ts, contributions.ts, insurance.ts
15. Create i18n/index.ts with i18next setup and locale files for en, hi, ta, te, kn, bn, mr
16. Create App.tsx wiring everything together
17. Ensure TypeScript compiles cleanly

## Partner App Setup
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Set up the React Native partner app in /home/user/aarokya/apps/partner/.

1. Initialize React Native project with TypeScript template
2. Install dependencies: same as customer app plus react-native-document-picker for CSV import
3. Create src/ structure: screens/, components/, navigation/, store/, api/, i18n/, theme/, types/
4. Reuse theme from customer app (symlink or copy)
5. Create navigation/AppNavigator.tsx with bottom tabs: Dashboard, Workers, Contribute, Reports
6. Create navigation/AuthNavigator.tsx with business onboarding flow
7. Create screens/DashboardScreen.tsx with: total workers, total contributions, coverage rate, recent activity
8. Create screens/WorkersScreen.tsx with: worker list, search, add worker, individual detail
9. Create screens/ContributeScreen.tsx with: individual/bulk contribution, amount config, payment confirmation
10. Create screens/ReportsScreen.tsx with: CSR reports, compliance, export buttons
11. Create components/common/: same base components as customer
12. Create components/partner/: WorkerCard.tsx, ContributionForm.tsx, ReportCard.tsx
13. Create store/partnerStore.ts (workers list, contribution history)
14. Create api/endpoints/: partner.ts, workers.ts, contributions.ts
15. Create i18n setup (en, hi primary)
16. Ensure TypeScript compiles cleanly

## Control Center Setup
- workdir: /home/user/aarokya
- model: opus
- effort: high
- allowedTools: Read Grep Glob Bash Edit Write Agent

Set up the control center web app in /home/user/aarokya/apps/control-center/.

1. Initialize Next.js 14 project with TypeScript, Tailwind CSS, App Router
2. Install: @tanstack/react-query, zustand, axios, recharts, @headlessui/react, lucide-react, date-fns, zod
3. Create app/ directory structure with route groups: (auth)/, (dashboard)/
4. Create components/layout/: Sidebar.tsx, Header.tsx, DashboardLayout.tsx
5. Create Sidebar with nav items: Dashboard, Users, Finances, Insurance, Analytics, Settings
6. Create (auth)/login/page.tsx with phone+OTP login (operator)
7. Create (dashboard)/page.tsx with: system health cards, user growth chart, financial overview, alert panel
8. Create (dashboard)/users/page.tsx with: user table, search, filters, pagination
9. Create (dashboard)/users/[id]/page.tsx with: user detail, HSA info, contributions, policies
10. Create (dashboard)/finances/page.tsx with: transaction table, filters, reconciliation status
11. Create (dashboard)/insurance/page.tsx with: policies table, claims queue
12. Create (dashboard)/analytics/page.tsx with: charts using recharts, funnel visualization
13. Create (dashboard)/settings/page.tsx with: role management, system config
14. Create components/ui/: Button, Input, Table, Badge, Modal, Select, DatePicker
15. Create lib/api.ts with axios client
16. Create lib/auth.ts with JWT handling
17. Create middleware.ts for route protection
18. Create types/ with all TypeScript interfaces matching backend models
19. Tailwind config with Aarokya design system colors
20. Ensure it builds with next build
