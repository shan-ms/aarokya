-- operator_insurance_ops, operator_partner_manager etc. need more than 20 chars
ALTER TABLE users ALTER COLUMN user_type TYPE VARCHAR(50);
