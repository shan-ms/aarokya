# Aarokya: Vision, Strategy & Goals

## Executive Summary

Aarokya (from Sanskrit *arogya* = wholistic wellbeing) is an open-source healthcare platform delivering affordable healthcare for India's 200 million gig and informal economy workers. The name phonetically echoes "Are you ok?" — embedding care into the brand itself.

## The Problem

- **India: 1.4B people, 400M+ lack health insurance**
- 62% healthcare spending is out-of-pocket (vs 18% OECD average)
- 55 million Indians pushed into poverty annually by medical costs
- Doctor ratio: 1:1,500 nationally, 1:10,000 rural
- 0.5 hospital beds per 1,000 (vs 2.9 global average)
- **The "Broken Triangle":** Brokers (15-40% commissions), Insurers (profit from claim denials), Hospitals (over-billing) — patients bear all consequences
- 200M gig workers (delivery riders, drivers, domestic help, construction) lack any employer-linked health benefits

## Vision Statement

> "Affordable Healthcare for EVERYONE" — not charity, but infrastructure for the new digital economy. Healthcare that begins with caring, not with crisis.

## Strategic Pillars

### Pillar 1: Save & Insure (Health Savings Accounts)

- Digital healthcare-dedicated accounts linked to ABHA ID, UPI-enabled
- Multi-source micro-contributions:
  - Self: ₹5/day
  - Employers: ₹100-500/month
  - Platforms: ₹2/delivery
  - Customer tips: ₹5-50
  - Family, CSR, community pools
- Purpose-constrained to healthcare only
- At ₹3,999/year → basic insurance through Narayana Health; at ₹10,000/year → ₹5-25 lakh coverage
- **Goal:** 100M families × ₹100/month = ₹12,000 crore/year healthcare funding

### Pillar 2: Prevent with AI

- AI-powered conversational health assistant in 12+ Indian languages (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Malayalam, Punjabi, Odia, Assamese, English)
- Voice and text interfaces
- Symptom collection, risk detection, triage (Low/Medium/High/Emergency)
- AI amplifies doctors 10-100x capacity
- **Philosophy:** "AI gives scale. Empathy gives trust. Professionals give judgment."
- Health profiles linked to ABHA ID

### Pillar 3: Hyperlocal Care Network

- Transform 900,000+ pharmacies into digital healthcare nodes
- Functions: testing center, sample collection, first-line care, medicine distribution, teleconsultation hub
- Investment: ₹15K-₹1L per pharmacy node
- Mesh network: home app → pharmacy → teleconsult → district hospital → specialist

## Technology Foundation

- Open-source architecture, built by Juspay (1,600 engineers, behind HyperSwitch and Namma Yatri)
- **India Stack integration:**
  - Aadhaar (1.3B IDs)
  - UPI (10B+ monthly transactions)
  - ABHA (600M+ health IDs)
  - Jan Dhan (500M accounts)
  - DigiLocker
- **Backend:** Rust (performance, reliability, safety)
- **Frontend:** React Native (customer & partner apps)
- **Control Center:** Web-based for operators
- API-first, SDK-embeddable architecture

## Goals & Success Metrics

### Phase 1 (30-45 days MVP, 6 months maturity): Save & Insure

- 100,000+ HSAs created within 90 days
- 10+ platform partnerships
- Initial insurance policy activations
- Pilot cities: Bengaluru, Pune, Jaipur, Mumbai communities

### Phase 2 (Months 3-9): Preventive Intelligence

- 500,000 monthly AI conversations
- 50,000 screenings
- 30% reduction in late-stage presentations

### Phase 3 (Months 6-18): Hyperlocal Care

- 5,000+ pharmacy nodes
- 200+ lab partners
- Average distance to care under 2km

## Business Model

1. **Transaction fees:** 0.5-1.5% on HSA contributions (₹75-225 crore at 10M users)
2. **Insurance distribution:** 10-20% first-year premium commissions
3. **Healthcare marketplace:** 5-10% facilitation fees
4. **B2B solutions:** employer dashboards, compliance, analytics
5. **Data intelligence:** anonymized health trends (opt-in)

## Unit Economics

| Metric | Year 1 | Year 3 | Year 5 |
|---|---|---|---|
| Users | 100K | 5M | 25M |
| Avg Monthly HSA | ₹800 | ₹1,500 | ₹1,800 |
| Cost/Year | ₹400 | ₹140 | ₹90 |
| Margin | -55% | +60% | +80% |

## Market Opportunity

- 100M families needing healthcare financing
- 200M gig workers with no safety nets
- 850,000+ pharmacies as care nodes
- ₹7+ lakh crore annual healthcare spending (growing 12-15%/year)

## Core Principles

- **"Good economics and good ethics reinforce each other"**
- Prevention cheaper than crisis treatment
- Composable, portable, persistent benefits
- **Privacy-first:** AES-256 at rest, TLS in transit, consent-driven, DPDP Act compliant
- **Open source:** infrastructure, not monopoly
