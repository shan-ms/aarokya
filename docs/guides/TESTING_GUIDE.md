# Aarokya — Testing Guide

## Testing Philosophy
Every feature goes through a multi-agent adversarial testing loop before shipping:
1. Implementation (Maker)
2. Code Review (Reviewer) - correctness, security, performance
3. Automated Tests (Tester) - unit, integration, e2e
4. Adversarial Testing (Breaker) - edge cases, error injection, load
5. Fix & Verify (Fixer) - resolve all issues, re-test

## Backend Testing

### Unit Tests
Test business logic in isolation:
- HSA balance calculations
- Insurance eligibility rules (balance >= ₹3,999 for basic, >= ₹10,000 for premium)
- Contribution validation (valid source types, positive amounts)
- JWT token generation and validation
- Input validation

### Integration Tests
Test API endpoints against a test database:
- Auth flow: send OTP → verify → get token → access protected route
- HSA flow: create account → contribute → check balance → check eligibility
- Partner flow: register → add worker → bulk contribute → view dashboard
- Insurance flow: check eligibility → subscribe → submit claim → review claim
- Idempotency: same idempotency_key returns same result
- Error cases: invalid input, unauthorized access, not found

### Security Tests
- SQL injection attempts in all string inputs
- JWT manipulation (expired, wrong signature, missing claims)
- RBAC enforcement (customer can't access partner routes, etc.)
- Rate limiting verification (>5 OTPs in 10 minutes blocked)
- Input size limits

### Performance Tests
- API response time < 200ms p95
- Concurrent contribution processing (no race conditions)
- Database query performance (check EXPLAIN for N+1)
- Connection pool under load

## Frontend Testing

### Component Tests
- Button renders correctly in all variants
- ProgressBar shows correct percentage
- BalanceCard formats currency correctly (₹1,234.56)
- ContributionItem displays source type with correct icon

### Screen Tests
- HomeScreen loads and displays dashboard data
- OTPScreen validates 6-digit input
- ContributeScreen validates amount (min ₹1, max ₹100,000)
- InsuranceScreen shows correct eligibility state

### Integration Tests
- Full auth flow (welcome → phone → otp → home)
- Contribution flow (home → contribute → amount → confirm → updated balance)
- Insurance flow (insurance → plans → subscribe → active policy)

## Running Tests

### Backend
```bash
cd backend
# Ensure test DB is running
docker-compose up -d postgres

# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific module
cargo test api::hsa::tests
```

### Frontend (Customer/Partner)
```bash
cd apps/customer  # or apps/partner
npm test                    # Jest tests
npm run test:coverage       # With coverage
```

### Control Center
```bash
cd apps/control-center
npm test
npm run test:e2e           # Playwright
```

## Test Data

### Seed Data
The backend can be seeded with test data:
- 10 test customers with HSAs
- 3 test partners (gig platform, household, CSR)
- Sample contributions across all source types
- Insurance plans (Basic ₹3,999, Standard ₹6,999, Premium ₹9,999)
- Sample claims in various states

### Test Credentials
- Customer phone: +91 9999900001 (OTP: 123456 in dev)
- Partner phone: +91 9999900002
- Operator phone: +91 9999900003
