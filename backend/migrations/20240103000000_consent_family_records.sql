-- Consent records (DPDP Act compliance)
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(100) NOT NULL,        -- 'health_data_processing', 'record_sharing', 'marketing', 'analytics'
    scope TEXT,                            -- JSON description of what's covered
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,             -- NULL = active consent
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_purpose ON consent_records(user_id, purpose);

-- Family profiles (caregiver management)
CREATE TABLE IF NOT EXISTS family_profiles (
    id UUID PRIMARY KEY,
    caregiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) NOT NULL,    -- 'spouse', 'child', 'parent', 'sibling', 'other'
    date_of_birth DATE,
    gender VARCHAR(10),
    blood_group VARCHAR(10),
    allergies JSONB,
    chronic_conditions JSONB,
    emergency_contact VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_family_profiles_caregiver ON family_profiles(caregiver_user_id);

-- Health documents vault
CREATE TABLE IF NOT EXISTS health_documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_profiles(id),
    document_type VARCHAR(50) NOT NULL,   -- 'prescription', 'lab_report', 'discharge_summary', 'insurance_card', 'other'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT,                         -- S3/storage URL
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    tags JSONB,                           -- ['cardiology', 'annual_checkup', etc]
    metadata JSONB,                       -- Additional structured data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_documents_user_id ON health_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_health_documents_type ON health_documents(document_type);

-- Check-in / triage records
CREATE TABLE IF NOT EXISTS checkin_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_profiles(id),
    symptoms JSONB NOT NULL,              -- [{name: "headache", severity: "moderate", duration: "2 days"}]
    urgency_level VARCHAR(20) NOT NULL,   -- 'self_care', 'schedule_visit', 'urgent', 'emergency'
    recommendation TEXT NOT NULL,
    additional_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkin_records_user_id ON checkin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_created ON checkin_records(created_at DESC);

-- Record sharing log (consent-based sharing audit trail)
CREATE TABLE IF NOT EXISTS record_sharing_log (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    document_id UUID REFERENCES health_documents(id),
    shared_with VARCHAR(255) NOT NULL,    -- clinician name/ID or institution
    purpose VARCHAR(100),
    consent_id UUID REFERENCES consent_records(id),
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_record_sharing_user_id ON record_sharing_log(user_id);
