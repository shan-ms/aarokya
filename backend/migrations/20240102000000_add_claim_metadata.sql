-- Add hospital_name, diagnosis, and document_urls columns to claims table
ALTER TABLE claims ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS diagnosis VARCHAR(500);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS document_urls JSONB;
