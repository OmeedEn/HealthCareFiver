// Homepage sections, shared by / and the standalone marketing pages.
//
// Design language: calm paper-and-ink base on a 12-column grid, with a few
// loud moments — oversized Archivo display type, condensed credential
// numerals, an ink specialty ticker, and the ultramarine closing band.
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ClipboardCheck,
  FileCheck,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
  Wallet,
} from 'lucide-react'
import {
  CategoryExplorer,
  CountUp,
  CredentialExplorer,
  Reveal,
  type ExplorerTier,
} from '@/components/marketing/interactive'

/* ───────────────────────────── Shared styles ───────────────────────────── */

const wrap = 'mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10'

const btnBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2'
const btnPrimary = `${btnBase} bg-brand text-white hover:bg-brand-hover focus-visible:outline-brand`
const btnSecondary = `${btnBase} border border-ink text-ink hover:bg-ink hover:text-paper focus-visible:outline-brand`

const textLink =
  'group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink underline decoration-brand-line underline-offset-4 transition hover:decoration-brand'

const h2Class =
  'font-display text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink text-balance'

function SectionHead({
  title,
  lede,
  action,
  tone = 'paper',
}: {
  title: ReactNode
  lede?: ReactNode
  action?: ReactNode
  tone?: 'paper' | 'ink'
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
      <h2
        className={`${h2Class} lg:col-span-7 ${tone === 'ink' ? 'text-paper' : ''}`}
      >
        {title}
      </h2>
      {(lede || action) && (
        <div className="lg:col-span-5 lg:pb-1">
          {lede && (
            <p
              className={`max-w-[46ch] text-base leading-relaxed sm:text-lg ${
                tone === 'ink' ? 'text-paper/75' : 'text-ink-muted'
              }`}
            >
              {lede}
            </p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </div>
      )}
    </div>
  )
}

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

const marqueeSpecialties = [
  'Physicians & specialists',
  'Nurse practitioners',
  'Mental health',
  'Nutrition & dietetics',
  'Physical therapy',
  'Health coaching',
  'Personal training',
  'Healthcare legal',
  'HIPAA & compliance',
  'Medical billing',
  'Practice operations',
  'Continuing education',
]

// Illustrative kinds of expertise — NOT real people, ratings, or prices.
const featuredExpertise = [
  { credential: 'MD', specialty: 'Physician consulting' },
  { credential: 'RN', specialty: 'Nursing consulting' },
  { credential: 'NBC-HWC', specialty: 'Health & wellness coaching' },
  { credential: 'JD', specialty: 'Healthcare legal' },
  { credential: 'CPT', specialty: 'Personal & corporate training' },
  { credential: 'RDN', specialty: 'Nutrition & dietetics' },
  { credential: 'CHC', specialty: 'HIPAA & compliance' },
  { credential: 'CPC', specialty: 'Medical billing & coding' },
  { credential: 'CEU', specialty: 'Continuing education' },
  { credential: 'NP', specialty: 'Telehealth & second opinions' },
]

const tierGroups: ExplorerTier[] = [
  {
    id: 'clinical',
    title: 'Licensed clinical professionals',
    short: 'Clinical',
    description:
      'MDs, NPs, PAs, RNs, PTs, OTs, psychologists, social workers, pharmacists, RDNs, and more — licensed and reviewed before they can be booked.',
    categories: [
      'Physicians & Specialists',
      'Nursing & Nurse Practitioners',
      'Mental Health',
      'Physical & Occupational Therapy',
      'Nutrition & Dietetics',
      'Telehealth',
    ],
  },
  {
    id: 'allied',
    title: 'Allied & certified practitioners',
    short: 'Allied & certified',
    description:
      'Personal trainers, health coaches, nutritionists, doulas, lactation consultants, acupuncturists, chiropractors, and athletic trainers — certified and reviewed.',
    categories: [
      'Health Coaching',
      'Personal Training & Fitness',
      'Doulas',
      'Lactation Consulting',
      'Acupuncture',
      'Chiropractic',
    ],
  },
  {
    id: 'adjacent',
    title: 'Healthcare-adjacent services',
    short: 'Consulting & advisory',
    description:
      'Healthcare attorneys, compliance consultants, medical billing experts, RCM specialists, EHR consultants, and practice startup advisors.',
    categories: [
      'Healthcare Legal',
      'Compliance & HIPAA',
      'Medical Billing & Coding',
      'RCM Consulting',
      'Practice Operations',
      'EHR & IT',
    ],
  },
  {
    id: 'education',
    title: 'Educators & trainers',
    short: 'Courses & training',
    description:
      'Any professional can offer CEU/CME courses, board prep, certifications, corporate wellness, and mentorship programs.',
    categories: [
      'Continuing Education',
      'CEU Courses',
      'Board Prep',
      'Certifications',
      'Corporate Wellness',
      'Mentorship',
    ],
  },
]

const orgUseCases = [
  { org: 'A clinic', need: 'needs a HIPAA compliance audit', fix: 'Hire a compliance consultant' },
  { org: 'A hospital', need: 'needs a nursing protocol review', fix: 'Hire a nursing consultant' },
  { org: 'A medical practice', need: 'needs revenue cycle help', fix: 'Hire an RCM specialist' },
  { org: 'A telehealth company', need: 'needs clinical leadership', fix: 'Hire a consulting NP or MD' },
  { org: 'A wellness center', need: 'needs a nutrition program', fix: 'Hire an RDN on retainer' },
  { org: 'A nursing home', need: 'needs staff continuing education', fix: 'Hire a CEU course instructor' },
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
    description: 'Certifications and professional credentials are reviewed at onboarding.',
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
    description: 'Payments are processed by Stripe. Sanus never stores your full card details.',
    icon: Wallet,
  },
  {
    title: 'Reviews tied to real work',
    description: 'Reviews are linked to an engagement completed through Sanus.',
    icon: Star,
  },
  {
    title: 'You stay in control',
    description: 'Choose who you work with and what you share. Message before you book.',
    icon: UserCheck,
  },
]

// Honest, non-testimonial value props per audience (no fabricated quotes).
const audienceValueProps = [
  {
    title: 'Individuals',
    body: 'Find a reviewed professional for a consult, coaching, or guidance — virtually or in person — and book directly.',
  },
  {
    title: 'Businesses & employers',
    body: 'Bring in a dietitian, trainer, or wellness expert for your team on a project or retainer basis.',
  },
  {
    title: 'Healthcare organizations',
    body: 'Engage compliance, billing, clinical-leadership, or education expertise directly — without agency markups.',
  },
  {
    title: 'Professionals',
    body: 'List services, consulting, and events from one profile and get paid through Stripe.',
  },
]

const professionalGrowthPoints = [
  'Set your own rates and offer service packages',
  'Keep the majority of every booking',
  'Sell services, consulting, AND events from one profile',
  'Build a verified, reviewable reputation',
  'Reach individuals, businesses, and healthcare organizations',
]

const buyerPaths = [
  { href: '/signup/client', title: 'Individual', subtitle: 'Seeking care or guidance' },
  {
    href: '/signup/organization?source=HIRING',
    title: 'Business or employer',
    subtitle: 'Need health expertise',
  },
  {
    href: '/signup/organization?source=HIRING',
    title: 'Healthcare organization',
    subtitle: 'Hospital, clinic, practice',
  },
]

/* ───────────────────────────── Sections ───────────────────────────── */

export function HeroSection() {
  return (
    <section className="relative border-b border-line bg-paper">
      <div className={`${wrap} pt-12 sm:pt-16 lg:pt-20`}>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="type-expanded text-[clamp(2.5rem,6.2vw,5.75rem)] font-semibold leading-[0.94] text-ink text-balance lg:col-span-8">
            Every health expert you need, in one place.
          </h1>
          <p className="max-w-[44ch] text-base leading-relaxed text-ink-muted sm:text-lg lg:col-span-4 lg:pb-2">
            Physicians and nurse practitioners, health coaches, healthcare
            attorneys, and nursing consultants. Individuals, businesses, and
            healthcare organizations use Sanus to hire verified professionals,
            book services, and take continuing education.
          </p>
        </div>

        {/* Search */}
        <form
          action="/find-care"
          method="get"
          role="search"
          className="mt-10 flex max-w-3xl flex-col gap-2 sm:flex-row sm:gap-0"
        >
          <label htmlFor="home-search" className="sr-only">
            Search health professionals
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="What kind of health expertise are you looking for?"
              className="h-14 w-full rounded-md border-2 border-ink bg-surface pl-12 pr-4 text-base text-ink placeholder:text-ink-faint focus:outline-none focus-visible:border-brand sm:rounded-r-none sm:border-r-0"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-14 items-center justify-center rounded-md bg-ink px-7 text-sm font-semibold text-paper transition-colors hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:rounded-l-none"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex max-w-4xl flex-wrap items-baseline gap-x-4 gap-y-2 text-sm">
          <span className="text-ink-faint">Popular</span>
          {popularSearches.map((tag) => (
            <Link
              key={tag}
              href={`/find-care?q=${encodeURIComponent(tag)}`}
              className="text-ink-soft underline decoration-line-strong underline-offset-4 transition hover:text-brand-ink hover:decoration-brand"
            >
              {tag}
            </Link>
          ))}
        </div>

        {/* The loud moment: credential explorer */}
        <div className="mt-14 sm:mt-20">
          <CredentialExplorer />
        </div>
      </div>

      {/* Three buyer paths */}
      <div className="mt-14 border-t border-ink">
        <div className={`${wrap} grid sm:grid-cols-[minmax(0,0.6fr)_repeat(3,minmax(0,1fr))]`}>
          <p className="py-5 text-sm text-ink-muted sm:py-7">I am a…</p>
          {buyerPaths.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className="group relative flex items-start justify-between gap-4 border-t border-line py-6 transition-colors sm:border-l sm:border-t-0 sm:px-6 sm:py-7 hover:bg-paper-sunken"
            >
              <span>
                <span className="block font-display text-xl font-semibold tracking-tight text-ink">
                  {p.title}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">{p.subtitle}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-ink-faint transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Ink ticker of specialties — a hard band between hero and content. */
export function SpecialtyMarquee() {
  const items = (dup: boolean) =>
    marqueeSpecialties.map((s) => (
      <li
        key={`${dup ? 'd' : 'o'}-${s}`}
        data-dup={dup || undefined}
        aria-hidden={dup || undefined}
        className="flex items-center"
      >
        <Link
          href={`/find-care?q=${encodeURIComponent(s)}`}
          tabIndex={dup ? -1 : undefined}
          className="type-condensed px-6 text-[clamp(2rem,4.2vw,3.75rem)] text-paper transition-colors hover:text-brand-on-ink"
        >
          {s}
        </Link>
        <Plus aria-hidden="true" className="size-6 shrink-0 text-brand-on-ink" strokeWidth={3} />
      </li>
    ))

  return (
    <section aria-label="Browse by specialty" className="sanus-marquee overflow-hidden bg-ink py-6 sm:py-8">
      <ul className="sanus-marquee-track flex w-max items-center">
        {items(false)}
        {items(true)}
      </ul>
    </section>
  )
}

export function StatsBar() {
  const stats: { node: ReactNode; label: string }[] = [
    {
      node: <CountUp value={100} suffix="%" />,
      label: 'of professionals are reviewed and approved before they can be booked',
    },
    {
      node: <CountUp value={4} />,
      label: 'tiers of expertise, from licensed clinicians to educators',
    },
    {
      node: <CountUp value={20} suffix="+" />,
      label: 'categories across clinical care, consulting, and education',
    },
    {
      node: '$0',
      label: 'to join. Payments run through Stripe — Sanus never stores card data',
    },
  ]
  return (
    <section aria-label="Sanus at a glance" className="border-b border-line bg-paper">
      <dl className={`${wrap} grid grid-cols-2 lg:grid-cols-4`}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col-reverse justify-end gap-3 border-line py-8 sm:py-10 ${
              i % 2 === 1 ? 'border-l pl-5 sm:pl-8' : 'pr-5'
            } ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l lg:pl-8' : ''}`}
          >
            <dt className="max-w-[24ch] text-sm leading-snug text-ink-muted">{s.label}</dt>
            <dd className="type-condensed text-[clamp(3.5rem,7vw,6.5rem)] text-ink">{s.node}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function FeaturedExpertise() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Expertise you can find on Sanus"
          lede="Clinicians, coaches, consultants, and educators in one marketplace, each reviewed before they can be booked."
          action={
            <Link href="/find-care" className={textLink}>
              Browse all professionals
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        />

        <ul className="mt-14 grid border-t-2 border-ink lg:grid-cols-2 lg:gap-x-10">
          {featuredExpertise.map((p) => (
            <li key={p.specialty} className="border-b border-line">
              <Link
                href={`/find-care?q=${encodeURIComponent(p.specialty)}`}
                className="group relative grid grid-cols-[6.5rem_1fr_auto] items-center gap-4 overflow-hidden py-4 before:absolute before:inset-0 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-500 before:ease-out-expo hover:before:scale-x-100 focus-visible:before:scale-x-100 sm:grid-cols-[9rem_1fr_auto]"
              >
                <span
                  className={`type-condensed relative whitespace-nowrap pl-3 text-ink transition-colors duration-300 group-hover:text-brand-on-ink group-focus-visible:text-brand-on-ink ${
                    p.credential.length > 4 ? 'text-2xl sm:text-3xl' : 'text-[2.5rem] sm:text-5xl'
                  }`}
                >
                  {p.credential}
                </span>
                <span className="relative">
                  <span className="block text-base font-semibold text-ink transition-colors duration-300 group-hover:text-paper group-focus-visible:text-paper sm:text-lg">
                    {p.specialty}
                  </span>
                  <span className="block text-sm text-ink-muted transition-colors duration-300 group-hover:text-paper/70 group-focus-visible:text-paper/70">
                    e.g. {p.credential} professionals
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="relative mr-3 size-5 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper group-focus-visible:text-paper"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function CategoriesSection() {
  return (
    <section id="categories" className="border-t border-line bg-paper-sunken py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Every expertise, one platform"
          lede="Four overlapping tiers of professionals — from licensed clinicians to healthcare consultants and educators. Pick one to explore."
        />
        <div className="mt-14">
          <CategoryExplorer tiers={tierGroups} />
        </div>
        <div className="mt-10">
          <Link href="/find-care" className={textLink}>
            Browse all categories
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export function BeyondClinicalSection() {
  return (
    <section className="bg-ink py-24 text-paper sm:py-32">
      <div className={wrap}>
        <p className="text-sm text-paper/60">Beyond clinical care</p>
        <Reveal>
          <h2 className="mt-5 max-w-[15ch] font-display text-[clamp(2.75rem,7.4vw,7rem)] font-semibold leading-[0.92] tracking-[-0.035em] text-balance">
            Healthcare expertise isn&apos;t only at the bedside.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-10 border-t border-paper/20 pt-10 lg:grid-cols-12">
          <p className="max-w-[52ch] text-lg leading-relaxed text-paper/75 lg:col-span-6">
            Sanus isn&apos;t only for patient-facing care. Healthcare
            attorneys, management consultants, legal nurse consultants,
            compliance specialists, medical billing experts, and healthcare IT
            advisors all have a home here. If your expertise touches
            healthcare, you belong on Sanus.
          </p>
          <ul className="flex flex-wrap content-start gap-2 lg:col-span-6">
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
              <li key={tag}>
                <Link
                  href={`/find-care?q=${encodeURIComponent(tag)}`}
                  className="inline-flex h-9 items-center rounded-full border border-paper/25 px-4 text-sm text-paper/90 transition-colors hover:border-brand-on-ink hover:text-brand-on-ink"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  const columns = [
    {
      kicker: 'For individuals',
      title: 'Find the right expert and book directly',
      steps: [
        'Search by specialty, service type, format, and price',
        'Review profiles, packages, and verified reviews',
        'Book directly and pay securely through Sanus',
        'Get the expertise you need — virtually or in person',
      ],
    },
    {
      kicker: 'For businesses & organizations',
      title: 'Hire expertise on your terms',
      accent: true,
      steps: [
        'Search professionals by expertise, or post your project need',
        'Review credentials, past work, and verified reviews',
        'Send a message, request a custom quote, or book directly',
        'Engage on your terms — project, retainer, or one-time consult',
      ],
    },
    {
      kicker: 'For professionals',
      title: 'Grow your practice and reach',
      steps: [
        'Create your profile and list services, packages, and events',
        'Submit your credentials for review — approval is required before you can be booked',
        'Accept bookings, respond to inquiries, host events',
        'Get paid through Stripe, build your reputation, expand your reach',
      ],
    },
  ]
  return (
    <section id="how-it-works" className="bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="How Sanus works"
          lede="Three audiences, one platform. Pick the path that matches you."
        />
        <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-10">
          {columns.map((c) => (
            <HowItWorksColumn key={c.kicker} {...c} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function OrganizationsSection() {
  return (
    <section id="organizations" className="bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Built for healthcare organizations too"
          lede="Hospitals, clinics, medical practices, nursing homes, telehealth companies, and wellness businesses engage verified professionals for consulting, project work, education, and specialized expertise. No agency fees. No markups."
        />

        <ul className="mt-14 border-t-2 border-ink">
          {orgUseCases.map((u) => (
            <li
              key={u.fix}
              className="grid gap-2 border-b border-line py-6 sm:grid-cols-12 sm:items-baseline sm:gap-6"
            >
              <p className="font-display text-xl font-medium leading-snug tracking-tight text-ink-muted sm:col-span-7 sm:text-2xl">
                <span className="font-semibold text-ink">{u.org}</span> {u.need}.
              </p>
              <p className="inline-flex items-center gap-2 text-base font-semibold text-brand-ink sm:col-span-5">
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                {u.fix}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup/organization?source=HIRING" className={btnPrimary}>
            Post your project need
          </Link>
          <Link href="/find-care" className={btnSecondary}>
            Browse professionals for your organization
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-muted">
          {[
            'No agency fees',
            'Direct professional engagement',
            'Professionals reviewed before booking',
            'Built with HIPAA safeguards',
          ].map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 text-success" strokeWidth={2.5} />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function EventsSection() {
  return (
    <section id="events" className="bg-paper-sunken py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Events, training & continuing education"
          lede="Live webinars, in-person workshops, CEU and CME courses, and certification programs — created and taught by Sanus professionals. Here's what professionals can host."
        />

        {/* Filter links into the signed-in events listing. */}
        <nav aria-label="Event types" className="mt-10 flex flex-wrap gap-2">
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
              className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              {f.label}
            </Link>
          ))}
        </nav>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featuredEvents.map((e) => (
            <article
              key={e.title}
              className="flex flex-col rounded-xl bg-surface p-6 ring-1 ring-line"
            >
              <span className="inline-flex w-fit rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
                {e.type}
              </span>
              <h3 className="mt-6 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
                {e.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{e.detail}</p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                <span className="text-ink-muted">{e.format}</span>
                <Link href="/for-professionals" className={textLink}>
                  Learn more
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 text-sm text-ink-muted">
          Example formats. Sign in to browse upcoming events and register.
        </p>

        <div className="mt-10">
          <Link href="/signup/offer" className={textLink}>
            Are you a health professional? Host your event on Sanus
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export function ProfessionalsSection() {
  return (
    <section id="professionals" className="bg-paper py-20 sm:py-28">
      <div className={`${wrap} grid gap-12 lg:grid-cols-12 lg:gap-10`}>
        <div className="lg:col-span-6">
          <h2 className={h2Class}>How professionals grow on Sanus</h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-muted">
            Sell services, run consulting engagements, and host CEU courses
            from one verified profile. Build a practice that reaches
            individuals, businesses, and healthcare organizations you
            couldn&apos;t reach on your own.
          </p>
          <ul className="mt-8 border-t border-line">
            {professionalGrowthPoints.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 border-b border-line py-3.5 text-base text-ink-soft"
              >
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/signup/offer" className={btnPrimary}>
              Offer your expertise
            </Link>
            <Link href="/for-professionals#pricing" className={btnSecondary}>
              See pricing
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl bg-ink p-8 text-paper sm:p-12 lg:col-span-6">
          <p className="font-display text-[clamp(1.75rem,3vw,2.75rem)] font-semibold leading-[1.05] tracking-tight text-balance">
            One profile for everything you offer — services, consulting
            engagements, and continuing education.
          </p>
          <ul className="mt-12 space-y-4 border-t border-paper/20 pt-8 text-base text-paper/80">
            <li className="flex items-start gap-3">
              <BadgeCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-on-ink" />
              Get reviewed once, then go live when you&apos;re ready
            </li>
            <li className="flex items-start gap-3">
              <Wallet aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-on-ink" />
              Payouts handled through Stripe
            </li>
            <li className="flex items-start gap-3">
              <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-on-ink" />
              Built with HIPAA safeguards
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export function TrustSection() {
  return (
    <section id="trust" className="border-t border-line bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Trust & safety at every step"
          lede="Professionals are reviewed and approved before they can be booked, and the platform is built with HIPAA safeguards."
        />
        <div className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.title} className="border-b border-r border-line bg-surface p-6 sm:p-7">
                <Icon aria-hidden="true" className="size-6 text-brand" strokeWidth={1.75} />
                <h3 className="mt-8 font-display text-lg font-semibold tracking-tight text-ink">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{card.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function AudienceSection() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Built for every side of health expertise"
          lede="Individuals, businesses, organizations, and professionals."
        />
        <div className="mt-14 grid border-t-2 border-ink md:grid-cols-2">
          {audienceValueProps.map((t, i) => (
            <div
              key={t.title}
              className={`border-b border-line py-8 md:py-10 ${
                i % 2 === 1 ? 'md:border-l md:pl-10' : 'md:pr-10'
              }`}
            >
              <h3 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-none tracking-tight text-ink">
                {t.title}
              </h3>
              <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-ink-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BottomCta() {
  return (
    <section className="relative overflow-hidden bg-brand py-24 text-white sm:py-32">
      <div className={wrap}>
        <Reveal>
          <h2 className="max-w-[17ch] font-display text-[clamp(2.75rem,7vw,6.75rem)] font-semibold leading-[0.92] tracking-[-0.035em] text-balance">
            One platform for the entire health expertise economy.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 border-t border-white/30 pt-10 lg:grid-cols-12">
          <p className="max-w-[52ch] text-lg leading-relaxed text-white lg:col-span-5">
            Whether you&apos;re an individual seeking guidance, a business
            bringing in health expertise, a hospital or clinic engaging a
            specialist, or a professional ready to grow your practice — Sanus
            is where you belong.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            <Link
              href="/find-care"
              className={`${btnBase} bg-white text-brand-ink hover:bg-paper focus-visible:outline-white`}
            >
              Find a professional
            </Link>
            {[
              { href: '/signup/organization?source=HIRING', label: 'Hire for your organization' },
              { href: '/signup/offer', label: 'Offer your expertise' },
              { href: '/events-and-training', label: 'Browse events' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`${btnBase} border border-white/50 text-white hover:border-white hover:bg-white hover:text-brand-ink focus-visible:outline-white`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function PricingSection({
  show = 'all',
}: {
  show?: 'all' | 'professionals' | 'buyers'
}) {
  return (
    <section id="pricing" className="border-t border-line bg-paper-sunken py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead
          title="Simple, transparent pricing"
          lede="Free to join. A small service fee applies to each booking. No hidden fees."
        />

        {show !== 'buyers' && (
          <div className="mt-14">
            <h3 className="text-sm font-semibold text-ink-muted">For professionals</h3>
            <div className="mt-4 grid gap-10 rounded-2xl bg-surface p-8 ring-1 ring-line sm:p-12 md:grid-cols-2 md:items-end">
              <div>
                <p className="type-condensed text-[clamp(4rem,10vw,8.5rem)] text-ink">
                  Free to join
                </p>
                <p className="mt-4 text-lg text-ink-muted">
                  A small service fee applies to each booking.
                </p>
                <Link href="/signup/offer" className={`${btnPrimary} mt-8`}>
                  Get started
                </Link>
              </div>
              <ul className="border-t border-line">
                {professionalPricingPoints.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 border-b border-line py-3.5 text-base text-ink-soft"
                  >
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {show !== 'professionals' && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl bg-surface p-8 ring-1 ring-line">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
                For individuals &amp; businesses
              </h3>
              <p className="mt-3 text-base text-ink-muted">
                Free to browse. A small service fee applies to each booking.
              </p>
              <Link href="/find-care" className={`${btnSecondary} mt-8 w-fit`}>
                Find a professional
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl bg-surface p-8 ring-1 ring-line">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
                For healthcare organizations
              </h3>
              <p className="mt-3 text-base text-ink-muted">
                Custom enterprise plan — volume pricing, admin dashboard, team
                accounts, and organization-level search.
              </p>
              <Link
                href="/signup/organization?source=HIRING"
                className={`${btnSecondary} mt-8 w-fit`}
              >
                Contact us for organization pricing
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
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
    <div className={`border-t-4 pt-6 ${accent ? 'border-brand' : 'border-ink'}`}>
      <p className={`text-sm font-semibold ${accent ? 'text-brand-ink' : 'text-ink-muted'}`}>
        {kicker}
      </p>
      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-ink text-balance">
        {title}
      </h3>
      <ol className="mt-8">
        {steps.map((s, i) => (
          <li
            key={s}
            className="grid grid-cols-[2.75rem_1fr] items-baseline border-t border-line py-4"
          >
            <span className="type-condensed text-3xl text-ink-faint" aria-hidden="true">
              {i + 1}
            </span>
            <span className="text-base leading-relaxed text-ink-soft">
              <span className="sr-only">Step {i + 1}: </span>
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ───────────────────────────── Page scaffolding ───────────────────────────── */

/** Hero used at the top of each standalone marketing page. */
export function PageIntro({
  kicker,
  title,
  description,
  primary,
  secondary,
}: {
  kicker: string
  title: string
  description: string
  primary?: { label: string; href: string }
  secondary?: { label: string; href: string }
}) {
  return (
    <section className="border-b border-line bg-paper">
      <div className={`${wrap} pb-14 pt-10 sm:pb-20 sm:pt-14`}>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-ink-muted">
            <li>
              <Link href="/" className="transition hover:text-ink">
                Sanus
              </Link>
            </li>
            <li aria-hidden="true" className="text-ink-faint">
              /
            </li>
            <li aria-current="page" className="font-medium text-ink">
              {kicker}
            </li>
          </ol>
        </nav>
        <h1 className="type-expanded mt-10 max-w-[16ch] text-[clamp(2.75rem,7vw,6.5rem)] font-semibold leading-[0.92] text-ink text-balance sm:mt-14">
          {title}
        </h1>
        <div className="mt-12 grid gap-8 border-t-2 border-ink pt-8 lg:grid-cols-12 lg:gap-10">
          <p className="max-w-[52ch] text-lg leading-relaxed text-ink-muted lg:col-span-6">
            {description}
          </p>
          {(primary || secondary) && (
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-6 lg:justify-end">
              {primary && (
                <Link href={primary.href} className={btnPrimary}>
                  {primary.label}
                </Link>
              )}
              {secondary && (
                <Link href={secondary.href} className={btnSecondary}>
                  {secondary.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

const exploreLinks = [
  {
    title: 'Events & training',
    body: 'Webinars, workshops, CEU and CME courses, and certification cohorts taught by Sanus professionals.',
    href: '/events-and-training',
  },
  {
    title: 'For organizations',
    body: 'Hospitals, clinics, practices, and employers engage consulting, compliance, and clinical expertise directly.',
    href: '/for-organizations',
  },
  {
    title: 'For professionals',
    body: 'Sell services, consulting, and events from one verified profile. Free to join.',
    href: '/for-professionals',
  },
  {
    title: 'How it works',
    body: 'How booking, review and approval, payments, and HIPAA safeguards work on Sanus.',
    href: '/how-it-works',
  },
]

/** Homepage block pointing visitors to each standalone page. */
export function ExploreSection() {
  return (
    <section className="border-t border-line bg-paper py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead title="Explore Sanus" lede="Pick the path that matches you." />
        <div className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
          {exploreLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative border-t-2 border-line-strong pb-10 pt-6 before:absolute before:-top-0.5 before:left-0 before:h-0.5 before:w-full before:origin-left before:scale-x-0 before:bg-brand before:transition-transform before:duration-500 before:ease-out-expo hover:before:scale-x-100 focus-visible:before:scale-x-100"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink transition-colors group-hover:text-brand-ink">
                  {item.title}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-ink-faint transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand"
                />
              </span>
              <span className="mt-3 block max-w-[34ch] text-base leading-relaxed text-ink-muted">
                {item.body}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
