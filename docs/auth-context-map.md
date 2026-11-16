# Auth and active-context map

Current state of authentication, role/context routing and intent
preservation, what this change fixed, and a proposal for multi-capability
identity (not built). Scope: eval P0.4 / Prompt 1.

## 1. Where identity and role live today

| Thing | Where | Notes |
| --- | --- | --- |
| Identity | `auth.users` (Supabase Auth). Email+password or Google OAuth (PKCE). | One user ID per sign-in. |
| Account type ("role") | `profiles.role` (`user_role` enum: `contractor`, `facility`, `staffing_agency`, `client`, `admin`). **One value per user.** | Set by the `handle_new_user` trigger from `raw_user_meta_data.role` (admin clamped to contractor). Google sign-ups have no role in metadata, so they start as `contractor`. |
| Professional profile | `contractor_profiles` (id = user id) | Draft until `onboarding_completed_at`. |
| Organization | `facility_profiles` (id = user id) | The organization *is* the user row: exactly one org per user, no members/invitations table. |
| Buyer profile | `client_profiles` (id = user id) | |
| Signup door | `profiles.signup_path` (`INDEPENDENT/PRACTICE/COMPANY/HIRING/CLIENT/UNSURE`) | Unset for Google sign-ups until an account step records it. |
| Consent | `auth.users.user_metadata.terms_*`, `org_terms_*` | |
| `user_metadata.role` | Client-writable (`auth.updateUser`). | Must never authorize anything. `src/app/(dashboard)/layout.tsx` uses it only as a display fallback when the profile row is unreadable. |

Server-side role checks: `src/proxy.ts` (route gates, usability only),
`src/lib/auth/roles.ts` (`currentUser`, `requireRole`), each page/action
re-checks `profiles.role`; RLS is the authorization boundary.

## 2. Auth surfaces

| Surface | File | Behaviour |
| --- | --- | --- |
| Proxy (Next 16 `proxy.ts`, ex-middleware) | `src/proxy.ts` | Session refresh, public-route list, signed-in `/login` `/signup*` `/login/continue` → `landingUrl`, MFA (AAL2) gate, role gates for `/contractor`, `/facility`, `/admin`, `/onboarding/*`, onboarding-required gate on `/dashboard` only. |
| Login page | `src/app/(auth)/login/page.tsx` | `?redirectTo=` (validated) → after password login, or via Google `/callback?intent=login&next=`. Default `/login/continue`. |
| Login API | `src/app/api/auth/login/route.ts` | Rate-limited password sign-in. |
| Post-login hop | `src/app/(auth)/login/continue/route.ts` | Answered by the proxy (`landingUrl`). |
| OAuth / email-link callback | `src/app/(auth)/callback/route.ts` | PKCE code exchange, `?next=`, undoes unclaimed Google accounts created from the sign-in page. |
| Signup flow (one page) | `src/app/(flow)/signup/*` | Doors: offer → independent/practice/company/unsure; looking → client/hiring. Old URLs (`/signup/offer`, `/signup/looking`, `/signup/organization?source=`, `/signup/facility`, `/signup/contractor`) redirect to `/signup?start=`. |
| Signup API | `src/app/api/auth/signup/route.ts` | Creates the account; email confirmation link → `/callback?next=<role landing>`. |
| Google account steps (convert brand-new `contractor` account) | `src/app/onboarding/{account,client/account,organization/account,unsure}` | Guarded by `canConvertNewProfessional` (`src/lib/onboarding/google-account.ts`). Org door + answers ride in non-httpOnly cookies `sanus_org_signup_source` / `sanus_org_signup_answers` (routing hints only, re-validated). |
| Onboarding wizards | `src/app/onboarding/professional`, `src/app/onboarding/organization` | |
| MFA | `src/app/(auth)/mfa/*` | `?redirectTo=` validated by `safeRedirect`. |

## 3. Bugs found and fixed in this change

### Org entry from a signed-in account bounced to the homepage

Root cause: `src/proxy.ts` (old line 161) sent *every* signed-in visitor of
`/signup*` to `landingUrl()`, which defaults to `/` (old line 115) for a
finished provider, any buyer, or an org — ignoring the door they picked
(`/signup?start=hiring`, `/signup/organization?source=HIRING`). Even had it
reached `/onboarding/organization`, the proxy role gate sends non-org roles
to `/dashboard`, and `/onboarding/organization/account` only accepts
convertible brand-new professionals.

Fix: signed-in `/signup*` with an organization door → new
`/onboarding/organization/start?source=…` (open to every signed-in role,
read-only):
- org roles → `/onboarding/organization` (forwards to dashboard once submitted);
- brand-new untouched professional (Google default) → `/onboarding/organization/account` (existing safe conversion);
- everyone else (buyer, provider with draft, finished provider) → an explicit
  screen showing their current context, stating nothing changed, a link back
  to the unchanged draft/profile, and an explicit opt-in "sign out and
  register a separate organization account". **Nothing is converted or
  written.** The "myself or my family" door for a signed-in user → `/find-care`.

### Unfinished org onboarding routed into professional consent

A Google organization signup whose account was never converted (e.g. left
after MFA, came back later) is still `contractor` with no `signup_path`; the
proxy and `/dashboard` sent it to `/onboarding/professional` (consent +
"which path did you mean" screens). `src/app/onboarding/professional/page.tsx`
now redirects a convertible account with the org-door cookie back to
`/onboarding/organization/account`.

### Intent lost through auth

- Proxy → `/login?redirectTo=` and → `/mfa/*?redirectTo=` dropped the query string; now kept.
- Signed-in `/login?redirectTo=X` ignored X; now honoured (after MFA).
- New short-lived httpOnly cookie `sanus_return_to` (30 min, SameSite=Lax,
  Secure on https, path only): set by the proxy when an anonymous visitor
  opens `/signup…?next=/path`. Read (and cleared) by `/callback` when its
  landing is a generic default (`/dashboard`, `/dashboard/matches` — never an
  onboarding/account step), by `landingUrl` (`/login/continue`), by the
  signup API for buyers signed in immediately, and by the client Google
  account step. Professionals/orgs still finish onboarding first; their
  cookie is used at the next `/login/continue`.
- Callers wanting a return can link `/signup/looking?next=/pros/<id>`
  (`signupStartUrl` keeps extra params). Discovery/profile CTAs are owned by
  another track and were not edited here.

### OAuth error / cancel / expiry

`/callback` previously sent errors (and a missing code) to a bare `/login`.
Now it maps `error`/`error_code` to `oauth_cancelled | oauth_failed |
link_expired` (raw provider text never echoed, auth codes never logged) and
redirects to `/login?error=…&redirectTo=<next>&from=signup`. The login page
shows a clear alert, keeps the destination, offers a fresh "Continue with
Google", and — for a failed sign-up — a "Restart sign-up" link to the right
door. The proxy also catches Supabase's Site-URL fallback (`/?error=…` →
`/login?error=…`; `/?code=…` → `/callback?code=…`) so a misconfigured
redirect allow-list doesn't strand people on the homepage.

### Pending provider and buyer browsing

Routing already allowed it: `/find-care`, `/pros`, `/orgs`,
`/events-and-training` are public and `/browse` is only MFA-gated; the
onboarding gate applies to `/dashboard` only. Added a "Browse professionals"
link in the `/onboarding/*` header so the draft can be left without
submitting. Buyer *actions* (messaging, booking) remain role-gated
(`CAN_MESSAGE` in `src/app/pros/[id]/actions.ts`) — that needs the capability
model below.

### Active context indicator

`src/app/(dashboard)/layout.tsx` shows "Acting as Offering expertise /
Buying for myself / Organization: <name> / Ocora admin", derived server-side
from `profiles.role` and `facility_profiles.facility_name`. No nav-config or
account-tabs edits.

### Session cookies on proxy redirects

Proxy redirects now copy refreshed Supabase session cookies from
`updateSession` (previously a token refresh during a redirect was dropped).

## 4. Open-redirect protections

`src/lib/auth/safe-next.ts` `safeNextPath()` is now used by the proxy,
`/callback`, login, MFA, the signup API and the client account step:
- string, 1–512 chars, starts with exactly one `/` (rejects `//`, `/\`),
  no `\` anywhere, no control characters (tab/newline tricks);
- parsed against a probe origin; origin must be unchanged and the
  *normalized* path must not start with `//` (blocks `/..//evil.com`);
- auth pages (`/login`, `/signup`, `/callback`, `/mfa`, `/forgot-password`,
  `/reset-password`) refused to prevent loops, except `/login/continue`;
- the proxy re-checks the resolved URL's origin before redirecting.
Only paths are carried; never credentials, tokens, PHI or form answers.

## 5. Proposal: one identity, several capabilities (NOT built)

Needs schema changes and owner decisions; do not implement without sign-off.

Additive, reversible migrations:
1. `organizations` (uuid id, name, type, signup_path, verification fields…)
   — backfill one row per existing `facility_profiles` row (`id` reused or
   mapped via `legacy_facility_profile_id`). Keep `facility_profiles` as the
   compatibility view/table during transition.
2. `organization_members` (org_id, user_id, role `owner|admin|member`,
   spending grant flags, invited_by, accepted_at, revoked_at). Backfill the
   owner from `facility_profiles.id`. RLS: members read their org; only
   owners/admins manage members.
3. `organization_invitations` (org_id, email hash, role, token hash, expiry).
4. Capabilities are derived, not stored as a single role: buyer = has
   `client_profiles` row; provider = has `contractor_profiles` row (with its
   own status); org = active membership. Keep `profiles.role` as the
   *primary/legacy* context until all gates migrate; `admin` stays separate.
5. Active context: server-side, per session, e.g. an httpOnly signed cookie
   `sanus_ctx = buyer | provider | org:<uuid>` validated on every request
   against the capability tables (membership must be active). Never trusted
   from a query string or `user_metadata`.
6. "Add capability" actions create the missing profile row (client or
   contractor draft) or membership without touching existing rows; switching
   context only changes the cookie.
7. Gates: replace `role === …` checks (proxy, `currentUser`, `CAN_MESSAGE`,
   RLS helpers) with capability + active-context checks; org-scoped queries
   filter by `org_id` from the validated context (tenant isolation tests).
8. Context switcher in the dashboard header replacing the static indicator.

Rollback: drop new tables/cookie; `profiles.role` and `facility_profiles`
remain authoritative throughout the transition.

## 6. Decisions needed

1. May an existing buyer/provider identity create or join an organization
   (vs. a separate org login)? Until decided, the explicit "separate account"
   option on `/onboarding/organization/start` is the interim path — remove it
   if owners don't want duplicate identities at all.
2. Org member roles, who can spend/book/contact, and invitation flow
   (email domain match? owner approval?).
3. Can a provider also be a buyer under the same identity, and may a pending
   provider message/book as a buyer (today only `client` and org roles can)?
4. Which context is default after login when a user holds several?
5. Is org verification per organization or per member action?
6. Should "Restart sign-up" after a failed Google sign-up preserve
   pre-account answers (currently only the org door/answers cookies survive)?
7. Supabase dashboard: confirm the Redirect URLs allow-list contains
   `<app>/callback**` in every environment (otherwise Supabase falls back to
   the Site URL; the proxy now recovers, but `next` is lost).

## 7. Not tested here

No test runner exists in the repo. Verified with `npx tsc --noEmit -p .` and
`npx eslint` on changed files, plus an ad-hoc check of `safeNextPath` /
`authErrorCode` cases. Manual checks still needed (non-production project):
Google cancel, expired confirmation link, signed-in buyer/provider choosing
"My organization", pending provider → find-care → back to unchanged draft.
