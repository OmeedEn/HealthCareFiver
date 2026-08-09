import Link from 'next/link'
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
  { value: '4,800+', label: 'Verified professionals' },
  { value: '65+', label: 'Service categories' },
  { value: '4.8 / 5', label: 'Average rating' },
]

const featuredProfessionals = [
  {
    name: 'Dr. Amara Patel',
    credential: 'MD',
    specialty: 'Internal Medicine · Consulting',
    rating: 4.9,
    reviews: 142,
    rate: 'From $220 per consult',
    initials: 'AP',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    name: 'Renee Jackson',
    credential: 'RN, BSN',
    specialty: 'Nursing Consultant',
    rating: 5.0,
    reviews: 87,
    rate: 'From $150 per session',
    initials: 'RJ',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    name: 'Marcus Bell',
    credential: 'NBC-HWC',
    specialty: 'Health & Wellness Coach',
    rating: 4.9,
    reviews: 213,
    rate: 'From $90 per session',
    initials: 'MB',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    name: 'Katherine Liu, Esq.',
    credential: 'JD',
    specialty: 'Healthcare Attorney',
    rating: 5.0,
    reviews: 56,
    rate: 'From $450 per consult',
    initials: 'KL',
    color: 'bg-slate-100 text-slate-700',
  },
  {
    name: 'David Park',
    credential: 'NASM-CPT',
    specialty: 'Personal Trainer · Corporate',
    rating: 4.8,
    reviews: 174,
    rate: 'From $75 per session',
    initials: 'DP',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    name: 'Sofia Martinez',
    credential: 'RDN',
    specialty: 'Registered Dietitian',
    rating: 4.9,
    reviews: 192,
    rate: 'From $110 per consult',
    initials: 'SM',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    name: 'Marcus T. Watts',
    credential: 'CHC',
    specialty: 'HIPAA Compliance Consultant',
    rating: 5.0,
    reviews: 41,
    rate: 'From $1,500 per project',
    initials: 'MW',
    color: 'bg-indigo-100 text-indigo-700',
  },
  {
    name: 'Linda Okafor',
    credential: 'CPC',
    specialty: 'Medical Billing & Coding',
    rating: 4.9,
    reviews: 109,
    rate: 'From $250 per project',
    initials: 'LO',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    name: 'Dr. James Holloway',
    credential: 'DPT',
    specialty: 'CEU Course Creator',
    rating: 4.9,
    reviews: 318,
    rate: 'From $129 per course',
    initials: 'JH',
    color: 'bg-fuchsia-100 text-fuchsia-700',
  },
  {
    name: 'Priya Rao',
    credential: 'NP, MSN',
    specialty: 'Telehealth · Second Opinion',
    rating: 4.9,
    reviews: 261,
    rate: 'From $185 per consult',
    initials: 'PR',
    color: 'bg-cyan-100 text-cyan-700',
  },
]

const tierGroups = [
  {
    title: 'Licensed clinical professionals',
    description:
      'MDs, NPs, PAs, RNs, PTs, OTs, psychologists, social workers, pharmacists, RDNs, and more.',
    icon: Stethoscope,
    count: '2,400+ professionals',
  },
  {
    title: 'Allied & certified practitioners',
    description:
      'Personal trainers, health coaches, nutritionists, doulas, lactation consultants, acupuncturists, chiropractors, athletic trainers.',
    icon: Heart,
    count: '1,100+ professionals',
  },
  {
    title: 'Healthcare-adjacent services',
    description:
      'Healthcare attorneys, compliance consultants, medical billing experts, RCM specialists, EHR consultants, practice startup advisors.',
    icon: Briefcase,
    count: '780+ professionals',
  },
  {
    title: 'Educators & trainers',
    description:
      'Any professional can offer CEU/CME courses, board prep, certifications, corporate wellness, and mentorship programs.',
    icon: GraduationCap,
    count: '520+ educators',
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

const featuredEvents = [
  {
    title: 'IV Therapy Fundamentals for Home Health Nurses',
    type: 'Webinar',
    host: 'Renee Jackson, RN BSN',
    date: 'Dec 15, 2026 · 7:00 PM ET',
    format: 'Virtual',
    price: 'Free for members',
  },
  {
    title: 'HIPAA Audit Bootcamp for Independent Practices',
    type: 'Workshop',
    host: 'Marcus Watts, CHC',
    date: 'Jan 8, 2027 · Full day',
    format: 'Virtual',
    price: '$249',
  },
  {
    title: 'Nutrition for Chronic Disease Management (CEU)',
    type: 'CEU & CME',
    host: 'Sofia Martinez, RDN',
    date: 'Ongoing · Self-paced',
    format: 'On-demand',
    price: '$129',
  },
  {
    title: 'NCLEX Prep Intensive — 6 Week Live Cohort',
    type: 'Certification',
    host: 'Dr. James Holloway, DPT',
    date: 'Starts Feb 3, 2027',
    format: 'Virtual',
    price: '$499',
  },
]

const professionalPlans = [
  {
    name: 'Basic',
    price: 'Free',
    period: '',
    description: 'Get listed and start receiving inquiries.',
    features: [
      'Profile listing (basic)',
      '1 service listing',
      'Verified reviews',
      'In-platform messaging',
    ],
    cta: 'Get started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    description: 'For active professionals growing a real practice.',
    features: [
      'Full profile listing',
      'Unlimited service & event listings',
      'Priority placement in search',
      'Analytics dashboard',
      'HIPAA-compliant messaging',
      'Superbill generation',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Practice',
    price: '$79',
    period: '/month',
    description: 'Multi-provider teams and group practices.',
    features: [
      'Everything in Professional',
      'Team accounts (up to 5)',
      'Custom booking page',
      'Top-tier search placement',
      'Advanced analytics',
      'Dedicated support',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
]

const trustItems = [
  {
    title: 'License verification',
    description:
      'All licensed professionals verified against state licensing databases before they can accept any booking.',
    icon: FileCheck,
  },
  {
    title: 'NPI confirmed',
    description:
      'All clinical professionals verified against the federal NPI registry.',
    icon: BadgeCheck,
  },
  {
    title: 'OIG screened',
    description:
      'All professionals screened against the HHS OIG exclusion database.',
    icon: ShieldCheck,
  },
  {
    title: 'Background checked',
    description:
      'Non-licensed professionals undergo a full criminal background check before listing.',
    icon: Shield,
  },
  {
    title: 'Identity verified',
    description:
      'Every professional confirms their identity with a government-issued ID.',
    icon: UserCheck,
  },
  {
    title: 'Credential review',
    description:
      'Certifications, malpractice insurance, and professional credentials reviewed at onboarding.',
    icon: ClipboardCheck,
  },
  {
    title: 'HIPAA compliant',
    description:
      'Platform meets all HIPAA requirements. All data encrypted at rest and in transit.',
    icon: Lock,
  },
  {
    title: 'Verified reviews only',
    description:
      'Only clients who completed a booking or attended an event can leave a review.',
    icon: Star,
  },
]

const testimonials = [
  {
    quote:
      "I found a nurse practitioner for a telehealth consult on a Friday night and had a prescription by Saturday morning. I didn't know something like this existed.",
    name: 'Marcus T.',
    role: 'Individual client',
    rating: 5,
  },
  {
    quote:
      'We needed a registered dietitian to lead a 6-week nutrition program for our corporate wellness initiative. Found the right person on Sanus in under an hour.',
    name: 'Stephanie R.',
    role: 'Head of People · 200-person tech company',
    rating: 5,
  },
  {
    quote:
      'Our clinic needed a HIPAA compliance consultant after a policy update. We posted our need on Sanus and had three qualified consultants respond within 24 hours. We hired one for an ongoing retainer.',
    name: 'Dr. Kevin M.',
    role: 'Medical Director · independent primary care clinic',
    rating: 5,
  },
  {
    quote:
      'I listed my nursing consulting services and my CEU course on Sanus six months ago. I now have a full client roster and 340 CEU enrollments. I made more last quarter than I made in a full year at the bedside.',
    name: 'Renee J., RN, BSN',
    role: 'Nursing Consultant',
    rating: 5,
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
                <p className="text-3xl font-bold text-[#1dbf73]">{s.value}</p>
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
                  Featured professionals
                </h2>
                <p className="mt-2 max-w-xl text-[#6b7280]">
                  Clinicians, coaches, consultants, and educators — all in one
                  marketplace.
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
              {featuredProfessionals.map((p) => (
                <div
                  key={p.name}
                  className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#e5e7eb] transition hover:shadow-lg"
                >
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold ${p.color}`}
                  >
                    {p.initials}
                  </div>
                  <div className="mt-4 text-center">
                    <h3 className="font-semibold text-[#111827]">{p.name}</h3>
                    <p className="text-xs text-[#6b7280]">
                      {p.credential} · {p.specialty}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-[#111827]">
                      {p.rating}
                    </span>
                    <span className="text-xs text-[#6b7280]">
                      ({p.reviews})
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-sm font-semibold text-[#1dbf73]">
                      {p.rate}
                    </span>
                  </div>
                </div>
              ))}
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
                  'Get verified — license check, NPI validation, credential review',
                  'Accept bookings, respond to inquiries, host events',
                  'Get paid weekly, build your reputation, expand your reach',
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
                All professionals verified
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#1dbf73]" />
                HIPAA-compliant platform
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
                certification programs — created and taught by verified Sanus
                professionals. Earn credits, build skills, grow your practice.
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
                  <p className="mt-2 text-xs text-[#6b7280]">
                    Hosted by{' '}
                    <span className="font-medium text-[#374151]">{e.host}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#6b7280]">
                    <Calendar className="h-3.5 w-3.5" />
                    {e.date}
                  </div>
                  <div className="mt-1 text-xs text-[#6b7280]">{e.format}</div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1dbf73]">
                      {e.price}
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
                <p className="font-heading text-2xl italic leading-snug">
                  &ldquo;I listed my nursing consulting services and my CEU
                  course on Sanus six months ago. I now have a full client
                  roster and 340 CEU enrollments. I made more last quarter than
                  I made in a full year at the bedside.&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                    RJ
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Renee J., RN, BSN</p>
                    <p className="text-xs text-[#cfd4d0]">Nursing Consultant</p>
                  </div>
                </div>
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
                Different tracks for different needs. No hidden fees.
              </p>
            </div>

            {/* Professional plans */}
            <div className="mt-10">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b7280]">
                For professionals
              </h3>
              <div className="mt-4 grid gap-6 md:grid-cols-3">
                {professionalPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`relative rounded-2xl bg-white p-7 shadow-sm ${
                      plan.highlighted
                        ? 'border-2 border-[#1dbf73] shadow-lg'
                        : 'border border-[#e5e7eb]'
                    }`}
                  >
                    {plan.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1dbf73] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        Most popular
                      </div>
                    )}
                    <h4 className="text-lg font-semibold text-[#111827]">
                      {plan.name}
                    </h4>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-heading text-4xl font-bold text-[#111827]">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-[#6b7280]">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-[#6b7280]">
                      {plan.description}
                    </p>
                    <ul className="mt-5 space-y-2.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm text-[#374151]"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup?as=professional"
                      className={`mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition ${
                        plan.highlighted
                          ? 'bg-[#1dbf73] text-white hover:bg-[#19a463]'
                          : 'border border-[#e5e7eb] text-[#111827] hover:border-[#1dbf73] hover:text-[#1dbf73]'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                ))}
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
                  Free to browse and book. Sanus earns a small commission per
                  transaction. No subscription required to hire.
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
                Every professional on Sanus is rigorously vetted. Every booking
                runs through a HIPAA-compliant platform.
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
                Real stories from every side of Sanus
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Individuals, businesses, organizations, and professionals.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#e5e7eb]"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-[#374151]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 border-t border-[#e5e7eb] pt-4">
                    <p className="text-sm font-semibold text-[#111827]">
                      {t.name}
                    </p>
                    <p className="text-xs text-[#6b7280]">{t.role}</p>
                  </div>
                </div>
              ))}
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
                { label: 'HIPAA compliance', href: '#trust' },
                { label: 'About Sanus', href: '/' },
                { label: 'Contact', href: '/' },
                { label: 'Sign in', href: '/login' },
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
