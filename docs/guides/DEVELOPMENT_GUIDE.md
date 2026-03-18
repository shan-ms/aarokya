# Aarokya — Development Guide

## Prerequisites
- Rust (latest stable, via rustup)
- Node.js 20+ and npm/yarn
- Docker and Docker Compose
- React Native CLI (for mobile apps)
- Android Studio / Xcode (for mobile development)
- PostgreSQL 16 (via Docker or local)
- Redis 7 (via Docker or local)

## Repository Structure
```
aarokya/
├── backend/              # Rust API server (Actix-web)
│   ├── src/
│   │   ├── api/          # Route handlers
│   │   ├── config/       # Environment config
│   │   ├── domain/       # Domain models
│   │   └── infrastructure/ # DB, auth, errors
│   ├── migrations/       # SQL migrations
│   ├── Cargo.toml
│   └── docker-compose.yml
├── apps/
│   ├── customer/         # React Native customer app
│   ├── partner/          # React Native partner app
│   └── control-center/   # Next.js operator dashboard
├── packages/
│   └── shared/           # Shared TypeScript types
├── docs/
│   ├── vision/           # Product vision & strategy
│   ├── prd/              # Product requirements & design
│   ├── implementation/   # Implementation strategy
│   └── guides/           # This guide + others
├── fleet-tasks-phase1.md # Claude-fleet parallel tasks (Phase 1)
└── fleet-tasks-phase2.md # Claude-fleet parallel tasks (Phase 2)
```

## Quick Start

### 1. Start Infrastructure
```bash
cd backend
docker-compose up -d    # Starts PostgreSQL + Redis
```

### 2. Run Backend
```bash
cd backend
cp .env.example .env    # Configure environment
cargo run               # Starts server at http://localhost:8080
```
The server automatically runs database migrations on startup.

**Verify:**
```bash
curl http://localhost:8080/health
# {"status":"healthy","version":"0.1.0"}
```

### 3. Run Customer App
```bash
cd apps/customer
npm install
npx react-native start              # Start Metro bundler
npx react-native run-android        # or run-ios
```

### 4. Run Partner App
```bash
cd apps/partner
npm install
npx react-native start
npx react-native run-android
```

### 5. Run Control Center
```bash
cd apps/control-center
npm install
npm run dev                         # Starts at http://localhost:3000
```

## Backend Development

### Database Migrations
Migrations are in `backend/migrations/` and run automatically on server start via sqlx::migrate!().

To create a new migration:
```bash
sqlx migrate add <name>
```

### API Endpoints

#### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/send-otp | Send OTP to phone |
| POST | /api/v1/auth/verify-otp | Verify OTP, get JWT |
| POST | /api/v1/auth/refresh | Refresh access token |

#### Health Savings Account
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/hsa | Create HSA account |
| GET | /api/v1/hsa | Get user's HSA |
| GET | /api/v1/hsa/dashboard | Dashboard data |

#### Contributions
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/contributions | Create contribution |
| GET | /api/v1/contributions | List contributions |
| GET | /api/v1/contributions/summary | Contribution summary |

#### Partners
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/partners/register | Register partner |
| GET | /api/v1/partners/me | Get partner profile |
| POST | /api/v1/partners/workers | Add worker |
| GET | /api/v1/partners/workers | List workers |
| POST | /api/v1/partners/contributions/bulk | Bulk contribute |
| GET | /api/v1/partners/dashboard | Partner dashboard |

#### Insurance
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/insurance/plans | List plans |
| POST | /api/v1/insurance/subscribe | Subscribe to plan |
| GET | /api/v1/insurance/policies | List policies |
| POST | /api/v1/claims | Submit claim |
| GET | /api/v1/claims | List claims |
| PATCH | /api/v1/claims/:id/review | Review claim (operator) |

### Running Tests
```bash
cd backend
cargo test                          # Run all tests
cargo test -- --test-threads=1      # Sequential (for DB tests)
cargo test test_name                # Run specific test
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | - | PostgreSQL connection string |
| JWT_SECRET | dev-secret | JWT signing secret |
| JWT_EXPIRY_HOURS | 24 | Token expiry |
| PORT | 8080 | Server port |
| HOST | 0.0.0.0 | Bind address |
| RUST_LOG | info | Log level |

## Frontend Development

### Customer & Partner Apps (React Native)
- State management: Zustand
- API calls: Axios + React Query
- Navigation: React Navigation (stack + bottom tabs)
- i18n: i18next with 12+ Indian languages
- Theme: Aarokya design system (see docs/prd/DESIGN_SYSTEM.md)

### Control Center (Next.js)
- Framework: Next.js 14 with App Router
- Styling: Tailwind CSS with Aarokya colors
- Charts: Recharts
- State: Zustand + React Query
- Auth: JWT with middleware protection

### Shared Types
TypeScript interfaces in each app's `src/types/index.ts` match the backend Rust models. Key entities:
- User, HealthSavingsAccount, Contribution, Partner, InsurancePolicy, Claim, HealthProfile

## Testing Strategy

### Backend
- **Unit tests**: Business logic, validation, calculations
- **Integration tests**: API endpoints with test database
- **Load tests**: k6 scripts targeting 10K concurrent users

### Frontend
- **Component tests**: React Testing Library
- **Screen tests**: Integration tests for screen flows
- **E2E tests**: Detox (mobile) / Playwright (web)

### Multi-Agent Adversarial Testing (via claude-fleet)
Each feature goes through:
1. Maker implements
2. Reviewer checks code quality, security, performance
3. Tester writes/runs tests
4. Adversarial agent tries to break it (edge cases, error injection)
5. Fixer resolves all issues

## Docker Deployment
```bash
# Build backend
cd backend
docker build -t aarokya-backend .

# Run all services
docker-compose up -d
```

## Using Claude-Fleet for Parallel Development
```bash
# Install claude-fleet
cd /home/user/claude-fleet && ./install.sh

# Run Phase 1 tasks (4 parallel)
cd /home/user/aarokya
fleet-convert fleet-tasks-phase1.md fleet-tasks-phase1.json
MAX_PARALLEL=4 fleet fleet-tasks-phase1.json

# Run Phase 2 tasks (7 parallel)
fleet-convert fleet-tasks-phase2.md fleet-tasks-phase2.json
MAX_PARALLEL=7 fleet fleet-tasks-phase2.json

# Monitor progress
fleet-dashboard fleet-tasks-phase1.json
```
