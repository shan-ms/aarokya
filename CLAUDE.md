# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project: Aarokya — Affordable Healthcare Platform

Open-source healthcare platform for India's 200M gig workers. Three pillars: Save & Insure (HSA), Prevent with AI, Hyperlocal Care Network.

## Structure

```
backend/         — Rust API (Actix-web, SQLx, PostgreSQL)
apps/customer/   — React Native customer app (gig workers)
apps/partner/    — React Native partner app (employers/platforms)
apps/control-center/ — Next.js operator dashboard
docs/            — Vision, PRD, implementation strategy, guides
```

## Backend (Rust)

- Framework: Actix-web 4
- Database: PostgreSQL 16 via SQLx (async, compile-time checked queries)
- Auth: JWT (jsonwebtoken crate), Phone OTP
- Money: Always stored in paise (BIGINT), never floating point
- Financial ops: Must use database transactions (BEGIN/COMMIT)
- Idempotency: All financial endpoints require idempotency_key
- Error handling: Use AppError enum → actix ResponseError
- Config: Environment variables via dotenvy

### Build & Test
```bash
cd backend
docker-compose up -d          # Start PostgreSQL + Redis
cargo run                     # Run server (auto-migrates)
cargo test                    # Run tests
cargo check                   # Type check
```

## Frontend Apps

- State: Zustand stores
- API: Axios + React Query (@tanstack/react-query)
- i18n: i18next (12+ Indian languages)
- Navigation: React Navigation (stack + bottom tabs)
- Theme: Aarokya design system (Primary #2563EB, Secondary #10B981, Accent #F59E0B)
- Currency display: Always format paise as ₹X,XXX.XX

## Control Center (Next.js)

- Next.js 14, App Router
- Tailwind CSS with Aarokya colors
- Charts: Recharts
- Auth: JWT middleware

## Key Domain Rules

- HSA balance >= ₹3,999 (399900 paise) → basic insurance eligible
- HSA balance >= ₹10,000 (1000000 paise) → premium insurance eligible
- Contribution source types: self, employer, platform, family, tip, csr, community, government
- User types: customer, partner, operator
- Operator roles: super_admin, insurance_ops, support, analytics, partner_manager

## Parallel Development

Fleet task files in repo root for claude-fleet parallel execution:
- fleet-tasks-phase1.md — Foundation infrastructure (4 parallel tasks)
- fleet-tasks-phase2.md — Core features (7 parallel tasks)
