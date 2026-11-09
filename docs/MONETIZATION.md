# Sanus monetization brainstorm (Nov 2026)

**Today:** free to join, free to go live, no monthly plan. The only revenue
built is a 10% fee taken from the organization's payout on org bookings
(`src/lib/bookings/fees.ts`, `BOOKING_FEE_PERCENT`). Stripe keys aren't in
Vercel yet, so it's dormant.

**Goal for the OC soft launch:** reach $50k GMV with as little friction as
possible. Every option below is judged on (1) whether it slows supply
signups, (2) whether people can route around it, and (3) HIPAA/legal risk.

## Recommended path

| Phase | When | Model | Why |
|---|---|---|---|
| 1 | Now → first $50k GMV | **Take rate on bookings paid through Sanus**: 10% from the professional/org, 0–5% service fee on the customer | Free to list keeps supply growing. Fee only when money moves, so it's easy to explain. |
| 2 | Once there's steady demand | **Sanus Pro subscription** for professionals ($29–59/mo): lower take rate (e.g. 5%), featured placement, analytics, custom booking page, more photos, priority verification | Lets high-volume pros pay a flat fee instead of a big %. Lowers the urge to take clients off the platform. |
| 3 | With orgs on board | **Organization plans** ($99–499/mo): team seats, staffing/urgent-need posts (after attorney review), applicant pipeline, bulk messaging | Orgs have budgets and expect SaaS pricing. |
| 4 | Later | Events & CE ticketing fee, sponsored listings, verification-as-a-service | Add-ons once traffic exists. |

## Options considered

**Take rate (commission).** Standard for marketplaces (Fiverr ~20%, Thumbtack
lead fees, Zocdoc per-booking). Keep it low (8–12%) while the market is thin.
Risk: pros take repeat clients off-platform. Counter with things that only
work on Sanus: payments, reminders, reviews, superbills, rebooking, HIPAA
messaging.

**Customer service fee.** A small (3–5%) fee on the customer side covers card
processing. Show it at checkout, not on the profile (fits the "no prices on
cards" rule).

**Professional subscription.** Predictable revenue, no leakage problem. Bad as
a requirement at launch (it was dropped once already). Good as an optional
upgrade later.

**Lead / inquiry fees** (pay per client inquiry, Thumbtack style). Pros hate
paying for leads that don't convert. Not recommended.

**Featured placement / ads.** Only worth it with real search traffic. Must be
labeled "Sponsored." Phase 4.

**Organization SaaS.** Strongest B2B line: staffing posts, credential checks
on hires, team scheduling. Wait for the attorney review of staffing posts.

**Verification as a service.** Sell credential/license checks to orgs hiring
outside Sanus. Uses Medallion/Checkr costs we already have. Margin is thin;
mostly a funnel.

**Events & CE.** Ticket fee (e.g. 5% + $1) on paid events and trainings.
Low effort since events already exist.

## Legal / compliance flags (talk to the healthcare attorney)

- **Fee-splitting and anti-kickback rules:** a percentage fee on licensed
  clinical services can be a problem in California (fee-splitting, Bus. &
  Prof. Code §650) and for anything billed to Medicare/Medicaid. A flat
  subscription or flat per-booking platform fee is usually safer for
  clinical professionals. Wellness/coaching/consulting is lower risk.
- **Corporate practice of medicine:** Sanus must not look like it controls
  clinical decisions or sets clinical prices.
- No pricing, payment, or marketing data may go to vendors without a BAA
  (no Google Analytics; PostHog with BAA only).

## Next decisions for the founder

1. Confirm phase 1: 10% from the pro/org, plus a customer fee (0%, 3%, or 5%)?
2. Ask the attorney whether licensed clinical bookings need a flat fee instead of a %.
3. Add Stripe keys to Vercel so payments and payouts actually run.
