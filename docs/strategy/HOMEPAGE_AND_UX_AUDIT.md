# Aarokya Homepage & UX Audit — Findings and Action Items

Based on external audit of aarokya.pages.dev, health app market benchmarking (15+ apps across India and global markets), and regulatory review (DPDP Act, ABDM, Telemedicine Guidelines).

## Key Finding: Homepage Needs Restructuring

**Current state:** The homepage at aarokya.pages.dev reads as a long-form manifesto/project brief with table of contents, phased roadmap, and appendices. This works well for partners, contributors, and early believers.

**Gap:** It does not function as a product landing page. A health app homepage must answer within seconds: *what can I do here, is it safe, how do I start.* Today there is no primary CTA, no product preview, and no fast path for top user journeys.

### Recommended Fix

Keep the current content but move it out of the primary homepage role:

- **Root path** → Minimal product home: hero ("Are you okay?"), 3 quick actions, trust strip, privacy link, onboarding CTA
- **`/vision` or `/docs`** → Current long-form narrative, linked from navigation

### Main Page Structure

```
1. Hero: "Are you okay?" + "Get a safe next step in minutes."
2. Primary CTA: "Start a quick check-in"
3. Quick actions: "Talk to a clinician" | "Book a test or visit" | "My records"
4. Trust strip: Privacy commitment, consent controls, clinician verification, pricing transparency
5. Disclaimer: "If this is an emergency, call your local emergency number now."
6. Footer: Privacy center link, language selector, social links
```

---

## Feature Gaps: What Top Health Apps Do That Aarokya Doesn't (Yet)

### P0 — Must-Have for MVP (missing or incomplete)

| Feature | Current Status | Why It Matters |
|---------|---------------|----------------|
| Guided symptom check-in ("Are you okay?" triage) | Not built — brand uses the phrase but no actual check-in flow exists | Converts anxiety into safe next steps; reduces drop-offs; builds trust |
| Emergency safety mode | Not built | Detect urgent red flags → route to emergency help. Critical for credibility |
| Transparent pricing / "what happens next" | Not surfaced | Reduces fear of hidden costs — major barrier for target users (gig workers) |
| Privacy center (plain language) | Not built — DPDP compliance is stated as a goal but no UI exists | DPDP Act requires consent that is "free, specific, informed, and as easy to withdraw as to give" |
| Consent-based record sharing | Not built | Must support granular scopes and revocation. Required for ABDM alignment |

### P1 — Next Priority

| Feature | Current Status | Why It Matters |
|---------|---------------|----------------|
| Family profiles / caregiver flows | Not built | Caregivers managing multiple family members is a huge use case in India |
| Reminders (meds, follow-ups, tests) | Listed in PRD but not implemented | Ongoing engagement value; drives preventive behavior |
| Records vault (upload/scan/tag) | Listed in PRD but minimal implementation | Reduces repetition at care visits; improves consult quality |
| Hyperlocal partner directory (pharmacy/lab) | Phase 3 roadmap item | Core to the vision but needs earlier prototyping |

### P2 — Later

| Feature | Notes |
|---------|-------|
| ABHA-connected record linking (HIE-CM) | High complexity; depends on ABDM ecosystem access |
| AI assistance for clinicians | Telemedicine guidelines: AI/ML must NOT counsel or prescribe, only assist registered doctors |
| FHIR-based health data model | Future interoperability |

---

## Regulatory Compliance Gaps

### 1. DPDP Act (Digital Personal Data Protection)

**Requirements:**
- Consent must be free, specific, informed, unconditional, unambiguous
- Withdrawal must be as easy as giving consent
- Data fiduciary must provide notice before collection
- Right to erasure and grievance redressal

**Current gap:** No consent management UI, no privacy center, no deletion flow in the app. The backend has no consent storage or audit trail for data processing purposes.

**Action items:**
- Add consent capture during onboarding (plain language notice: what we collect, why, who sees it)
- Build privacy center in settings: "What we collect" / "Why" / "Who you've shared with" / "Download my data" / "Delete my account"
- Store consent records with timestamps and withdrawal capability
- Add data deletion API endpoint

### 2. Telemedicine Practice Guidelines (MoHFW)

**Requirements:**
- Patient consent: implied when patient initiates, explicit when caregiver/health worker initiates
- Platform must verify clinician registration (medical council number)
- AI/ML platforms must NOT counsel or prescribe medicines
- Grievance mechanism required
- Documentation and audit trail of teleconsults

**Current gap:** No telemedicine features built yet (Phase 2), but these constraints must be designed in from the start.

**Action items:**
- When building teleconsult: capture consent correctly (implied vs explicit based on initiator)
- Verify and display clinician credentials
- Any AI features must be "assist only" — never autonomous prescribing
- Build grievance submission flow

### 3. ABDM (Ayushman Bharat Digital Mission)

**Requirements:**
- Federated architecture with consent-based sharing via HIE-CM (Health Information Exchange - Consent Manager)
- Granular, revocable consent for record sharing
- ABHA as universal health identifier

**Current status:** ABHA ID linking is in the onboarding flow, but no consent manager integration exists.

**Action items (P2):**
- Design consent exchange flow aligned to ABDM HIE-CM patterns
- Implement granular consent scopes (which records, which provider, time-limited)

---

## Onboarding Flow Improvements

### Current Flow
Language → Phone → OTP → ABHA Link → Health Profile

### Recommended Flow (from benchmarking)

```
1. Language selection + "Who is this for?" (me / family member)
2. Phone + OTP
3. Intent-first: "What do you need?" (feeling unwell / book care / store records / save for health)
4. Minimal profile (age range, location — only what's needed for safety)
5. Short consent notice (DPDP-aligned, plain language)
6. ABHA linking (optional, can skip and do later)
7. Health profile (progressive — collect more over time, not all upfront)
```

**Key principles from top apps:**
- **Intent-first**: Ask what user needs before collecting details
- **Progressive profiling**: Minimum data first, richer profile later
- **Clear consent**: Short, plain language, easy withdrawal

---

## Microcopy Recommendations

### Main Page
- **Headline:** "Are you okay?"
- **Subhead:** "Get a safe next step in minutes."
- **Trust line:** "You control what you share. Delete anytime."

### Consent (short, clear)
- "We use your information to provide care and keep your records safe."
- "You can review and withdraw consent in Settings."

### Safety Disclaimer
- "If you think this is an emergency, please call your local emergency number now."
- "This app can guide you, but it does not replace emergency services."

### Privacy Center Labels
- "What we collect"
- "Why we collect it"
- "Who you have shared with"
- "Download my data"
- "Delete my account"

---

## Security Benchmarking Notes

From Google Play "Data safety" patterns across top health apps:

| Practice | Prevalence | Aarokya Status |
|----------|-----------|----------------|
| Encryption in transit | Universal | Done (TLS) |
| Encryption at rest | Common for health apps | Stated goal, not verified |
| "No data shared with third parties" | Common for health/records apps | Not declared |
| "Request data deletion" | Universal | Not implemented |
| Accessibility statement | Some apps (e.g., Flo) | Not present |

**Recommended:** Align to OWASP MASVS (Mobile Application Security Verification Standard) as a baseline for mobile security.

---

## Accessibility Gaps

**Current PRD states:** WCAG 2.1 AA compliance as non-functional requirement.

**Audit recommendation:** Upgrade target to WCAG 2.2, which adds:
- Better touch target sizing (minimum 24x24 CSS pixels)
- Focus appearance requirements
- Dragging alternatives

**India-specific accessibility needs:**
- Voice-first option for low-literacy users
- Large tap targets for older users
- Low-bandwidth optimization (already noted in design system)
- 12+ language support (already planned)
- Consider on-device voice processing where possible (voice data is sensitive)

---

## Market Positioning Summary

### Aarokya's Unique Differentiators vs Competitors

| Competitor Category | Examples | What They Do | What Aarokya Adds |
|-------------------|----------|-------------|------------------|
| Booking/Teleconsult | Practo, Apollo 24/7 | Doctor booking, pharmacy | HSA + multi-source funding rails for affordability |
| Pharmacy/Labs | Tata 1mg, PharmEasy | Medicine delivery, lab booking | Purpose-constrained health savings, not just commerce |
| Wellness | HealthifyMe, cult.fit | Fitness, nutrition | Targets underserved gig workers, not premium users |
| Government | ABHA, eSanjeevani | Health ID, free teleconsult | Composable platform with private sector contribution rails |
| Symptom Checker | Ada Health | AI triage | Combined with HSA + care access (end-to-end) |

**Aarokya's moat:** The HSA-as-infrastructure model with multi-source micro-contributions is genuinely novel. No Indian health app combines health savings + insurance eligibility + care access in one flow for informal workers.

---

## Implementation Priority for Current Codebase

Given the current v1 (Phase 1: Save & Insure) is built, here's what should come next based on this audit:

### Immediate (before any new features)
1. **Privacy center UI** — Settings screen with consent management, data download, account deletion
2. **Data deletion API** — Backend endpoint to handle account/data erasure
3. **Consent storage** — Database table for consent records with timestamps

### Next Sprint
4. **Homepage restructure** — Move manifesto to `/vision`, create product landing page
5. **"Are you okay?" check-in flow** — Guided symptom triage (text-based, no AI needed for v1)
6. **Emergency mode** — Red flag detection → emergency guidance modal
7. **Onboarding revision** — Intent-first flow, progressive profiling

### Following Sprint
8. **Records vault** — Upload/scan/tag medical documents
9. **Family profiles** — Caregiver management for multiple family members
10. **Transparent pricing page** — Clear cost breakdown for all services
