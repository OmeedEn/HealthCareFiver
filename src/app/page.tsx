import Link from 'next/link'
import { NavAuth } from '@/components/marketing/nav-auth'
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileCheck,
  GraduationCap,
  Heart,
  Lock,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  UserCheck,
  Wallet,
  Wrench,
} from 'lucide-react'

/* ───────────────────────────── Data ───────────────────────────── */

const popularSearches = [
  'Physician Consulting',
  'Nurse Practitioner',
  'Health Coaching',
  'Nutrition',
  'Personal Training',
  'Healthcare Legal',
  'CEU Courses',
  'HIPAA Consulting',
  'Medical Billing',
  'Telehealth',
]

const stats = [
  { value: 'Reviewed', label: 'Professionals approved before they can be booked' },
  { value: 'All in one', label: 'Clinical, coaching, consulting & education' },
  { value: 'Stripe', label: 'Secure payments, no card data stored by Sanus' },
]

// Illustrative kinds of expertise — NOT real people, ratings, or prices.
const featuredExpertise = [
  { credential: 'MD', specialty: 'Physician consulting', icon: Stethoscope, color: 'bg-rose-100 text-rose-700' },
  { credential: 'RN', specialty: 'Nursing consulting', icon: UserCheck, color: 'bg-emerald-100 text-emerald-700' },
  { credential: 'NBC-HWC', specialty: 'Health & wellness coaching', icon: Sparkles, color: 'bg-amber-100 text-amber-700' },
  { credential: 'JD', specialty: 'Healthcare legal', icon: Scale, color: 'bg-slate-100 text-slate-700' },
  { credential: 'CPT', specialty: 'Personal & corporate training', icon: Users, color: 'bg-blue-100 text-blue-700' },
  { credential: 'RDN', specialty: 'Nutrition & dietetics', icon: Heart, color: 'bg-teal-100 text-teal-700' },
  { credential: 'CHC', specialty: 'HIPAA & compliance', icon: Shield, color: 'bg-indigo-100 text-indigo-700' },
  { credential: 'CPC', specialty: 'Medical billing & coding', icon: ClipboardCheck, color: 'bg-purple-100 text-purple-700' },
  { credential: 'CEU', specialty: 'Continuing education', icon: GraduationCap, color: 'bg-fuchsia-100 text-fuchsia-700' },
  { credential: 'NP', specialty: 'Telehealth & second opinions', icon: Brain, color: 'bg-cyan-100 text-cyan-700' },
]

const tierGroups = [
  {
    title: 'Licensed clinical professionals',
    description:
      'MDs, NPs, PAs, RNs, PTs, OTs, psychologists, social workers, pharmacists, RDNs, and more.',
    icon: Stethoscope,
    count: 'Licensed & reviewed',
  },
  {
    title: 'Allied & certified practitioners',
    description:
      'Personal trainers, health coaches, nutritionists, doulas, lactation consultants, acupuncturists, chiropractors, athletic trainers.',
    icon: Heart,
    count: 'Certified & reviewed',
  },
  {
    title: 'Healthcare-adjacent services',
    description:
      'Healthcare attorneys, compliance consultants, medical billing experts, RCM specialists, EHR consultants, practice startup advisors.',
    icon: Briefcase,
    count: 'Consulting & advisory',
  },
  {
    title: 'Educators & trainers',
    description:
      'Any professional can offer CEU/CME courses, board prep, certifications, corporate wellness, and mentorship programs.',
    icon: GraduationCap,
    count: 'Courses & training',
  },
]

const featuredCategories = [
  { title: 'Nursing & Nurse Practitioners', icon: UserCheck },
  { title: 'Physicians & Specialists', icon: Stethoscope },
  { title: 'Mental Health', icon: Brain },
  { title: 'Physical & Occupational Therapy', icon: Users },
  { title: 'Nutrition & Dietetics', icon: Heart },
  { title: 'Health Coaching', icon: Sparkles },
  { title: 'Personal Training & Fitness', icon: Users },
  { title: 'Healthcare Legal', icon: Scale },
  { title: 'Compliance & HIPAA', icon: Shield },
  { title: 'Medical Billing & Coding', icon: ClipboardCheck },
  { title: 'Practice Operations', icon: Wrench },
  { title: 'Continuing Education', icon: GraduationCap },
]

const orgUseCases = [
  {
    org: 'A clinic',
    need: 'needs a HIPAA compliance audit',
    fix: 'Hire a compliance consultant',
  },
  {
    org: 'A hospital',
    need: 'needs a nursing protocol review',
    fix: 'Hire a nursing consultant',
  },
  {
    org: 'A medical practice',
    need: 'needs revenue cycle help',
    fix: 'Hire an RCM specialist',
  },
  {
    org: 'A telehealth company',
    need: 'needs clinical leadership',
    fix: 'Hire a consulting NP or MD',
  },
  {
    org: 'A wellness center',
    need: 'needs a nutrition program',
    fix: 'Hire an RDN on retainer',
  },
  {
    org: 'A nursing home',
    need: 'needs staff continuing education',
    fix: 'Hire a CEU course instructor',
  },
]

// Example formats professionals can host — not scheduled events.
const featuredEvents = [
  {
    title: 'Live webinars',
    type: 'Webinar',
    detail: 'Teach a topic live to a virtual audience, free or paid.',
    format: 'Virtual',
  },
  {
    title: 'Hands-on workshops',
    type: 'Workshop',
    detail: 'Run half- or full-day sessions for practices and teams.',
    format: 'Virtual or in person',
  },
  {
    title: 'CEU & CME courses',
    type: 'CEU & CME',
    detail: 'Publish self-paced or live continuing-education content.',
    format: 'On-demand or live',
  },
  {
    title: 'Certification & prep cohorts',
    type: 'Certification',
    detail: 'Lead multi-week cohorts for board prep or certifications.',
    format: 'Virtual',
  },
]

// Professionals: no subscription or plan tiers. Free to join; Sanus takes a
// small service fee on each booking.
const professionalPricingPoints = [
  'Free account, credential review, and profile',
  'List services, consulting, and events',
  'See the exact service fee before you publish',
  'Payouts handled through Stripe',
]

const trustItems = [
  {
    title: 'Approval before booking',
    description:
      'Professionals are reviewed and approved by the Sanus team before they can be booked.',
    icon: BadgeCheck,
  },
  {
    title: 'License review',
    description:
      'Licensed professionals submit their license details for review as part of onboarding.',
    icon: FileCheck,
  },
  {
    title: 'Background & identity checks',
    description:
      'Depending on profession, verification can include identity and background screening through trusted vendors.',
    icon: ShieldCheck,
  },
  {
    title: 'Credential review',
    description:
      'Certifications and professional credentials are reviewed at onboarding.',
    icon: ClipboardCheck,
  },
  {
    title: 'HIPAA safeguards',
    description:
      'Built with HIPAA safeguards — access controls, audit logging, and encryption in transit and at rest.',
    icon: Lock,
  },
  {
    title: 'Secure payments',
    description:
      'Payments are processed by Stripe. Sanus never stores your full card details.',
    icon: Wallet,
  },
  {
    title: 'Reviews tied to real work',
    description:
      'Reviews are linked to an engagement completed through Sanus.',
    icon: Star,
  },
  {
    title: 'You stay in control',
    description:
      'Choose who you work with and what you share. Message before you book.',
    icon: UserCheck,
  },
]

// Honest, non-testimonial value props per audience (no fabricated quotes).
const audienceValueProps = [
  {
    title: 'Individuals',
    body: 'Find a reviewed professional for a consult, coaching, or guidance — virtually or in person — and book directly.',
    icon: Users,
  },
  {
    title: 'Businesses & employers',
    body: 'Bring in a dietitian, trainer, or wellness expert for your team on a project or retainer basis.',
    icon: Briefcase,
  },
  {
    title: 'Healthcare organizations',
    body: 'Engage compliance, billing, clinical-leadership, or education expertise directly — without agency markups.',
    icon: Building2,
  },
  {
    title: 'Professionals',
    body: 'List services, consulting, and events from one profile and get paid through Stripe.',
    icon: Stethoscope,
  },
]

const professionalGrowthPoints = [
  'Set your own rates and offer service packages',
  'Keep the majority of every booking',
  'Sell services, consulting, AND events from one profile',
  'Build a verified, reviewable reputation',
  'Reach individuals, businesses, and healthcare organizations',
]

/* ───────────────────────────── Page ───────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      {/* ═══════════════════════ Header ═══════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1dbf73] text-base font-bold text-white">
              S
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#111827]">
              Sanus<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#6b7280] lg:flex">
            <Link href="#categories" className="transition hover:text-[#111827]">
              Find a professional
            </Link>
            <Link href="#events" className="transition hover:text-[#111827]">
              Events &amp; training
            </Link>
            <Link
              href="#organizations"
              className="transition hover:text-[#111827]"
            >
              For organizations
            </Link>
            <Link href="#professionals" className="transition hover:text-[#111827]">
              For professionals
            </Link>
            <Link href="#how-it-works" className="transition hover:text-[#111827]">
              How it works
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <NavAuth>
              <Link
                href="/login"
                className="text-sm font-medium text-[#6b7280] transition hover:text-[#111827]"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
              >
                Join Sanus
              </Link>
            </NavAuth>
          </div>
        </div>
      </header>

      <main>
        {/* ═══════════════════════ Hero ═══════════════════════ */}
        <section className="relative overflow-hidden bg-[#0f4c3a] py-20 sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0f4c3a] via-[#374151] to-[#0d3f30]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Every health expert you need,
                <span className="text-[#1dbf73]"> in one place.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#cfd4d0]">
                From physicians and nurse practitioners to health coaches,
                healthcare attorneys, and nursing consultants — individuals,
                businesses, and healthcare organizations use Sanus to find and
                hire verified health professionals, book services, and access
                continuing education.
              </p>

              {/* Search bar */}
              <form
                action="/find-care"
                method="get"
                className="mx-auto mt-10 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/20"
              >
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#6b7280]"
                    aria-hidden="true"
                  />
                  <input
                    name="q"
                    type="search"
                    placeholder="What kind of health expertise are you looking for?"
                    className="h-12 w-full rounded-xl bg-transparent pl-12 pr-3 text-[15px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                >
                  Search
                  <ArrowRight className="ml-2 size-4" />
                </button>
              </form>

              {/* Popular tags */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="font-medium text-[#9ca3af]">Popular:</span>
                {popularSearches.map((tag) => (
                  <Link
                    key={tag}
                    href={`/find-care?q=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/80 transition hover:border-[#1dbf73] hover:bg-[#1dbf73]/10 hover:text-white"
                  >
                    {tag}
                  </Link>
                ))}
              </div>

              {/* Three buyer paths */}
              <div className="mt-12">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                  I am a…
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <BuyerPathButton
                    href="/signup?as=individual"
                    icon={Users}
                    title="Individual"
                    subtitle="Seeking care or guidance"
                  />
                  <BuyerPathButton
                    href="/signup?as=business"
                    icon={Briefcase}
                    title="Business or employer"
                    subtitle="Need health expertise"
                  />
                  <BuyerPathButton
                    href="/signup?as=organization"
                    icon={Building2}
                    title="Healthcare organization"
                    subtitle="Hospital, clinic, practice"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Stats bar ═══════════════════════ */}
        <section className="border-b border-[#e5e7eb] bg-white py-10">
          <div className="mx-auto grid max-w-4xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-[#1dbf73] sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1 text-sm font-medium text-[#6b7280]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ Featured professionals ═══════════════════════ */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                  Expertise you can find on Sanus
                </h2>
                <p className="mt-2 max-w-xl text-[#6b7280]">
                  Clinicians, coaches, consultants, and educators — all in one
                  marketplace, each reviewed before they can be booked.
                </p>
              </div>
              <Link
                href="/find-care"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
              >
                Browse all professionals
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {featuredExpertise.map((p) => {
                const Icon = p.icon
                return (
                  <Link
                    key={p.specialty}
                    href={`/find-care?q=${encodeURIComponent(p.specialty)}`}
                    className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#e5e7eb] transition hover:shadow-lg"
                  >
                    <div
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${p.color}`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="mt-4 text-center">
                      <h3 className="font-semibold text-[#111827]">
                        {p.specialty}
                      </h3>
                      <p className="text-xs text-[#6b7280]">
                        e.g. {p.credential} professionals
                      </p>
                    </div>
                    <div className="mt-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73]">
                        Browse
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Categories — all 4 tiers ═══════════════════════ */}
        <section id="categories" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Every expertise, one platform
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Four overlapping tiers of professionals — from licensed
                clinicians to healthcare consultants and educators.
              </p>
            </div>

            {/* Tier groups */}
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {tierGroups.map((tier) => {
                const Icon = tier.icon
                return (
                  <div
                    key={tier.title}
                    className="rounded-2xl bg-[#f9fafb] p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-[#111827]">
                      {tier.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                      {tier.description}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[#1dbf73]">
                      {tier.count}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Browsable category tiles */}
            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b7280]">
                Popular categories
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {featuredCategories.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <Link
                      key={cat.title}
                      href={`/find-care?q=${encodeURIComponent(cat.title)}`}
                      className="group flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-4 transition hover:border-[#1dbf73] hover:bg-[#f0faf5]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1] text-[#1dbf73]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-[#111827]">
                        {cat.title}
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/find-care"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
                >
                  Browse all categories
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Beyond clinical care ═══════════════════════ */}
        <section className="bg-[#0f4c3a] py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1dbf73]">
              Beyond clinical care
            </p>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Healthcare expertise isn&apos;t only at the bedside.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[#cfd4d0]">
              Sanus isn&apos;t only for patient-facing care. Healthcare
              attorneys, management consultants, legal nurse consultants,
              compliance specialists, medical billing experts, and healthcare IT
              advisors all have a home here. If your expertise touches
              healthcare, you belong on Sanus.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {[
                'Healthcare Legal',
                'Compliance & HIPAA',
                'Medical Billing',
                'RCM Consulting',
                'Practice Startup',
                'EHR & IT',
                'Credentialing',
                'Healthcare Marketing',
                'Clinical Research',
                'Medical Writing',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white/90"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ How it works ═══════════════════════ */}
        <section id="how-it-works" className="bg-[#eef2f6] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                How Sanus works
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Three audiences, one platform. Pick the path that matches you.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <HowItWorksColumn
                kicker="For individuals"
                title="Find the right expert and book directly"
                steps={[
                  'Search by specialty, service type, format, and price',
                  'Review profiles, packages, and verified reviews',
                  'Book directly and pay securely through Sanus',
                  'Get the expertise you need — virtually or in person',
                ]}
              />
              <HowItWorksColumn
                kicker="For businesses & organizations"
                title="Hire expertise on your terms"
                accent
                steps={[
                  'Search professionals by expertise, or post your project need',
                  'Review credentials, past work, and verified reviews',
                  'Send a message, request a custom quote, or book directly',
                  'Engage on your terms — project, retainer, or one-time consult',
                ]}
              />
              <HowItWorksColumn
                kicker="For professionals"
                title="Grow your practice and reach"
                steps={[
                  'Create your profile and list services, packages, and events',
                  'Submit your credentials for review — approval is required before you can be booked',
                  'Accept bookings, respond to inquiries, host events',
                  'Get paid through Stripe, build your reputation, expand your reach',
                ]}
              />
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Organizations ═══════════════════════ */}
        <section id="organizations" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Built for healthcare organizations too
              </h2>
              <p className="mt-4 text-[#6b7280]">
                Hospitals, clinics, medical practices, nursing homes,
                telehealth companies, and wellness businesses use Sanus to find
                and engage verified health professionals — for consulting,
                project work, education, and specialized expertise. No agency
                fees. No markups. Direct engagement.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {orgUseCases.map((u) => (
                <div
                  key={u.fix}
                  className="rounded-2xl bg-[#f9fafb] p-6 ring-1 ring-[#e5e7eb]"
                >
                  <p className="text-sm leading-relaxed text-[#6b7280]">
                    <span className="font-semibold text-[#111827]">{u.org}</span>{' '}
                    {u.need}.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f8f56]">
                    <Check className="h-4 w-4" />
                    {u.fix}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?as=organization"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-6 text-sm font-semibold text-white transition hover:bg-[#19a463]"
              >
                Post your project need
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/find-care"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[#e5e7eb] px-6 text-sm font-semibold text-[#111827] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
              >
                Browse professionals for your organization
              </Link>
            </div>

            {/* Trust row */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-[#6b7280]">
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#1dbf73]" />
                No agency fees
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#1dbf73]" />
                Direct professional engagement
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#1dbf73]" />
                Professionals reviewed before booking
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#1dbf73]" />
                Built with HIPAA safeguards
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Events ═══════════════════════ */}
        <section id="events" className="bg-[#f0faf5] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Events, training &amp; continuing education
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Live webinars, in-person workshops, CEU and CME courses, and
                certification programs — created and taught by Sanus
                professionals. Here&apos;s what professionals can host.
              </p>
            </div>

            {/* Filter tabs (visual only — link to /events with query) */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { label: 'All', q: '' },
                { label: 'Live webinars', q: 'webinar' },
                { label: 'Workshops', q: 'workshop' },
                { label: 'CEU & CME', q: 'ceu' },
                { label: 'Certifications', q: 'certification' },
                { label: 'In-person', q: 'in_person' },
                { label: 'Free', q: 'free' },
              ].map((f) => (
                <Link
                  key={f.label}
                  href={`/events${f.q ? `?type=${f.q}` : ''}`}
                  className="rounded-full border border-[#e5e7eb] bg-white px-4 py-1.5 text-xs font-medium text-[#6b7280] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
                >
                  {f.label}
                </Link>
              ))}
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {featuredEvents.map((e) => (
                <div
                  key={e.title}
                  className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg"
                >
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      e.type === 'Webinar'
                        ? 'bg-blue-100 text-blue-700'
                        : e.type === 'Workshop'
                          ? 'bg-amber-100 text-amber-700'
                          : e.type === 'CEU & CME'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {e.type}
                  </span>
                  <h3 className="mt-4 text-base font-semibold leading-snug text-[#111827]">
                    {e.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#6b7280]">
                    {e.detail}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#6b7280]">
                    <Calendar className="h-3.5 w-3.5" />
                    {e.format}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-[#6b7280]">
                      Example format
                    </span>
                    <Link
                      href="/events"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
                    >
                      Learn more
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/signup?as=professional"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
              >
                Are you a health professional? Host your event on Sanus
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ How professionals grow ═══════════════════════ */}
        <section id="professionals" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1dbf73]">
                  For professionals
                </p>
                <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                  How professionals grow on Sanus
                </h2>
                <p className="mt-4 text-[#6b7280]">
                  Sell services, run consulting engagements, and host CEU
                  courses — all from one verified profile. Build a real
                  practice that reaches individuals, businesses, and
                  healthcare organizations you couldn&apos;t reach on your own.
                </p>
                <ul className="mt-6 space-y-3">
                  {professionalGrowthPoints.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-3 text-sm text-[#374151]"
                    >
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e8faf1]">
                        <Check className="h-3 w-3 text-[#1dbf73]" />
                      </div>
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/signup?as=professional"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-6 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                  >
                    Offer your expertise
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href="#pricing"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-[#e5e7eb] px-6 text-sm font-semibold text-[#111827] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
                  >
                    See pricing
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl bg-[#0f4c3a] p-8 text-white sm:p-10">
                <p className="font-heading text-2xl leading-snug">
                  One profile for everything you offer — services, consulting
                  engagements, and continuing education.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-[#cfd4d0]">
                  <li className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                    Get reviewed once, then go live when you&apos;re ready
                  </li>
                  <li className="flex items-start gap-3">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                    Payouts handled through Stripe
                  </li>
                  <li className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                    Built with HIPAA safeguards
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Pricing ═══════════════════════ */}
        <section id="pricing" className="bg-[#f9fafb] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Free to join. A small service fee applies to each booking. No
                hidden fees.
              </p>
            </div>

            {/* Professionals: free to join, service fee per booking */}
            <div className="mt-10">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b7280]">
                For professionals
              </h3>
              <div className="mt-4 rounded-2xl border-2 border-[#1dbf73] bg-white p-7 shadow-sm sm:p-9">
                <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
                  <div>
                    <p className="font-heading text-4xl font-bold text-[#111827]">
                      Free to join
                    </p>
                    <p className="mt-3 text-[#6b7280]">
                      Free to join. A small service fee applies to each
                      booking.
                    </p>
                    <Link
                      href="/signup?as=professional"
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#1dbf73] px-6 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                    >
                      Get started
                    </Link>
                  </div>
                  <ul className="space-y-2.5">
                    {professionalPricingPoints.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-[#374151]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Individuals + organizations side-by-side */}
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf1]">
                    <Users className="h-5 w-5 text-[#1dbf73]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#111827]">
                    For individuals &amp; businesses
                  </h3>
                </div>
                <p className="mt-4 text-sm text-[#6b7280]">
                  Free to browse. A small service fee applies to each
                  booking.
                </p>
                <Link
                  href="/find-care"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-[#e5e7eb] px-5 text-sm font-semibold text-[#111827] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
                >
                  Find a professional
                </Link>
              </div>

              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf1]">
                    <Building2 className="h-5 w-5 text-[#1dbf73]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#111827]">
                    For healthcare organizations
                  </h3>
                </div>
                <p className="mt-4 text-sm text-[#6b7280]">
                  Custom enterprise plan — volume pricing, admin dashboard,
                  team accounts, and organization-level search.
                </p>
                <Link
                  href="/signup?as=organization"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-[#e5e7eb] px-5 text-sm font-semibold text-[#111827] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
                >
                  Contact us for organization pricing
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Trust & safety ═══════════════════════ */}
        <section id="trust" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Trust &amp; safety at every step
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Professionals are reviewed and approved before they can be
                booked, and the platform is built with HIPAA safeguards.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {trustItems.map((card) => {
                const Icon = card.icon
                return (
                  <div key={card.title} className="rounded-2xl bg-[#f9fafb] p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-[#111827]">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#6b7280]">
                      {card.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Testimonials ═══════════════════════ */}
        <section className="bg-[#f9fafb] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Built for every side of health expertise
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Individuals, businesses, organizations, and professionals.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {audienceValueProps.map((t) => {
                const Icon = t.icon
                return (
                  <div
                    key={t.title}
                    className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#e5e7eb]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#111827]">
                      {t.title}
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-[#374151]">
                      {t.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ Bottom CTA ═══════════════════════ */}
        <section className="bg-[#0f4c3a] py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
              One platform for the entire health expertise economy
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[#cfd4d0]">
              Whether you&apos;re an individual seeking guidance, a business
              bringing in health expertise, a hospital or clinic engaging a
              specialist, or a professional ready to grow your practice —
              Sanus is where you belong.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/find-care"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
              >
                Find a professional
              </Link>
              <Link
                href="/signup?as=organization"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Hire for your organization
              </Link>
              <Link
                href="/signup?as=professional"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Offer your expertise
              </Link>
              <Link
                href="/events"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Browse events
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════════ Footer ═══════════════════════ */}
      <footer className="border-t border-[#e5e7eb] bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
                  S
                </div>
                <span className="text-lg font-bold text-[#111827]">
                  Sanus<span className="text-[#1dbf73]">.</span>
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                Health expertise, on demand. For individuals, businesses, and
                healthcare organizations.
              </p>
            </div>

            <FooterColumn
              title="For individuals"
              links={[
                { label: 'Find a professional', href: '/find-care' },
                { label: 'Browse events', href: '/events' },
                { label: 'How it works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
              ]}
            />

            <FooterColumn
              title="For businesses & organizations"
              links={[
                { label: 'Hire expertise', href: '/find-care' },
                { label: 'Post a project', href: '/signup?as=organization' },
                { label: 'Organization pricing', href: '#pricing' },
                { label: 'How it works', href: '#how-it-works' },
              ]}
            />

            <FooterColumn
              title="For professionals"
              links={[
                {
                  label: 'List your services',
                  href: '/signup?as=professional',
                },
                { label: 'Post an event', href: '/signup?as=professional' },
                { label: 'Professional pricing', href: '#pricing' },
                { label: 'How it works', href: '#how-it-works' },
              ]}
            />

            <FooterColumn
              title="Platform"
              links={[
                { label: 'Trust & safety', href: '#trust' },
                { label: 'HIPAA safeguards', href: '#trust' },
                { label: 'About Sanus', href: '/' },
                { label: 'Contact', href: '/' },
                { label: 'Sign in', href: '/login' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
              ]}
            />
          </div>

          <div className="mt-12 border-t border-[#e5e7eb] pt-6 text-center text-sm text-[#6b7280]">
            &copy; {new Date().getFullYear()} Sanus. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ───────────────────────────── Inline components ───────────────────────────── */

function BuyerPathButton({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-[#1dbf73] hover:bg-[#1dbf73]/10"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#1dbf73] transition group-hover:bg-[#1dbf73] group-hover:text-white">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-[#cfd4d0]">{subtitle}</p>
      </div>
      <ArrowRight className="ml-auto mt-1 size-4 shrink-0 text-white/40 transition group-hover:text-white" />
    </Link>
  )
}

function HowItWorksColumn({
  kicker,
  title,
  steps,
  accent,
}: {
  kicker: string
  title: string
  steps: string[]
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-7 ${
        accent
          ? 'border-2 border-[#1dbf73] bg-white shadow-lg'
          : 'border border-[#e5e7eb] bg-white shadow-sm'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.15em] ${
          accent ? 'text-[#1dbf73]' : 'text-[#6b7280]'
        }`}
      >
        {kicker}
      </p>
      <h3 className="mt-3 font-heading text-xl font-bold text-[#111827]">
        {title}
      </h3>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-xs font-bold text-[#0f8f56]">
              {i + 1}
            </div>
            <span className="text-sm leading-relaxed text-[#374151]">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[#111827]">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm text-[#6b7280]">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="transition hover:text-[#111827]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
