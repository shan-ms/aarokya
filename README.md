# Aarokya — Affordable Healthcare for Everyone

> From Sanskrit *ārogya* (आरोग्य) meaning wholistic wellbeing. "Aarokya... Are you ok?"

An open-source healthcare platform delivering affordable healthcare for India's 200 million gig and informal economy workers through Health Savings Accounts, AI-powered preventive care, and hyperlocal pharmacy networks.

## The Problem

- **62%** of India's healthcare spending is out-of-pocket
- **55 million** Indians pushed into poverty annually by medical costs
- **200 million** gig workers lack any employer-linked health benefits
- **400 million+** Indians have no meaningful health insurance

## The Solution: Three Pillars

### 1. Save & Insure (Phase 1 — v1)
Digital Health Savings Accounts funded by micro-contributions from multiple sources:
- ₹2 per delivery from platforms, ₹100/month from employers, customer tips, family, CSR programs
- At ₹3,999/year → basic insurance coverage; ₹10,000/year → ₹5-25 lakh coverage

### 2. Prevent with AI (Phase 2)
AI-powered health assistant in 12+ Indian languages for symptom screening, triage, and preventive care — amplifying doctors to serve 10-100x more patients.

### 3. Hyperlocal Care Network (Phase 3)
Transform 900,000+ pharmacies into digital healthcare nodes offering testing, teleconsultation, and first-line care within walking distance.

## Repository Structure

```
aarokya/
├── backend/              # Rust API server (Actix-web + PostgreSQL)
├── apps/
│   ├── customer/         # React Native — gig worker app
│   ├── partner/          # React Native — employer/platform app
│   └── control-center/   # Next.js — operator dashboard
├── packages/
│   └── shared/           # Shared TypeScript types
├── docs/
│   ├── vision/           # Product vision, strategy & goals
│   ├── prd/              # Product requirements & design system
│   ├── implementation/   # Phased implementation strategy
│   └── guides/           # Development, testing, deployment guides
├── fleet-tasks-phase1.md # Claude-fleet tasks for parallel Phase 1 dev
└── fleet-tasks-phase2.md # Claude-fleet tasks for parallel Phase 2 dev
```

## Quick Start

```bash
# 1. Start infrastructure
cd backend && docker-compose up -d

# 2. Run backend
cp .env.example .env && cargo run

# 3. Run customer app
cd apps/customer && npm install && npx react-native start

# 4. Run control center
cd apps/control-center && npm install && npm run dev
```

See [Development Guide](docs/guides/DEVELOPMENT_GUIDE.md) for detailed setup.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Rust, Actix-web, SQLx, PostgreSQL |
| Customer App | React Native, TypeScript, Zustand |
| Partner App | React Native, TypeScript, Zustand |
| Control Center | Next.js 14, Tailwind CSS, Recharts |
| Auth | JWT, Phone OTP, ABHA ID |
| Payments | UPI integration |

## Documentation

- [Vision & Strategy](docs/vision/VISION_AND_STRATEGY.md)
- [Product Requirements (PRD)](docs/prd/PRD_V1.md)
- [Design System](docs/prd/DESIGN_SYSTEM.md)
- [Implementation Strategy](docs/implementation/IMPLEMENTATION_STRATEGY.md)
- [Development Guide](docs/guides/DEVELOPMENT_GUIDE.md)
- [Testing Guide](docs/guides/TESTING_GUIDE.md)

## Parallel Development with Claude-Fleet

This project is designed for parallel development using [claude-fleet](https://github.com/nammayatri/claude-fleet):

```bash
# Phase 1: Foundation (4 parallel agents)
fleet-convert fleet-tasks-phase1.md fleet-tasks-phase1.json
MAX_PARALLEL=4 fleet fleet-tasks-phase1.json

# Phase 2: Core Features (7 parallel agents)
fleet-convert fleet-tasks-phase2.md fleet-tasks-phase2.json
MAX_PARALLEL=7 fleet fleet-tasks-phase2.json
```

## Built By

Built on open-source infrastructure by [Juspay](https://juspay.in) — the team behind [HyperSwitch](https://hyperswitch.io) (open-source payments) and [Namma Yatri](https://nammayatri.in) (open-source ride-hailing).

## License

See [LICENSE](LICENSE).
