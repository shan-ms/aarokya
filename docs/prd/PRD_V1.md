# Aarokya v1 — Product Requirements Document

## Overview

Aarokya v1 focuses on Phase 1: "Save & Insure" — building the Health Savings Account (HSA) infrastructure with multi-source micro-contribution rails, insurance eligibility tracking, and the foundational platform.

## Target Users

### 1. Customers (Gig/Informal Workers)

- Delivery riders, auto drivers, domestic workers, construction workers
- Need: portable healthcare savings, insurance access, health tracking
- Tech comfort: basic smartphone, vernacular language preference

### 2. Partners (Contributors/Employers)

- Gig platforms (Swiggy, Zomato, Namma Yatri, Urban Company)
- Household employers of domestic workers
- CSR programs, NGOs
- Need: easy contribution management, compliance reporting, worker wellness dashboards

### 3. Operators (Control Center Users)

- Platform admins, insurance ops, support agents, analytics team
- Roles: Super Admin, Insurance Ops, Support Agent, Analytics Viewer, Partner Manager
- Need: user management, contribution monitoring, insurance processing, analytics

## Core Features — v1

### Customer App (React Native)

**F1: Onboarding & Identity**

- ABHA ID linking / creation
- Aadhaar eKYC verification
- Phone OTP authentication
- Language selection (12+ languages)
- Basic health profile creation

**F2: Health Savings Account**

- HSA dashboard: balance, goal tracking, contribution history
- Self-contribution via UPI
- Insurance eligibility indicator (progress bar to ₹3,999 threshold)
- Top-up opportunities display (matching programs, CSR pools)
- Transaction history with source tracking

**F3: Contribution Tracking**

- View all contribution sources (self, employer, platform, family, tips, CSR)
- Contribution velocity visualization
- Monthly/yearly accumulation reports
- Notification on new contributions

**F4: Insurance Access**

- Insurance readiness dashboard
- Coverage options matched to balance levels
- Premium payment from HSA
- Policy status tracking
- Claims submission (digital-first)

**F5: Health Profile**

- Basic health information storage
- Medication reminders
- Upcoming appointment tracking
- Linked ABHA health records

### Partner App (React Native)

**P1: Partner Onboarding**

- Business verification
- Platform/employer type selection
- Worker roster management (add by phone/ABHA)
- Contribution scheme configuration

**P2: Contribution Management**

- Bulk contribution processing
- Per-worker contribution tracking
- Auto-deduction setup (per-task: ₹2-5, monthly: ₹100-500)
- UPI-based payment processing
- Contribution receipts and tax documentation

**P3: Worker Dashboard**

- View enrolled workers and their HSA status
- Aggregate health savings metrics
- Insurance eligibility overview
- Engagement analytics

**P4: CSR & Compliance**

- CSR contribution tracking and reporting
- Compliance documentation
- Impact metrics (workers covered, savings accumulated)
- Downloadable reports

### Backend (Rust)

**B1: HSA Engine**

- Account creation linked to ABHA ID
- Multi-source contribution ledger (double-entry bookkeeping)
- Balance management with purpose constraints
- Transaction processing with UPI integration
- Goal tracking and eligibility calculations

**B2: Contribution Rails**

- API endpoints for all contribution types
- SDK for platform integration
- Webhook system for real-time contribution notifications
- Batch processing for bulk contributions
- Reconciliation engine

**B3: Insurance Integration**

- Premium calculation and collection
- Policy lifecycle management
- Claims submission and tracking API
- Insurance provider integration layer
- Eligibility engine based on HSA activity

**B4: Identity & Auth**

- ABHA ID integration
- Aadhaar eKYC
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-factor authentication

**B5: Core Infrastructure**

- PostgreSQL for primary data
- Redis for caching and sessions
- Event-driven architecture (async message processing)
- API rate limiting and throttling
- Comprehensive audit logging
- Health check and monitoring endpoints

### Control Center (Web — React/Next.js)

**C1: User Management**

- Customer account overview and search
- Partner account management
- Account verification workflows
- Support ticket system

**C2: Financial Operations**

- Contribution monitoring dashboard
- Transaction audit trails
- Reconciliation tools
- Fraud detection alerts

**C3: Insurance Operations**

- Policy management
- Claims review workflow
- Insurance provider management
- Eligibility override controls

**C4: Analytics & Reporting**

- User growth metrics
- Contribution flow analytics
- Insurance conversion funnel
- Geographic distribution
- Exportable reports

**C5: System Administration**

- Role and permission management
- API key management
- System health monitoring
- Configuration management

## Privacy & Consent (DPDP Act Compliance)

Based on audit against India's Digital Personal Data Protection Act and health app benchmarks:

- **Consent capture**: Plain language notice at onboarding — what we collect, why, who sees it
- **Consent storage**: Database records with timestamps, purpose, and withdrawal capability
- **Privacy center**: Settings screen with "What we collect" / "Why" / "Who you've shared with" / "Download my data" / "Delete my account"
- **Data deletion**: API endpoint + UI flow for account/data erasure
- **Consent withdrawal**: Must be as easy as giving consent (DPDP requirement)
- **Record sharing**: Granular consent scopes — which records, which provider, time-limited, revocable

## Safety & Trust Features

- **Emergency safety mode**: Detect urgent red flags in check-in → emergency guidance + call prompt
- **Safety disclaimer**: "This app can guide you, but it does not replace emergency services"
- **Transparent pricing**: Clear cost breakdown visible before any transaction
- **Clinician verification**: Display medical council registration for all teleconsult providers (required by telemedicine guidelines)
- **AI guardrails**: AI/ML must NOT counsel or prescribe — assist registered doctors only (MoHFW telemedicine guidelines)

## Non-Functional Requirements

- **Performance**: API response < 200ms p95, support 10K concurrent users
- **Security**: AES-256 encryption at rest, TLS 1.3 in transit, OWASP top 10 compliance, OWASP MASVS for mobile
- **Privacy**: DPDP Act compliant, consent-driven data access, minimal collection, data deletion capability
- **Availability**: 99.9% uptime SLA
- **Scalability**: Horizontal scaling, handle 1M+ transactions/day
- **Accessibility**: WCAG 2.2 AA, support low-bandwidth connections, voice-first option, large tap targets

## Data Model (Key Entities)

- User (customer/partner/operator)
- HealthSavingsAccount (linked to user + ABHA)
- Contribution (source, amount, timestamp, type)
- InsurancePolicy (provider, coverage, status, premium)
- Claim (policy, amount, status, documents)
- HealthProfile (user, conditions, medications, allergies)
- Partner (type, workers, contribution_scheme)
- AuditLog (actor, action, target, timestamp)
- ConsentRecord (user, purpose, scope, granted_at, withdrawn_at)
- FamilyProfile (caregiver_user, member_name, relationship, health_profile)

## API Design Principles

- RESTful with OpenAPI 3.0 spec
- Versioned: /api/v1/
- JSON request/response
- Bearer token auth
- Pagination, filtering, sorting on list endpoints
- Idempotency keys for financial operations
- Rate limiting per API key
- Data deletion endpoints for DPDP compliance

