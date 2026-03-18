# Aarokya — Implementation Strategy

## Overview
Phased implementation with multi-agent adversarial review loops (maker-checker pattern) at every stage. Each phase goes through: Design → Implement → Review → Test → Fix → Ship.

## Quality Assurance: Multi-Agent Adversarial Loop

### Maker-Checker Pattern
For every implementation phase:
1. **Maker Agent**: Implements the feature/module
2. **Reviewer Agent**: Reviews code for correctness, security, performance, and adherence to specs
3. **Test Agent**: Writes and runs comprehensive tests (unit, integration, e2e)
4. **Adversarial Agent**: Attempts to break the implementation — edge cases, error injection, load testing
5. **Fix Agent**: Addresses all issues found by reviewer, tester, and adversarial agents
6. **Final Verification**: Re-run all tests, confirm all review comments resolved

### Review Checklist
- [ ] Code correctness and logic
- [ ] Error handling (all error paths covered)
- [ ] Security (OWASP top 10, input validation, auth checks)
- [ ] Performance (no N+1 queries, proper indexing, caching)
- [ ] Data integrity (transactions, constraints, validation)
- [ ] API contract adherence (matches OpenAPI spec)
- [ ] Test coverage (>80% line coverage, critical paths 100%)
- [ ] Documentation (public APIs documented)
- [ ] Accessibility (WCAG 2.1 AA for frontend)
- [ ] Internationalization (all strings externalized)

---

## Phase 1: Foundation Infrastructure (Weeks 1-2)

### 1.1 Backend Core Setup
**Deliverables:**
- Rust project with Actix-web framework
- PostgreSQL database with migrations (sqlx)
- Configuration management (environment-based)
- Logging and tracing (tracing crate)
- Error handling framework
- Health check endpoints
- Docker setup for local development

**Key Crates:**
- actix-web (HTTP server)
- sqlx (async PostgreSQL)
- serde (serialization)
- tokio (async runtime)
- tracing (observability)
- jsonwebtoken (JWT auth)
- argon2 (password hashing)
- uuid (ID generation)
- chrono (datetime)
- validator (input validation)

**Database Schema (initial):**
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL UNIQUE,
    abha_id VARCHAR(20) UNIQUE,
    aadhaar_hash VARCHAR(64),
    name VARCHAR(255),
    email VARCHAR(255),
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'partner', 'operator')),
    language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Savings Accounts
CREATE TABLE health_savings_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    abha_id VARCHAR(20) NOT NULL,
    balance_paise BIGINT NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
    total_contributed_paise BIGINT NOT NULL DEFAULT 0,
    insurance_eligible BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributions
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hsa_id UUID NOT NULL REFERENCES health_savings_accounts(id),
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('self', 'employer', 'platform', 'family', 'tip', 'csr', 'community', 'government')),
    source_id UUID,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    reference_id VARCHAR(100),
    idempotency_key VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'completed',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partners
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    partner_type VARCHAR(30) NOT NULL CHECK (partner_type IN ('gig_platform', 'household', 'employer', 'csr', 'ngo')),
    business_name VARCHAR(255),
    business_reg_number VARCHAR(100),
    contribution_scheme JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner-Worker associations
CREATE TABLE partner_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id),
    worker_user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_id, worker_user_id)
);

-- Insurance policies
CREATE TABLE insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    hsa_id UUID NOT NULL REFERENCES health_savings_accounts(id),
    provider VARCHAR(100) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    premium_paise BIGINT NOT NULL,
    coverage_paise BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id),
    user_id UUID NOT NULL REFERENCES users(id),
    claim_amount_paise BIGINT NOT NULL,
    approved_amount_paise BIGINT,
    status VARCHAR(20) DEFAULT 'submitted',
    description TEXT,
    documents JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Health profiles
CREATE TABLE health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(10),
    blood_group VARCHAR(5),
    conditions JSONB DEFAULT '[]',
    medications JSONB DEFAULT '[]',
    allergies JSONB DEFAULT '[]',
    emergency_contact JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_type VARCHAR(20),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contributions_hsa_id ON contributions(hsa_id);
CREATE INDEX idx_contributions_created_at ON contributions(created_at);
CREATE INDEX idx_hsa_user_id ON health_savings_accounts(user_id);
CREATE INDEX idx_policies_user_id ON insurance_policies(user_id);
CREATE INDEX idx_claims_policy_id ON claims(policy_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
```

**Review Focus:** Schema normalization, index strategy, constraint completeness

### 1.2 Authentication & Authorization
**Deliverables:**
- Phone OTP authentication flow
- JWT token issuance and validation (access + refresh tokens)
- RBAC middleware with roles: customer, partner, operator (super_admin, insurance_ops, support, analytics, partner_manager)
- Session management
- Rate limiting per user/IP

**Review Focus:** Token security, permission boundaries, rate limit effectiveness

### 1.3 React Native Project Setup
**Deliverables:**
- Monorepo setup with shared packages
- Customer app scaffold (React Native + TypeScript)
- Partner app scaffold (React Native + TypeScript)
- Shared UI component library (buttons, inputs, cards, navigation)
- Navigation structure (React Navigation)
- State management (Zustand)
- API client layer (Axios + React Query)
- i18n setup (12 languages)
- Theme system matching design system

**Review Focus:** Project structure, dependency choices, bundle size

### 1.4 Control Center Setup
**Deliverables:**
- Next.js project with TypeScript
- Authentication (same JWT as backend)
- Dashboard layout with sidebar navigation
- Role-based route protection
- Shared API client
- Table components with pagination, search, filtering
- Form components with validation

**Review Focus:** SSR strategy, auth flow, component reusability

---

## Phase 2: HSA Engine (Weeks 3-4)

### 2.1 HSA Account Management
- Create/read/update HSA accounts
- Link to ABHA ID
- Balance queries (real-time)
- Account status management
- Purpose-constraint enforcement

### 2.2 Contribution Processing
- Multi-source contribution API (self, employer, platform, family, tip, csr, community, government)
- Idempotency for financial operations
- Double-entry bookkeeping ledger
- Batch contribution processing
- Real-time balance updates
- Webhook notifications on contribution

### 2.3 SDK for Platform Integration
- Lightweight SDK (JavaScript/TypeScript) for gig platforms
- Endpoints: create_contribution, get_worker_balance, register_worker
- API key management
- Usage metering
- Integration documentation

**Review Focus:** Financial accuracy, idempotency correctness, race conditions

---

## Phase 3: Insurance Integration (Weeks 5-6)

### 3.1 Eligibility Engine
- Rule-based eligibility calculation (HSA balance thresholds)
- Contribution velocity scoring
- Insurance readiness dashboard data
- Coverage recommendations based on balance

### 3.2 Policy Management
- Insurance plan catalog
- Premium calculation and collection from HSA
- Policy issuance workflow
- Renewal management
- Status tracking

### 3.3 Claims Processing
- Digital claims submission
- Document upload and management
- Claims review workflow (for control center)
- Status tracking and notifications
- Provider settlement tracking

**Review Focus:** Regulatory compliance, edge cases in eligibility, claims workflow completeness

---

## Phase 4: Customer App Features (Weeks 5-8)

### 4.1 Onboarding Flow
- Language selection screen
- Phone + OTP auth
- ABHA ID link/create
- Basic health profile
- HSA account creation

### 4.2 Home Screen & HSA Dashboard
- Balance display with animation
- Insurance eligibility progress bar
- Quick actions (contribute, view history, insurance)
- Recent contributions list
- Health tips carousel

### 4.3 Contribution & History
- Self-contribution via UPI deeplink
- Source-wise contribution breakdown
- Monthly/yearly charts
- Transaction detail view

### 4.4 Insurance Section
- Eligibility meter
- Available plans list
- Plan comparison
- Premium payment flow
- Active policy display
- Claims submission

### 4.5 Health Profile
- View/edit health info
- Medication reminders (local notifications)
- Linked records placeholder (ABHA)

**Review Focus:** UX accessibility, offline capability, low-bandwidth performance

---

## Phase 5: Partner App Features (Weeks 5-8)

### 5.1 Partner Onboarding
- Business verification flow
- Partner type selection
- Contribution scheme configuration

### 5.2 Worker Management
- Add workers (phone/ABHA search)
- Worker list with HSA status
- Bulk import via CSV

### 5.3 Contribution Management
- Individual contributions
- Bulk contribution (batch upload)
- Auto-deduction configuration
- Payment processing
- Receipt generation

### 5.4 Reports & Analytics
- Contribution summary dashboard
- Worker coverage metrics
- CSR impact reports
- Exportable CSV/PDF reports

**Review Focus:** Bulk operation reliability, financial accuracy

---

## Phase 6: Control Center Features (Weeks 5-8)

### 6.1 Dashboard
- System health metrics
- User growth charts
- Financial overview (total HSA value, daily contributions)
- Alert panel

### 6.2 User Management
- Customer search and detail view
- Partner management
- Account verification workflow
- Support ticket integration

### 6.3 Financial Operations
- Transaction explorer
- Reconciliation tools
- Contribution anomaly detection
- Manual adjustment workflow (with audit trail)

### 6.4 Insurance Operations
- Policy management interface
- Claims review queue
- Approval/rejection workflow
- Provider management

### 6.5 Analytics
- Configurable charts
- Funnel analysis
- Geographic heat maps
- Export functionality

**Review Focus:** Role permission enforcement, audit trail completeness

---

## Phase 7: Integration & Hardening (Weeks 9-10)

### 7.1 End-to-End Testing
- Full user journey tests (onboarding → contribute → insure → claim)
- Multi-role workflow tests
- Cross-platform compatibility
- Load testing (target: 10K concurrent, 1M tx/day)

### 7.2 Security Hardening
- Penetration testing
- OWASP compliance audit
- Data encryption verification
- Access control audit
- Dependency vulnerability scan

### 7.3 Performance Optimization
- API response time optimization (<200ms p95)
- Database query optimization
- React Native bundle optimization
- Image/asset optimization
- CDN configuration

### 7.4 Documentation
- API documentation (OpenAPI spec)
- SDK documentation
- Deployment guides
- Runbooks for operations

---

## Phase 8: Deployment & Launch (Weeks 11-12)

### 8.1 Infrastructure
- Kubernetes cluster setup
- Database provisioning (managed PostgreSQL)
- Redis cluster
- CI/CD pipeline
- Monitoring (Prometheus + Grafana)
- Alerting
- Log aggregation

### 8.2 Launch
- Pilot city deployment (Bengaluru)
- Beta testing with select gig workers
- Partner onboarding (Namma Yatri first)
- Gradual rollout

---

## Claude-Fleet Parallel Execution Strategy

Each phase's tasks are designed to run in parallel where possible:
- Phase 1: Backend + Customer App + Partner App + Control Center (4 parallel streams)
- Phase 2-3: Backend features (can run in parallel)
- Phase 4-6: All three frontends in parallel
- Phase 7: Review + Test + Security (3 parallel streams)
- Phase 8: Sequential (infrastructure → deploy)

Fleet task files will be generated for each phase to maximize parallelism.
