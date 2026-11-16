# State model and eligibility enforcement

What the database holds today, and how publishing, visibility and booking
are gated. The rules live in `src/lib/eligibility/rules.ts`, with a SQL
mirror in `supabase/migrations/20261114100100_eligibility_enforcement.sql`
(not applied yet). Synthetic checks: `node scripts/check-eligibility.mjs`.

## Current states (from `supabase/migrations`)

| Record | Column | States | Who changes it |
| --- | --- | --- | --- |
| Professional application | `contractor_profiles.verification_status` (`provider_verification_status`) | `not_submitted` → `pending_review` ⇄ `more_info_requested` → `approved` / `insurance_pending` / `rejected`; `suspended` | Admin / service role only (trigger `contractor_profiles_protect_verification`) |
| Provider agreement | `contractor_profiles.contractor_agreement_accepted_at`, `_version` | null → timestamp | `accept_contractor_agreement()` RPC, only when approved / insurance_pending |
| Compliance hold | `contractor_profiles.compliance_hold_reason` | null / text | Admin, or the daily compliance cron when a license / cert / ID lapses |
| Malpractice coverage | `contractor_profiles.insured_verified_at` + a verified, unexpired `credentials` row of type `malpractice_insurance` (`is_insured()`) | — | Admin document review |
| Credentials | `credentials.status` | `pending_upload`, `pending_review`, `verified`, `expiring_soon`, `expired`, … | Owner uploads, admin reviews (trigger `protect_credential_review_columns`) |
| Professional listing | `professional_offerings.status` | `draft` ⇄ `pending_review` → `published` / `rejected` / `paused` | Owner: draft ⇄ pending_review only. Admin: publish / reject / pause. Editing a reviewed listing sends it back to draft |
| Organization | `facility_profiles.verification_status` (`org_verification_status`) | `pending_review`, `needs_info`, `approved`, `suspended`, `rejected` | Admin only. `onboarding_submitted_at` marks the verification submission |
| Organization agreement | `facility_profiles.org_agreement_accepted_at` | null → timestamp | `accept_org_agreement()` RPC, only when approved |
| Organization listing | `org_listings.status` | `draft` ⇄ `in_review` → `published` (admin can send back to `draft`) | Owner: draft ⇄ in_review (needs `org_can_publish`). Admin: publish |
| Organization job post | `jobs.status` | `draft` → `open` / … | Leaving draft needs approved org + agreement |
| Booking | `org_bookings.status` | `requested` → `quoted` / `accepted` / `declined`; → `cancelled` (+ payment states) | SECURITY DEFINER RPCs only |
| Inquiry / invite | `org_inquiries.status` | `sent` → `accepted` / `declined` | Org sends (approved only); professional responds |

There is **no booking table for professional listings** yet. Professionals
transact through job applications (`job_applications`, gated by
`can_go_live`) and org inquiries.

"Live" (`can_go_live`) = contractor role, `approved` or `insurance_pending`,
agreement accepted, no compliance hold. The new migration adds: active
account, and no lapsed license / certification / government ID.

## Eligibility rules (one function per listing type)

`evaluateOffering(action, provider, offering, now, ctx)` and
`evaluateOrgListing(action, org, listing, now)` return `eligible`,
`manual_review` or `ineligible` plus reasons. `manual_review` counts as
not allowed everywhere.

| Action | Professional listing | Organization listing |
| --- | --- | --- |
| `submit` (owner sends to review) | provider live, listing complete | org approved + agreement |
| `publish` (admin) | provider live; status `pending_review` / `paused`; coverage if high-risk | org approved + agreement; status `in_review`; not high-risk |
| `view` (public) | `published` + provider live + coverage if high-risk | `published` + org approved + agreement + not high-risk |
| `book` | `view` + clinical location rules | `view` + event not past |

- **Pending, rejected, suspended, incomplete, held, inactive, or
  expired-credential providers** can't submit, publish, show or be booked.
- **Approval never publishes.** `applyApproval` doesn't touch listings;
  `markInsuranceVerified` moves paused listings back to `pending_review`, not
  to published. The new trigger refuses draft/rejected → published for
  every caller, admins and the service role included.
- **Availability doesn't affect eligibility.** `is_available`, "Accepting
  clients" and weekly hours aren't inputs to the rules.
- **High-risk (needs reviewed malpractice coverage):** home visits;
  prescribing, injectables, IVs (`involves_medical_procedures`); hands-on
  care (`hands_on_care`, new and nullable); in-person services unless
  `hands_on_care = false` or the provider is a consultant / educator.
  Consulting and events are never high-risk unless flagged. There is no
  grace period: `insurance_pending` providers stay live for low-risk
  listings, but high-risk ones don't publish or show until coverage is
  reviewed.
- **Organization high-risk services** (home visit, flagged, or in-person /
  hybrid without both flags explicitly false) are blocked. Organizations
  have no way to submit a coverage document.
- **Clinical location:** a clinical professional's service booking is
  `manual_review` (there's no maintained scope or jurisdiction ruleset), and
  `ineligible` when the client's state is outside the provider's
  `license_state` / `license_states` (plus `telehealth_states` for virtual
  services). Admin listing review is the manual review for publishing.
- **Coverage badge:** reads "Insurance document on file", with a tooltip
  saying Ocora doesn't verify with the carrier or judge whether the coverage
  is adequate.

## Enforcement points

App layer (clear messages; service-role reads via `src/lib/eligibility/server.ts`):

- `src/app/api/admin/listings/[offeringId]/route.ts`: admin publish
- `src/app/admin/review/org-listings/actions.ts`: admin org-listing publish
- `src/app/(dashboard)/contractor/listings/actions.ts`: `submitListingForReview`
- `src/lib/bookings/actions.ts`: `requestBooking`
- `src/app/(dashboard)/facility/contractors/[id]/inquiry-actions.ts`: `sendOrgInquiry`
- `src/lib/find-care/profile.ts`: public offerings on `/pros/[id]`

Database (`20261114100100_eligibility_enforcement.sql`):

- `can_go_live()`: active account and current credentials (picked up by
  every existing policy and trigger that calls it)
- `offering_is_high_risk()`, `offering_is_eligible()`, `can_publish_offering()`
- `enforce_offering_status_rules()`: refuses publishing a listing that wasn't
  submitted, uses the new high-risk rule
- `professional_offerings_select_published` policy
- `org_listings_publish_gate` trigger and the `org_listings_select` policy
- `org_bookings_require_eligible_listing` trigger
- `org_inquiries_require_live_professional` trigger

## Decisions needed (not implemented)

1. **Malpractice grace period:** what starts the 30-day clock, what's allowed
   during it, what happens at lapse, and how existing bookings are handled.
   For now high-risk work is blocked without reviewed coverage.
2. **Clinical ruleset:** service × credential × modality × client state,
   who maintains it, and how staleness is detected. For now clinical
   bookings go to manual review.
3. **Organization coverage model:** whether organizations can offer
   hands-on, in-person, home-visit, or medical-procedure services, and what
   evidence they'd provide. Also needed: UI on org and professional listing
   forms to declare `hands_on_care` / `involves_medical_procedures`. Until
   that exists, in-person org services stay blocked.
4. **Consultant / educator in-person services** are treated as
   non-high-risk. Confirm this, or require declared flags.
5. **Professional booking flow:** none exists yet. When one is added it must
   call `evaluateOffering('book', …)` and route `manual_review` to a
   review queue.
6. **Identity/licensure proof vs. application status:** these are still one
   `verification_status`. Splitting them needs a product decision on
   reviewer evidence and procedure.
