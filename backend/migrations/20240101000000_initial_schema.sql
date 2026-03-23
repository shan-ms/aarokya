-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    abha_id VARCHAR(50) UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    user_type VARCHAR(20) NOT NULL DEFAULT 'customer',
    language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_abha_id ON users(abha_id);

-- Health Savings Accounts
CREATE TABLE IF NOT EXISTS health_savings_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    abha_id VARCHAR(50) NOT NULL,
    balance_paise BIGINT NOT NULL DEFAULT 0,
    total_contributed_paise BIGINT NOT NULL DEFAULT 0,
    insurance_eligible BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsa_user_id ON health_savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_hsa_abha_id ON health_savings_accounts(abha_id);

-- Contributions
CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY,
    hsa_id UUID NOT NULL REFERENCES health_savings_accounts(id),
    source_type VARCHAR(30) NOT NULL,
    source_id UUID,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    reference_id VARCHAR(255),
    idempotency_key VARCHAR(255),
    status VARCHAR(20) DEFAULT 'completed',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_hsa_id ON contributions(hsa_id);
CREATE INDEX IF NOT EXISTS idx_contributions_source_type ON contributions(source_type);
CREATE INDEX IF NOT EXISTS idx_contributions_idempotency ON contributions(idempotency_key, hsa_id);
CREATE INDEX IF NOT EXISTS idx_contributions_created_at ON contributions(created_at DESC);

-- Partners
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    company_name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(50) NOT NULL,
    gstin VARCHAR(20),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);

-- Partner Workers
CREATE TABLE IF NOT EXISTS partner_workers (
    id UUID PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id),
    worker_user_id UUID NOT NULL REFERENCES users(id),
    external_worker_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_id, worker_user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_workers_partner_id ON partner_workers(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_workers_worker_id ON partner_workers(worker_user_id);

-- Insurance Policies
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY,
    hsa_id UUID NOT NULL REFERENCES health_savings_accounts(id),
    plan_id VARCHAR(50) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    premium_paise BIGINT NOT NULL,
    coverage_paise BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_hsa_id ON insurance_policies(hsa_id);

-- Claims
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY,
    policy_id UUID NOT NULL REFERENCES insurance_policies(id),
    hsa_id UUID NOT NULL REFERENCES health_savings_accounts(id),
    claim_type VARCHAR(50) NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    description TEXT,
    status VARCHAR(20) DEFAULT 'submitted',
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_policy_id ON claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_hsa_id ON claims(hsa_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Health Profiles
CREATE TABLE IF NOT EXISTS health_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    blood_group VARCHAR(10),
    allergies JSONB,
    chronic_conditions JSONB,
    emergency_contact VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_profiles_user_id ON health_profiles(user_id);
