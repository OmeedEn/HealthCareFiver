import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Briefcase,
  ShieldCheck,
  FileText,
  CreditCard,
  Users,
  ClipboardList,
  AlertCircle,
  MessageSquare,
  DollarSign,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Search,
  CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import {
  isDemoMode,
  DEMO_CONTRACTOR,
  DEMO_FACILITY,
  DEMO_NOTIFICATIONS,
} from '@/lib/demo/data'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { CLIENT_INTEREST_LABELS } from '@/lib/onboarding/client-interests'
import { loadClientProfile } from '@/lib/onboarding/client-profile'
import { buildClientChecklist, CLIENT_GROUP_LABELS } from '@/lib/onboarding/checklist-client'
import type { ChecklistItem as FinishItem } from '@/lib/onboarding/checklist'
import { FinishProfileCard } from '@/components/onboarding/finish-profile-card'
import { CLIENT_MATCHES_PATH } from '@/lib/find-care/match-shared'
import { isClassificationRestricted } from '@/lib/onboarding/signup-path'
import { ORG_LIGHT_COLUMNS, orgLightSetupDone, verifiesLater } from '@/lib/onboarding/org-verify-later'
import { DemoRoleSwitcher } from '@/components/layout/demo-role-switcher'
import { OrgReviewBanner } from '@/components/org/org-review-banner'
import { OrgAgreementCard } from '@/components/org/org-agreement-card'
import { OrgFinishSection } from '@/components/org/org-finish-section'
import { SUPPORT_EMAIL } from '@/lib/env'
import { isNewAccount } from '@/lib/onboarding/contractor-checklist'
import { buildProfessionalChecklist, type CredentialLike } from '@/lib/onboarding/checklist-professional'
import { hasCurrentMalpractice, type CredentialRow } from '@/lib/compliance/rules'
import { effectiveBranch, isProfessionalCategory } from '@/lib/onboarding/professional-branch'
import { ProfileCard, type ProfileCardData } from './profile-card'

type DashboardNotification = {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

/** Real counts for the professional stat row. */
type ContractorStats = {
  listings: number
  published: number
  openInquiries: number
  credentials: number
}

/**
 * Organization dashboard counts. Organizations can both offer services/events
 * (requests they receive) and book professionals (bookings they buy), so the
 * two directions are counted separately.
 */
type OrgSummary = {
  listings: { total: number; published: number; inReview: number }
  /** Incoming requests/registrations still waiting on the organization. */
  requestsToAnswer: number
  /** Incoming requests/registrations booked and not yet closed. */
  requestsBooked: number
  /** Outgoing bookings the organization made that are still open. */
  bookingsOpen: number
}

/** First-run setup state for an organization. */
type FacilitySetup = {
  /**
   * Finished the onboarding their door asks for: submitted for review, or
   * (Hiring orgs, which verify later) type, name and city/state on file.
   */
  onboardingDone: boolean
}

export default async function DashboardPage() {
  let role: 'contractor' | 'facility' | 'admin' | 'client' = 'contractor'
  let firstName = 'there'
  let activity: DashboardNotification[] = []
  let specialties: string[] = []
  let contractorType: string | null = null
  let verificationStatus: string | null = null
  let verificationNotes: string | null = null
  let checklist: FinishItem[] | null = null
  let hasListings = true
  let compliance: ComplianceState | null = null
  let previewHref: string | null = null
  let contractorStats: ContractorStats | null = null
  let accountCreatedAt: string | null = null
  let profileCard: ProfileCardData | null = null

  // Client-specific data
  let clientInterests: string[] = []
  let clientLocation: string | null = null
  // Not sure signups awaiting staff placement (or rejected): no messaging.
  let clientClassification: 'pending' | 'rejected' | null = null
  // Finish your profile items (null for Not sure accounts under review).
  let clientChecklist: FinishItem[] | null = null

  // Organization-specific data
  let orgSummary: OrgSummary | null = null
  let facilitySetup: FacilitySetup | null = null
  let orgStatus: string | null = null
  let orgNotes: string | null = null
  let orgNeedsAgreement = false
  let orgUserId: string | null = null

  if (isDemoMode()) {
    // Read the demo role override cookie set by DemoRoleSwitcher.
    const cookieStore = await cookies()
    const cookieRole = cookieStore.get('demo_role')?.value
    if (
      cookieRole === 'facility' ||
      cookieRole === 'admin' ||
      cookieRole === 'contractor'
    ) {
      role = cookieRole
    }

    if (role === 'facility') {
      firstName = DEMO_FACILITY.facility_name
      // No mocked jobs, applicants or spend: the organization demo shows the
      // real empty-state next actions.
      activity = [...DEMO_NOTIFICATIONS]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          is_read: n.is_read,
          created_at: n.created_at,
        }))
    } else if (role === 'admin') {
      firstName = 'Admin'
    } else {
      // contractor (default)
      firstName = DEMO_CONTRACTOR.first_name
      // Mocked setup state: everything done except payouts, so the demo
      // shows the checklist mid-way ("4 of 5").
      checklist = buildProfessionalChecklist({
        branch: 'clinical',
        verificationStatus: 'approved',
        profile: { ...DEMO_CONTRACTOR, languages: ['English', 'Spanish'], contractor_agreement_accepted_at: '2026-01-01T00:00:00.000Z' },
        phone: null,
        avatarUrl: 'demo',
        stripeConnectOnboarded: !!DEMO_CONTRACTOR.stripe_connect_onboarded,
        credentials: [
          { credential_type: 'license', document_url: 'demo', status: 'verified' },
          { credential_type: 'government_id', document_url: 'demo', status: 'verified' },
        ],
        listings: { total: 3, published: 1, inReview: 0 },
        availabilitySlots: 3,
        answered: [],
      })
      previewHref = `/pros/${DEMO_CONTRACTOR.id}`
      profileCard = {
        firstName: DEMO_CONTRACTOR.first_name,
        lastName: DEMO_CONTRACTOR.last_name,
        avatarUrl: DEMO_CONTRACTOR.avatar_url,
        headline: DEMO_CONTRACTOR.headline,
        verified: true,
        publicHref: previewHref,
      }
    }

    // Contractor-only demo data — only compute if we're in contractor view.
    if (role === 'contractor') {
      activity = [...DEMO_NOTIFICATIONS]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          is_read: n.is_read,
          created_at: n.created_at,
        }))
      specialties = DEMO_CONTRACTOR.specialties ?? []
      contractorType = DEMO_CONTRACTOR.contractor_type ?? null
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      // my_profile(): own row incl. private columns (email, phone).
      .rpc('my_profile')
      .select('*')
      .maybeSingle<Record<string, string | boolean | null>>()

    accountCreatedAt =
      (profileData?.created_at as string | undefined) ?? user.created_at ?? null
    const rawRole = profileData?.role ?? user.user_metadata?.role ?? 'contractor'
    // Staffing agencies are organizations too (facility_profiles row, same
    // review, agreement, finish checklist and listings): same dashboard.
    role = (rawRole === 'staffing_agency' ? 'facility' : rawRole) as
      | 'contractor'
      | 'facility'
      | 'admin'
      | 'client'
    // Admins land in the admin console. Keyed off the profiles row only —
    // user_metadata is user-editable.
    if (profileData?.role === 'admin') redirect('/admin')

    firstName =
      profileData?.first_name ?? user.user_metadata?.first_name ?? 'there'

    if (role === 'client') {
      if (profileData && isClassificationRestricted(profileData)) {
        clientClassification =
          profileData.classification_status === 'rejected' ? 'rejected' : 'pending'
      }
      const clientRow = await loadClientProfile(supabase, user.id)
      if (clientRow?.first_name) firstName = clientRow.first_name
      clientInterests = clientRow?.interests ?? []
      clientLocation =
        [clientRow?.city, clientRow?.state]
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .join(', ') ||
        clientRow?.zip_code ||
        null
      // Not sure accounts keep the classification banner as their only
      // nudge; the client checklist and matches are for placed clients.
      if (clientRow && !clientClassification) {
        clientChecklist = buildClientChecklist({
          emailConfirmed: !!user.email_confirmed_at,
          zip_code: clientRow.zip_code,
          goals: clientRow.goals,
          language: clientRow.language,
          budget: clientRow.budget,
          note: clientRow.note,
          phone: (profileData?.phone as string | null | undefined) ?? null,
        })
      }
    }

    if (role === 'contractor') {
      const [
        { data: contractorRow },
        { count: credentialCount },
        { count: openInquiryCount },
        { data: agreementRow, error: agreementError },
      ] = await Promise.all([
        supabase
          .from('contractor_profiles')
          .select(
            'first_name, last_name, verification_status, verification_notes, professional_category, credential_basis, contractor_type, headline, bio, specialties, languages, years_of_experience, npi_number, license_issue_date, license_expiration_date, other_names, telehealth_states, website_url, offers_high_risk_services, insured_verified_at, city, state, state_license_number, license_state'
          )
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('credentials')
          .select('id', { count: 'exact', head: true })
          .eq('contractor_id', user.id),
        // Inquiries from organizations still waiting on a reply.
        supabase
          .from('org_inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('contractor_id', user.id)
          .eq('status', 'sent'),
        // Separate query so a missing column (migration not yet applied)
        // can't break the main contractor_profiles select above.
        supabase
          .from('contractor_profiles')
          .select('contractor_agreement_accepted_at')
          .eq('id', user.id)
          .maybeSingle(),
      ])
      if (firstName === 'there' && contractorRow?.first_name) {
        firstName = contractorRow.first_name as string
      }
      verificationStatus = contractorRow?.verification_status ?? null
      verificationNotes = contractorRow?.verification_notes ?? null
      specialties = Array.isArray(contractorRow?.specialties)
        ? (contractorRow.specialties as string[])
        : []
      contractorType =
        (contractorRow?.contractor_type as string | null | undefined) ?? null

      // Provider-area extras (v3). Each query degrades to "unknown" on error
      // (e.g. columns not migrated yet) instead of breaking the dashboard.
      const [
        { count: availabilityCount, error: availabilityError },
        { data: listingRows, error: listingsError },
        { data: complianceRow, error: complianceError },
        { count: malpracticeInReview },
      ] = await Promise.all([
        supabase
          .from('contractor_availability')
          .select('id', { count: 'exact', head: true })
          .eq('contractor_id', user.id)
          .eq('is_blocked', false),
        // requires_malpractice is v3; fall back to status only.
        supabase
          .from('professional_offerings')
          .select('status, requires_malpractice')
          .eq('contractor_id', user.id)
          .then(async (res) =>
            res.error
              ? await supabase.from('professional_offerings').select('status').eq('contractor_id', user.id)
              : res
          ),
        supabase
          .from('contractor_profiles')
          .select('insurance_due_at, compliance_hold_reason')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('credentials')
          .select('id', { count: 'exact', head: true })
          .eq('contractor_id', user.id)
          .eq('credential_type', 'malpractice_insurance')
          .eq('status', 'pending_review'),
      ])
      const listingList = listingsError
        ? null
        : ((listingRows ?? []) as { status: string; requires_malpractice?: boolean | null }[])
      const listingStatuses = listingList ? listingList.map((r) => r.status) : null
      contractorStats = {
        listings: listingStatuses?.length ?? 0,
        published: listingStatuses?.filter((x) => x === 'published').length ?? 0,
        openInquiries: openInquiryCount ?? 0,
        credentials: credentialCount ?? 0,
      }
      compliance = {
        insuranceDueAt: complianceError
          ? null
          : ((complianceRow?.insurance_due_at as string | null) ?? null),
        holdReason: complianceError
          ? null
          : ((complianceRow?.compliance_hold_reason as string | null) ?? null),
        certificateInReview: (malpracticeInReview ?? 0) > 0,
      }
      previewHref = `/pros/${user.id}`
      {
        const avatarUrl = (profileData?.avatar_url as string | null) ?? null
        const row = contractorRow as Record<string, unknown> | null
        profileCard = {
          firstName: (row?.first_name as string | null) ?? (firstName === 'there' ? '' : firstName),
          lastName: (row?.last_name as string | null) ?? '',
          avatarUrl,
          headline: (row?.headline as string | null) ?? null,
          verified: verificationStatus === 'approved' || verificationStatus === 'insurance_pending',
          publicHref: previewHref,
        }
      }

      // Finish your profile (Single-Question Onboarding): uploads and
      // which onboarding screens were answered.
      const [{ data: credentialRows }, { data: progressRow }] = await Promise.all([
        supabase
          .from('credentials')
          .select('credential_type, document_url, status, expiration_date')
          .eq('contractor_id', user.id),
        supabase
          .from('onboarding_progress')
          .select('answered')
          .eq('user_id', user.id)
          .eq('flow', 'professional')
          .maybeSingle(),
      ])
      const category = contractorRow?.professional_category
      const creds = (credentialRows ?? []) as (CredentialLike & { expiration_date: string | null })[]
      // SQL is_insured(): badge set AND a current verified certificate.
      const insured =
        !!contractorRow?.insured_verified_at &&
        hasCurrentMalpractice(creds as unknown as CredentialRow[], new Date())
      hasListings = listingStatuses ? listingStatuses.length > 0 : true
      checklist = buildProfessionalChecklist({
        branch: isProfessionalCategory(category)
          ? effectiveBranch(category, contractorRow?.credential_basis as string | null)
          : null,
        verificationStatus,
        profile: {
          ...(contractorRow ?? {}),
          contractor_agreement_accepted_at: agreementError
            ? null
            : ((agreementRow?.contractor_agreement_accepted_at as string | null | undefined) ?? null),
        },
        phone: (profileData?.phone as string | null) ?? null,
        avatarUrl: (profileData?.avatar_url as string | null) ?? null,
        stripeConnectOnboarded: !!profileData?.stripe_connect_onboarded,
        credentials: creds,
        listings: listingList && listingStatuses
          ? {
              total: listingStatuses.length,
              published: listingStatuses.filter((x) => x === 'published').length,
              inReview: listingStatuses.filter((x) => x === 'pending_review').length,
              awaitingInsurance: insured
                ? 0
                : listingList.filter((l) => l.status === 'published' && l.requires_malpractice === true).length,
            }
          : undefined,
        availabilitySlots: availabilityError ? undefined : (availabilityCount ?? 0),
        answered: Array.isArray(progressRow?.answered) ? (progressRow.answered as string[]) : [],
      })

      const { data: notifData } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      activity = (notifData ?? []) as DashboardNotification[]
    }

    if (role === 'facility') {
      orgUserId = user.id
      const [
        { data: facilityRow },
        { data: notifData },
        { data: listingRows },
        { data: incomingRows },
        { data: outgoingRows },
      ] = await Promise.all([
        // Own row via RPC: phone and review notes aren't readable directly.
        supabase
          .rpc('my_facility_profile')
          .select(`verification_status, verification_notes, org_agreement_accepted_at, onboarding_submitted_at, ${ORG_LIGHT_COLUMNS}`)
          .maybeSingle(),
        supabase
          .from('notifications')
          .select('id, type, title, body, is_read, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('org_listings').select('status').eq('facility_id', user.id),
        // Requests and registrations for this organization's own listings.
        supabase
          .from('org_bookings')
          .select('status')
          .eq('org_id', user.id)
          .in('status', ['requested', 'quoted', 'accepted', 'paid']),
        // Bookings this organization made as a buyer.
        supabase
          .from('org_bookings')
          .select('status')
          .eq('customer_id', user.id)
          .in('status', ['requested', 'quoted', 'accepted', 'paid']),
      ])

      activity = (notifData ?? []) as DashboardNotification[]
      const listingStatuses = ((listingRows ?? []) as { status: string }[]).map((r) => r.status)
      const incoming = ((incomingRows ?? []) as { status: string }[]).map((r) => r.status)
      orgSummary = {
        listings: {
          total: listingStatuses.length,
          published: listingStatuses.filter((x) => x === 'published').length,
          inReview: listingStatuses.filter((x) => x === 'in_review').length,
        },
        requestsToAnswer: incoming.filter((x) => x === 'requested').length,
        requestsBooked: incoming.filter((x) => x === 'accepted' || x === 'paid').length,
        bookingsOpen: (outgoingRows ?? []).length,
      }
      const orgSubmitted = !!facilityRow?.onboarding_submitted_at
      // Not submitted yet (a Hiring org verifying later): nothing is under
      // review, so no review banner.
      orgStatus = orgSubmitted ? ((facilityRow?.verification_status as string | null) ?? null) : null
      orgNotes = (facilityRow?.verification_notes as string | null) ?? null
      orgNeedsAgreement = orgStatus === 'approved' && !facilityRow?.org_agreement_accepted_at
      facilitySetup = {
        onboardingDone:
          orgSubmitted ||
          (verifiesLater(profileData?.signup_path as string | null | undefined) &&
            !!facilityRow &&
            orgLightSetupDone(facilityRow as Record<string, unknown>)),
      }
    }
  }

  const setupComplete =
    role === 'contractor'
      ? (checklist ?? []).every((i) => i.done)
      : role === 'facility' && facilitySetup
        ? facilitySetup.onboardingDone
        : true
  const greeting = isNewAccount({ createdAt: accountCreatedAt, setupComplete })
    ? 'Welcome'
    : 'Welcome back'

  return (
    <div className="space-y-6">
      {isDemoMode() && role !== 'client' && (
        <DemoRoleSwitcher current={role} />
      )}
      {role !== 'client' && (
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">
            {greeting}, {firstName}!
          </h1>
          <p className="text-[#5f5d57]">
            Here&apos;s an overview of your {role === 'facility' ? 'organization' : role === 'admin' ? 'admin' : 'professional'} dashboard.
          </p>
        </div>
      )}

      {role === 'contractor' && (
        <ContractorDashboard
          checklist={checklist}
          hasListings={hasListings}
          stats={contractorStats}
          isDemo={isDemoMode()}
          activity={activity}
          specialties={specialties}
          contractorType={contractorType}
          verificationStatus={verificationStatus}
          verificationNotes={verificationNotes}
          compliance={compliance}
          profileCard={profileCard}
        />
      )}
      {role === 'facility' && <OrgReviewBanner status={orgStatus} notes={orgNotes} />}
      {role === 'facility' && orgUserId && <OrgFinishSection userId={orgUserId} />}
      {role === 'facility' && orgNeedsAgreement && (
        <div id="org-agreement" className="scroll-mt-20">
          <OrgAgreementCard />
        </div>
      )}
      {role === 'facility' && (
        <OrganizationDashboard summary={orgSummary} activity={activity} />
      )}
      {role === 'admin' && <AdminDashboard />}
      {role === 'client' && (
        <ClientDashboard
          firstName={firstName}
          interests={clientInterests}
          location={clientLocation}
          classification={clientClassification}
          checklist={clientChecklist}
        />
      )}
    </div>
  )
}

const VERIFICATION_BANNER: Record<
  string,
  {
    title: string
    body?: string
    cta?: { label: string; href: string }
    className: string
    iconClassName: string
  }
> = {
  not_submitted: {
    title: 'Get verified to go live',
    body: 'Upload your license or certification and a government ID. Our team will review them and email you.',
    cta: { label: 'Upload documents', href: '/contractor/credentials/upload' },
    className: 'border-[#c9cdfb] bg-[#eceefe]',
    iconClassName: 'text-[#2330c8]',
  },
  pending_review: {
    title: "Your application is under review. We'll email you when the review is complete.",
    className: 'border-[#ecd3a3] bg-[#fbf0dc]',
    iconClassName: 'text-[#8a5a00]',
  },
  more_info_requested: {
    title: 'Action needed: more information requested',
    cta: { label: 'Upload Requested Document', href: '/contractor/credentials/upload' },
    className: 'border-[#f4c7c2] bg-[#fdecea]',
    iconClassName: 'text-[#b42318]',
  },
  rejected: {
    title: 'Your verification was not approved',
    className: 'border-[#f4c7c2] bg-[#fdecea]',
    iconClassName: 'text-[#b42318]',
  },
  suspended: {
    title: 'Your account is suspended',
    body: `Your profile and listings are hidden from clients and you can't take bookings. Email ${SUPPORT_EMAIL} to resolve this.`,
    className: 'border-[#f4c7c2] bg-[#fdecea]',
    iconClassName: 'text-[#b42318]',
  },
}

/** Statuses whose banner shows the admin's verification_notes. */
const BANNER_SHOWS_NOTES = new Set(['more_info_requested', 'rejected', 'suspended'])

function VerificationBanner({
  status,
  notes,
}: {
  status: string | null
  notes: string | null
}) {
  if (!status || status === 'approved') return null

  const config = VERIFICATION_BANNER[status]
  if (!config) return null
  const shownNotes = BANNER_SHOWS_NOTES.has(status) ? notes : null

  return (
    <Card className={`rounded-md ${config.className}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${config.iconClassName}`}>
          <AlertCircle className="h-5 w-5" />
          {config.title}
        </CardTitle>
        {shownNotes && (
          <CardDescription className="font-medium text-[#1a1a17]">
            {shownNotes}
          </CardDescription>
        )}
        {config.body && (!shownNotes || status === 'suspended') && (
          <CardDescription>{config.body}</CardDescription>
        )}
      </CardHeader>
      {config.cta && (
        <CardContent>
          <Link
            href={config.cta.href}
            className="text-sm font-black text-[#2f3cf5] hover:underline"
          >
            {config.cta.label} &rarr;
          </Link>
        </CardContent>
      )}
    </Card>
  )
}

type ComplianceState = {
  /** contractor_profiles.insurance_due_at (malpractice grace deadline) */
  insuranceDueAt: string | null
  /** contractor_profiles.compliance_hold_reason */
  holdReason: string | null
  /** A malpractice certificate is uploaded and waiting for admin review. */
  certificateInReview: boolean
}

const MALPRACTICE_UPLOAD_HREF =
  '/contractor/credentials/upload?type=malpractice_insurance'

function daysUntil(iso: string, now = Date.now()): number | null {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - now) / (24 * 60 * 60 * 1000))
}

/**
 * Malpractice grace period (status 'insurance_pending') and compliance holds.
 * Shown on every dashboard visit until resolved.
 */
function ComplianceBanner({
  status,
  compliance,
}: {
  status: string | null
  compliance: ComplianceState | null
}) {
  if (!compliance) return null

  if (compliance.holdReason && status !== 'suspended') {
    return (
      <Card className="rounded-md border-[#f4c7c2] bg-[#fdecea]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#b42318]">
            <AlertCircle className="h-5 w-5" />
            Your profile is on hold
          </CardTitle>
          <CardDescription className="font-medium text-[#1a1a17]">
            {compliance.holdReason}
          </CardDescription>
          <CardDescription>
            Clients can&apos;t see your profile or book your listings until
            this is resolved. Update the document below, or email{' '}
            {SUPPORT_EMAIL} if you have questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/contractor/credentials"
            className="text-sm font-black text-[#2f3cf5] hover:underline"
          >
            Update documents &rarr;
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (status !== 'insurance_pending') return null

  const days = compliance.insuranceDueAt
    ? daysUntil(compliance.insuranceDueAt)
    : null
  const overdue = days != null && days <= 0

  let title: string
  let body: string
  if (compliance.certificateInReview) {
    title = 'We’re reviewing your malpractice certificate'
    body = overdue
      ? 'Listings for in-person care, home visits, prescribing, injectables, or IVs stay paused until we finish the review.'
      : 'Listings for in-person care, home visits, prescribing, injectables, or IVs go live once it’s approved.'
  } else if (overdue) {
    title = 'Upload your malpractice certificate — your deadline has passed.'
    body =
      'Listings for in-person care, home visits, prescribing, injectables, or IVs are paused and hidden from clients until your certificate is uploaded and reviewed. Your other listings stay live.'
  } else {
    title =
      days != null
        ? `Upload your malpractice certificate — ${days} day${days === 1 ? '' : 's'} left.`
        : 'Upload your malpractice certificate.'
    body =
      'Listings for in-person care, home visits, prescribing, injectables, or IVs stay unpublished until it’s reviewed.'
  }
  const urgent = overdue && !compliance.certificateInReview

  return (
    <Card
      className={`rounded-md ${
        urgent ? 'border-[#f4c7c2] bg-[#fdecea]' : 'border-[#ecd3a3] bg-[#fbf0dc]'
      }`}
    >
      <CardHeader>
        <CardTitle
          className={`flex items-center gap-2 ${urgent ? 'text-[#b42318]' : 'text-[#8a5a00]'}`}
        >
          <ShieldCheck className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {!compliance.certificateInReview && (
        <CardContent>
          <Link
            href={MALPRACTICE_UPLOAD_HREF}
            className="text-sm font-black text-[#2f3cf5] hover:underline"
          >
            Upload malpractice certificate &rarr;
          </Link>
        </CardContent>
      )}
    </Card>
  )
}

function ContractorDashboard({
  checklist,
  hasListings,
  stats,
  isDemo,
  activity,
  specialties,
  contractorType,
  verificationStatus,
  verificationNotes,
  compliance,
  profileCard,
}: {
  checklist: FinishItem[] | null
  /** Has any listing yet; false shows the first-run cards. */
  hasListings: boolean
  stats: ContractorStats | null
  isDemo: boolean
  activity: DashboardNotification[]
  specialties: string[]
  contractorType: string | null
  verificationStatus: string | null
  verificationNotes: string | null
  compliance: ComplianceState | null
  profileCard: ProfileCardData | null
}) {
  const contractorTypeLabel = contractorType
    ? CONTRACTOR_TYPE_LABELS[contractorType] ?? contractorType.toUpperCase()
    : null

  // Real users only see real counts; a brand-new account with nothing yet
  // gets no stat row at all rather than a wall of zeros.
  const showRealStats =
    !isDemo &&
    stats != null &&
    stats.listings + stats.openInquiries + stats.credentials > 0

  return (
    <div className="space-y-6">
      {profileCard && <ProfileCard data={profileCard} items={checklist} />}
      <VerificationBanner
        status={verificationStatus}
        notes={
          verificationStatus === 'suspended'
            ? (compliance?.holdReason ?? verificationNotes)
            : verificationNotes
        }
      />
      <ComplianceBanner status={verificationStatus} compliance={compliance} />
      {checklist && <FinishProfileCard items={checklist} />}
      {!hasListings && <FirstRunOfferCards />}

      {showRealStats && stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Listings"
            value={String(stats.listings)}
            description={`${stats.published} published`}
            icon={Briefcase}
          />
          <StatCard
            title="Open inquiries"
            value={String(stats.openInquiries)}
            description="Waiting on your reply"
            icon={MessageSquare}
          />
          <StatCard
            title="Credentials"
            value={String(stats.credentials)}
            description="Uploaded documents"
            icon={ShieldCheck}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfessionalNextSteps hasListings={hasListings} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1a1a17]">Recent activity</CardTitle>
              <CardAction>
                <Link
                  href="/notifications"
                  className="text-sm font-medium text-[#2f3cf5] hover:underline"
                >
                  View all &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-[#5f5d57]">
                  No recent activity yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((item) => {
                    const Icon = getNotificationIcon(item.type)
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceefe]">
                          <Icon className="size-4 text-[#2f3cf5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#1a1a17]">
                            {item.title}
                          </p>
                          <p className="line-clamp-1 text-sm text-[#5f5d57]">
                            {item.body}
                          </p>
                          <p className="text-xs text-[#5f5d57]">
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#1a1a17]">Your interests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contractorTypeLabel && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[#5f5d57]">
                    Professional role
                  </p>
                  <Badge className="bg-[#eceefe] px-3 py-1 text-sm text-[#2330c8]">
                    {contractorTypeLabel}
                  </Badge>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-[#5f5d57]">
                  Specialties
                </p>
                {specialties.length === 0 ? (
                  <Link
                    href="/contractor/profile/edit"
                    className="text-sm font-medium text-[#2f3cf5] hover:underline"
                  >
                    Add specialties &rarr;
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <Badge key={s} variant="outline" className="text-[#1a1a17]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** First-run cards (Single-Question Onboarding): what used to be the "What will you offer?" signup step. */
const FIRST_RUN_OFFERS = [
  { label: 'Add a service', sub: 'Bookable sessions or visits', href: '/contractor/listings/new?kind=service', icon: Briefcase },
  { label: 'Add consulting', sub: 'Advisory work and projects', href: '/contractor/listings/new?kind=consulting', icon: TrendingUp },
  { label: 'Add an event', sub: 'Workshops, classes, CEU courses', href: '/contractor/listings/new?kind=event', icon: CalendarDays },
] as const

function FirstRunOfferCards() {
  return (
    <section aria-labelledby="first-run-offers" className="space-y-3">
      <h2 id="first-run-offers" className="text-base font-semibold text-[#1a1a17]">
        What will you offer?
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {FIRST_RUN_OFFERS.map((o) => {
          const Icon = o.icon
          return (
            <Link
              key={o.label}
              href={o.href}
              className="flex items-start gap-3 rounded-xl border border-[#e3dfd6] bg-white p-4 transition hover:border-[#c9cdfb] hover:bg-[#f4f5fe] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3cf5]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceefe] text-[#2f3cf5]">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#1a1a17]">{o.label}</span>
                <span className="block text-xs text-[#5f5d57]">{o.sub}</span>
              </span>
            </Link>
          )
        })}
      </div>
      <p className="text-xs text-[#5f5d57]">Saved as drafts. Nothing publishes until you’re approved.</p>
    </section>
  )
}

/**
 * Next actions for any professional (clinician, trainer, coach, consultant,
 * educator): the same marketplace steps, never occupation-specific job or
 * credential recommendations.
 */
const PROFESSIONAL_NEXT_STEPS = [
  {
    label: 'Create a service',
    sub: 'Sessions, visits, packages, or consulting',
    href: '/contractor/listings/new?kind=service',
    icon: Briefcase,
  },
  {
    label: 'Host an event or class',
    sub: 'Workshops, webinars, or courses',
    href: '/contractor/listings/new?kind=event',
    icon: CalendarDays,
  },
  {
    label: 'Set your availability',
    sub: 'When clients can book you',
    href: '/contractor/availability',
    icon: CalendarDays,
  },
  {
    label: 'Set your rates',
    sub: 'What you charge and per what',
    href: '/contractor/rates',
    icon: DollarSign,
  },
  {
    label: 'Complete review items',
    sub: 'Documents our team needs to review your profile',
    href: '/contractor/credentials',
    icon: ShieldCheck,
  },
  {
    label: 'Answer inquiries',
    sub: 'Requests from clients and organizations',
    href: '/contractor/inquiries',
    icon: MessageSquare,
  },
] as const

function ProfessionalNextSteps({ hasListings }: { hasListings: boolean }) {
  // Without listings, the first-run cards above already cover creating one.
  const steps = hasListings
    ? PROFESSIONAL_NEXT_STEPS
    : PROFESSIONAL_NEXT_STEPS.filter((s) => !s.href.startsWith('/contractor/listings/new'))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#1a1a17]">Next steps</CardTitle>
        <CardAction>
          <Link
            href="/contractor/listings"
            className="text-sm font-medium text-[#2f3cf5] hover:underline"
          >
            Your listings &rarr;
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="flex items-start gap-3 rounded-md border border-[#e3dfd6] px-3 py-2.5 hover:border-[#c9cdfb] hover:bg-[#f4f5fe]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceefe]">
                    <Icon className="size-4 text-[#2f3cf5]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#1a1a17]">{step.label}</span>
                    <span className="block text-xs text-[#5f5d57]">{step.sub}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_message':
      return MessageSquare
    case 'job_match':
      return Briefcase
    case 'timesheet_approved':
    case 'timesheet_submitted':
      return FileText
    case 'payment_received':
    case 'payment_released':
      return DollarSign
    case 'credential_expiring':
    case 'credential_rejected':
      return AlertCircle
    default:
      return AlertCircle
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return 'Just now'
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute)
    return `${m} min${m === 1 ? '' : 's'} ago`
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  if (diffMs < 7 * day) {
    const d = Math.floor(diffMs / day)
    return `${d} day${d === 1 ? '' : 's'} ago`
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Organization dashboard: leads with offering services/events and finding
 * professionals, then keeps incoming requests ("Requests we receive") and
 * outgoing purchases ("Bookings we buy") apart. Staffing posts, applicants
 * and contracts are a separate, flag-gated product and don't appear here.
 */
function OrganizationDashboard({
  summary,
  activity,
}: {
  summary: OrgSummary | null
  activity: DashboardNotification[]
}) {
  const listings = summary?.listings
  const incomingTotal = summary ? summary.requestsToAnswer + summary.requestsBooked : 0
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
              <CalendarDays className="size-4 text-[#2f3cf5]" />
              Offer services &amp; events
            </CardTitle>
            <CardDescription>
              {listings && listings.total > 0
                ? `${listings.total} listing${listings.total === 1 ? '' : 's'} · ${listings.published} published${
                    listings.inReview > 0 ? ` · ${listings.inReview} in review` : ''
                  }`
                : 'List consulting, programs, classes, or events for clients and other organizations.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/facility/listings?new=service" className="text-[#2f3cf5] hover:underline">
              Add a service &rarr;
            </Link>
            <Link href="/facility/listings?new=event" className="text-[#2f3cf5] hover:underline">
              Add an event &rarr;
            </Link>
            <Link href="/facility/listings" className="text-[#2f3cf5] hover:underline">
              Manage services &amp; events &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
              <Search className="size-4 text-[#2f3cf5]" />
              Find professionals
            </CardTitle>
            <CardDescription>
              Browse clinicians, coaches, consultants, and educators to book for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/facility/contractors" className="text-[#2f3cf5] hover:underline">
              Find professionals &rarr;
            </Link>
            <Link href="/facility/profile#looking-for" className="text-[#2f3cf5] hover:underline">
              Describe what you&apos;re looking for &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
                <ClipboardList className="size-4 text-[#2f3cf5]" />
                Requests we receive
              </CardTitle>
              <CardDescription>
                Booking requests and registrations for your services and events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#1a1a17]">
                {summary && incomingTotal > 0
                  ? `${summary.requestsToAnswer} need${summary.requestsToAnswer === 1 ? 's' : ''} your response · ${summary.requestsBooked} booked`
                  : 'None yet.'}
              </p>
              <Link href="/facility/bookings" className="text-sm font-semibold text-[#2f3cf5] hover:underline">
                Open requests &rarr;
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
                <CheckCircle2 className="size-4 text-[#2f3cf5]" />
                Bookings we buy
              </CardTitle>
              <CardDescription>
                Services and events your organization has requested or booked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#1a1a17]">
                {summary && summary.bookingsOpen > 0 ? `${summary.bookingsOpen} open` : 'None yet.'}
              </p>
              <Link href="/bookings" className="text-sm font-semibold text-[#2f3cf5] hover:underline">
                Open bookings &rarr;
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#1a1a17]">Recent activity</CardTitle>
            <CardAction>
              <Link
                href="/notifications"
                className="text-sm font-medium text-[#2f3cf5] hover:underline"
              >
                View all &rarr;
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-[#5f5d57]">No recent activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => {
                  const Icon = getNotificationIcon(item.type)
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceefe]">
                        <Icon className="size-4 text-[#2f3cf5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1a1a17]">{item.title}</p>
                        <p className="line-clamp-1 text-sm text-[#5f5d57]">{item.body}</p>
                        <p className="text-xs text-[#5f5d57]">{formatRelativeTime(item.created_at)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClassificationBanner({
  status,
  firstName,
}: {
  status: 'pending' | 'rejected'
  firstName: string
}) {
  if (status === 'rejected') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-md border border-[#e3dfd6] bg-white p-4"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#5f5d57]" />
        <div className="text-sm text-[#1a1a17]">
          <p className="font-semibold">Our team reviewed your answers</p>
          <p className="mt-1 text-[#5f5d57]">
            You can keep using Sanus as a client to browse, save, and book.
            Questions? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-[#2f3cf5] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    )
  }
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-[#c9cdfb] bg-[#eceefe] p-4"
    >
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2330c8]" />
      <div className="text-sm text-[#1a1a17]">
        <p className="font-semibold">
          Thanks, {firstName}. We&apos;re reviewing your answers and will place
          you in the right category, and we&apos;ll email you when that&apos;s
          done. We may ask for a few more details.
        </p>
        <p className="mt-1">
          Until then you can browse, save, and book as a client. Messaging
          professionals unlocks once you&apos;re placed.
        </p>
      </div>
    </div>
  )
}

function ClientDashboard({
  firstName,
  interests,
  location,
  classification,
  checklist,
}: {
  firstName: string
  interests: string[]
  location: string | null
  classification: 'pending' | 'rejected' | null
  checklist: FinishItem[] | null
}) {
  return (
    <div className="space-y-6">
      {classification && (
        <ClassificationBanner status={classification} firstName={firstName} />
      )}
      {checklist && (
        <FinishProfileCard items={checklist} groupLabels={CLIENT_GROUP_LABELS} />
      )}
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a17]">
          Welcome, {firstName}!
        </h1>
        <p className="text-[#5f5d57]">
          {classification
            ? 'Find health professionals on Sanus.'
            : 'Find and connect with health professionals on Sanus.'}
        </p>
      </div>

      <Card className="rounded-md border-[#c9cdfb] bg-[#eceefe]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2330c8]">
            <Search className="h-5 w-5" />
            Find a professional
          </CardTitle>
          <CardDescription className="font-semibold text-[#2330c8]">
            Browse clinicians, coaches, consultants, and educators
            {location ? ` near ${location}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {!classification && (
            <Link
              href={CLIENT_MATCHES_PATH}
              className="inline-flex h-10 items-center rounded-md bg-[#2f3cf5] px-4 text-sm font-semibold text-white hover:bg-[#2330c8]"
            >
              See your matches &rarr;
            </Link>
          )}
          <Link
            href="/find-care"
            className={
              classification
                ? 'inline-flex h-10 items-center rounded-md bg-[#2f3cf5] px-4 text-sm font-semibold text-white hover:bg-[#2330c8]'
                : 'inline-flex h-10 items-center rounded-md border border-[#2f3cf5] bg-white px-4 text-sm font-semibold text-[#2330c8] hover:bg-[#f4f5fe]'
            }
          >
            Browse professionals &rarr;
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
                <CalendarDays className="size-4 text-[#2f3cf5]" />
                Your bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5f5d57]">
                Services you request and events you register for show up in
                My bookings.
              </p>
              <Link href="/bookings" className="mt-3 inline-block text-sm font-semibold text-[#2f3cf5] hover:underline">
                Go to My bookings
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
                <MessageSquare className="size-4 text-[#2f3cf5]" />
                Messages
              </CardTitle>
              <CardAction>
                <Link
                  href="/messages"
                  className="text-sm font-medium text-[#2f3cf5] hover:underline"
                >
                  Open inbox &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5f5d57]">
                {classification === 'pending'
                  ? 'Messaging professionals isn’t available while your account is under review.'
                  : classification === 'rejected'
                    ? 'Messaging professionals isn’t available on your account.'
                    : 'No conversations yet. Reach out to a professional from their profile to start one.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1a1a17]">Your interests</CardTitle>
              <CardAction>
                <Link
                  href="/settings#preferences"
                  className="text-sm font-medium text-[#2f3cf5] hover:underline"
                >
                  Edit &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {interests.length === 0 ? (
                <p className="text-sm text-[#5f5d57]">
                  You haven&apos;t saved any interests yet.{' '}
                  <Link
                    href="/settings#preferences"
                    className="font-medium text-[#2f3cf5] hover:underline"
                  >
                    Add some
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interests.map((key) => (
                    <Badge
                      key={key}
                      className="bg-[#eceefe] px-3 py-1 text-sm text-[#2330c8]"
                    >
                      {CLIENT_INTEREST_LABELS[key] ?? key}
                    </Badge>
                  ))}
                </div>
              )}
              {location && (
                <p className="mt-4 flex items-center gap-1 text-xs text-[#5f5d57]">
                  <MapPin className="size-3" />
                  {location}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Users"
        value="--"
        description="Registered users"
        icon={Users}
      />
      <StatCard
        title="Live listings"
        value="--"
        description="Published services and events"
        icon={Briefcase}
      />
      <StatCard
        title="Pending Credentials"
        value="--"
        description="Awaiting review"
        icon={ShieldCheck}
      />
      <StatCard
        title="Revenue"
        value="--"
        description="This month"
        icon={CreditCard}
      />
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#5f5d57]">
          {title}
        </CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#2f3cf5]/10 to-[#2f3cf5]/20">
          <Icon className="size-4 text-[#2f3cf5]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#1a1a17]">{value}</div>
        <p className="mt-1 text-xs text-[#5f5d57]">{description}</p>
      </CardContent>
    </Card>
  )
}
