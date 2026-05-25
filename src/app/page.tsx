import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  Heart,
  Leaf,
  Lock,
  Pill,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  UserCheck,
  Users,
  Wind,
} from 'lucide-react'

/* ───────────────────── Data ───────────────────── */

const popularCategories = [
  'Nursing',
  'Physical Therapy',
  'Respiratory Therapy',
  'CNA',
  'Emergency Medicine',
]

const stats = [
  { value: '12,000+', label: 'Verified Professionals' },
  { value: '4.8/5', label: 'Average Rating' },
  { value: '24hr', label: 'Average Fill Time' },
]

const featuredProviders = [
  {
    name: 'Sarah Johnson',
    credential: 'RN',
    specialty: 'ICU / Emergency',
    rating: 4.9,
    reviews: 127,
    rateRange: '$55 – $85/hr',
    initials: 'SJ',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    name: 'Dr. Michael Chen',
    credential: 'MD',
    specialty: 'Emergency Medicine',
    rating: 4.9,
    reviews: 98,
    rateRange: '$120 – $180/hr',
    initials: 'MC',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    name: 'Maria Santos',
    credential: 'PT',
    specialty: 'Physical Therapy',
    rating: 4.8,
    reviews: 84,
    rateRange: '$55 – $70/hr',
    initials: 'MS',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    name: 'Karen Williams',
    credential: 'CNA',
    specialty: 'Long-term Care',
    rating: 4.7,
    reviews: 63,
    rateRange: '$28 – $38/hr',
    initials: 'KW',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    name: 'James Rodriguez',
    credential: 'RRT',
    specialty: 'Respiratory Therapy',
    rating: 4.8,
    reviews: 71,
    rateRange: '$50 – $72/hr',
    initials: 'JR',
    color: 'bg-teal-100 text-teal-700',
  },
]

const specialties = [
  {
    title: 'Nursing',
    description: 'RNs, LPNs, and nurse practitioners for all care settings.',
    icon: Heart,
  },
  {
    title: 'Physical Therapy',
    description: 'Licensed PTs and PTAs for rehab and recovery.',
    icon: Users,
  },
  {
    title: 'Mental Health',
    description: 'Counselors, psychologists, and psychiatric professionals.',
    icon: Brain,
  },
  {
    title: 'Nutrition & Wellness',
    description: 'Dietitians and nutritionists for patient health programs.',
    icon: Leaf,
  },
  {
    title: 'Respiratory Therapy',
    description: 'RRTs for ventilator management and pulmonary care.',
    icon: Wind,
  },
  {
    title: 'Pharmacy',
    description: 'Pharmacists and pharmacy technicians for all settings.',
    icon: Pill,
  },
]

const howItWorksSteps = [
  {
    step: '1',
    title: 'Browse & Discover',
    description:
      'Search by specialty, location, availability, and rate. Our marketplace puts thousands of verified professionals at your fingertips.',
    icon: Search,
  },
  {
    step: '2',
    title: 'Book & Schedule',
    description:
      'Send offers, negotiate rates, and confirm bookings directly through the platform. No middlemen, no phone tag.',
    icon: Calendar,
  },
  {
    step: '3',
    title: 'Receive Care',
    description:
      'Get matched with the right professional and receive quality care at your location or facility.',
    icon: CheckCircle,
  },
  {
    step: '4',
    title: 'Get Matched',
    description:
      'Track timesheets, approve hours, and process payments seamlessly. Everything in one place, fully documented.',
    icon: CreditCard,
  },
]

const featuredEvents = [
  {
    title: 'IV Therapy Fundamentals for Home Health Nurses',
    type: 'Webinar',
    date: 'Dec 15, 2026',
    price: 'Free for members',
  },
  {
    title: 'Post-Surgical Home Care: What Patients Need to Know',
    type: 'Workshop',
    date: 'Jan 8, 2027',
    price: '$49',
  },
  {
    title: 'Nutrition for Chronic Disease Management',
    type: 'Certification',
    date: 'Ongoing',
    price: '$129',
  },
]

const membershipPlans = [
  {
    name: 'Basic',
    price: 'Free',
    period: '',
    description: 'Get started with essential access to the HealthGig marketplace.',
    features: [
      'Browse jobs & facilities',
      'Access public events & webinars',
      'Basic profile listing',
      'Book up to 3 sessions/month',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    description: 'For active providers who want to grow their practice.',
    features: [
      'Everything in Basic',
      'Post your services on the marketplace',
      'Priority search placement',
      'Superbill generation',
      'HIPAA-compliant messaging',
      'Unlimited bookings',
    ],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$79',
    period: '/month',
    description: 'For organizations needing premium support and features.',
    features: [
      'Everything in Professional',
      'Dedicated care coordinator',
      'Custom care plans',
      'White-glove support',
      'Early access to events',
      'Exclusive provider access',
      'Priority support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

const trustCards = [
  {
    title: 'License Verification',
    description:
      'Every professional is verified against state licensing databases before they can accept a single shift.',
    icon: FileCheck,
  },
  {
    title: 'Background Checks',
    description:
      'Comprehensive background screenings including criminal history, sex offender registry, and OIG exclusion list.',
    icon: ShieldCheck,
  },
  {
    title: 'HIPAA-Compliant',
    description:
      'Our platform meets all HIPAA requirements for data protection. Your information is encrypted and secure.',
    icon: Lock,
  },
  {
    title: 'Verified Reviews',
    description:
      'Only facilities that have worked with a professional can leave reviews. No fake ratings, ever.',
    icon: BadgeCheck,
  },
]

const testimonials = [
  {
    quote:
      'HealthGig completely changed how we handle last-minute shift coverage. We went from scrambling to make phone calls to filling shifts in under two hours.',
    name: 'Jennifer Martinez',
    role: 'Director of Nursing, Mercy General Hospital',
    rating: 5,
  },
  {
    quote:
      'As a travel nurse, I love the transparency. I can see the facility ratings, pay rates, and shift details upfront. No surprises and no agency markups.',
    name: 'David Thompson',
    role: 'Travel RN, ICU Specialist',
    rating: 5,
  },
  {
    quote:
      'The credentialing process was seamless. I uploaded my documents once and was matched with facilities within days. Best platform I have used.',
    name: 'Rachel Kim',
    role: 'Physical Therapist, Outpatient Rehab',
    rating: 5,
  },
]

/* ───────────────────── Page ───────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1dbf73] text-base font-bold text-white">
              H
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#111827]">
              HealthGig<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#6b7280] md:flex">
            <Link href="/find-care" className="font-semibold text-[#1dbf73]">
              Find Care
            </Link>
            <Link href="#events" className="transition hover:text-[#111827]">
              Events &amp; Education
            </Link>
            <Link href="#membership" className="transition hover:text-[#111827]">
              Membership
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
              Join HealthGig
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-[#0f4c3a] py-20 sm:py-28 lg:py-32">
          {/* Subtle warm gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0f4c3a] via-[#374151] to-[#0d3f30]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1dbf73]">
                Healthcare Staffing Marketplace
              </p>
              <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Find the Right Healthcare Pro for Every Shift.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#b8b7b4]">
                Browse verified clinicians, compare credentials and availability, and
                hire for per-diem, contract, travel, and urgent facility coverage — all
                in one trusted marketplace.
              </p>

              {/* Search Bar */}
              <div className="mx-auto mt-10 max-w-2xl">
                <div className="rounded-2xl bg-white p-2 shadow-xl shadow-black/10">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex min-h-12 flex-1 items-center gap-3 px-4 text-[#6b7280]">
                      <Search className="h-5 w-5 shrink-0" />
                      <span className="text-sm sm:text-base">
                        Try &ldquo;ICU nurse&rdquo;, &ldquo;CNA night shift&rdquo;, or &ldquo;respiratory therapist&rdquo;
                      </span>
                    </div>
                    <Link
                      href="/find-care"
                      className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-6 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                    >
                      Search
                    </Link>
                  </div>
                </div>
              </div>

              {/* Popular pills */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="font-medium text-[#6b7280]">Popular:</span>
                {popularCategories.map((cat) => (
                  <Link
                    key={cat}
                    href="/signup"
                    className="rounded-full border border-white/20 px-3.5 py-1.5 font-medium text-white/80 transition hover:border-[#1dbf73] hover:bg-[#1dbf73]/10 hover:text-white"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Bar / Stats ── */}
        <section className="border-b border-[#e5e7eb] bg-white py-10">
          <div className="mx-auto grid max-w-4xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[#1dbf73]">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-[#6b7280]">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Featured Providers ── */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                  Featured Providers
                </h2>
                <p className="mt-2 text-[#6b7280]">
                  Top-rated professionals ready to work.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
              >
                View all providers
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {featuredProviders.map((provider) => (
                <div
                  key={provider.name}
                  className="group rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg"
                >
                  {/* Avatar placeholder */}
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold ${provider.color}`}
                  >
                    {provider.initials}
                  </div>
                  <div className="mt-4 text-center">
                    <h3 className="font-semibold text-[#111827]">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-[#6b7280]">
                      {provider.credential} &middot; {provider.specialty}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-[#111827]">
                      {provider.rating}
                    </span>
                    <span className="text-[#6b7280]">
                      ({provider.reviews} reviews)
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-sm font-semibold text-[#1dbf73]">
                      {provider.rateRange}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Specialties ── */}
        <section id="specialties" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Every Healthcare Need, Covered
              </h2>
              <p className="mt-3 text-[#6b7280]">
                From bedside nursing to specialized therapy, find credentialed
                professionals across every discipline.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {specialties.map((spec) => {
                const Icon = spec.icon
                return (
                  <Link
                    key={spec.title}
                    href="/signup"
                    className="group rounded-2xl bg-[#f9fafb] p-7 transition hover:bg-white hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73] transition group-hover:bg-[#1dbf73] group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#111827]">
                      {spec.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                      {spec.description}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="bg-[#eef2f6] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                How HealthGig Works
              </h2>
              <p className="mt-3 text-[#6b7280]">
                From search to care in four simple steps.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
              {howItWorksSteps.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.step} className="text-center">
                    {/* Diamond container */}
                    <div className="relative mx-auto w-fit">
                      <div className="mx-auto flex h-16 w-16 rotate-45 items-center justify-center rounded-2xl bg-white shadow-md">
                        <Icon className="h-7 w-7 -rotate-45 text-[#1dbf73]" />
                      </div>
                      {/* Number badge */}
                      <div className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-xs font-bold text-white">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="mt-5 font-heading text-lg italic text-[#111827]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Trust & Safety ── */}
        <section id="trust" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Trust &amp; Safety at Every Step
              </h2>
              <p className="mt-3 text-[#6b7280]">
                We take compliance seriously so you can focus on care. Every
                professional is rigorously vetted before they join the platform.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {trustCards.map((card) => {
                const Icon = card.icon
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl bg-[#f9fafb] p-7"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 font-semibold text-[#111827]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                      {card.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Events & Education ── */}
        <section id="events" className="bg-[#f0faf5] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Events &amp; Education
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Webinars, workshops, certifications, and live classes from verified healthcare professionals.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {featuredEvents.map((event) => (
                <div
                  key={event.title}
                  className="rounded-2xl bg-white p-7 shadow-sm transition hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#eef2f6] px-3 py-1.5 text-xs font-semibold text-[#111827]">
                      {event.date}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        event.type === 'Webinar'
                          ? 'bg-blue-100 text-blue-700'
                          : event.type === 'Workshop'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {event.type}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-snug text-[#111827]">
                    {event.title}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1dbf73]">
                      {event.price}
                    </span>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] transition hover:text-[#19a463]"
                    >
                      Learn More
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-[#1dbf73] px-7 text-sm font-semibold text-[#1dbf73] transition hover:bg-[#1dbf73] hover:text-white"
              >
                View All Events
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Membership Plans ── */}
        <section id="membership" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Choose Your Plan
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Unlock access to post services, find shifts, and grow your practice.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {membershipPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl bg-white p-8 shadow-sm ${
                    plan.highlighted
                      ? 'border-2 border-[#1dbf73] shadow-lg'
                      : 'border border-[#e5e7eb]'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#1dbf73] px-4 py-1 text-xs font-bold text-white">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-[#111827]">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-bold text-[#111827]">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-[#6b7280]">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-[#6b7280]">{plan.description}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-[#374151]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link
                      href="/signup"
                      className={`inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition ${
                        plan.highlighted
                          ? 'bg-[#1dbf73] text-white hover:bg-[#19a463]'
                          : 'border border-[#e5e7eb] text-[#111827] hover:border-[#1dbf73] hover:text-[#1dbf73]'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                Trusted by Thousands
              </h2>
              <p className="mt-3 text-[#6b7280]">
                Real stories from facilities and healthcare professionals.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="rounded-2xl bg-white p-8 shadow-sm"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-[#374151]">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-6 border-t border-[#e5e7eb] pt-4">
                    <p className="font-semibold text-[#111827]">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-[#6b7280]">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="bg-[#0f4c3a] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Join thousands of facilities and healthcare professionals
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#b8b7b4]">
              Whether you need to fill shifts or find your next opportunity,
              HealthGig makes healthcare staffing simple, transparent, and
              trustworthy.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup/facility"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-7 text-sm font-semibold text-white transition hover:bg-[#19a463]"
              >
                Find Healthcare Professionals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/signup/contractor"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-7 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                Become a Provider
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e5e7eb] bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
                  H
                </div>
                <span className="text-lg font-bold text-[#111827]">
                  HealthGig<span className="text-[#1dbf73]">.</span>
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                The trusted marketplace connecting healthcare facilities with
                verified professionals.
              </p>
            </div>

            {/* For Facilities */}
            <div>
              <h4 className="text-sm font-semibold text-[#111827]">
                For Facilities
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[#6b7280]">
                <li>
                  <Link href="/signup/facility" className="transition hover:text-[#111827]">
                    Post a Shift
                  </Link>
                </li>
                <li>
                  <Link href="/signup/facility" className="transition hover:text-[#111827]">
                    Browse Professionals
                  </Link>
                </li>
                <li>
                  <Link href="/signup/facility" className="transition hover:text-[#111827]">
                    Enterprise Solutions
                  </Link>
                </li>
              </ul>
            </div>

            {/* For Professionals */}
            <div>
              <h4 className="text-sm font-semibold text-[#111827]">
                For Professionals
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[#6b7280]">
                <li>
                  <Link href="/signup/contractor" className="transition hover:text-[#111827]">
                    Find Shifts
                  </Link>
                </li>
                <li>
                  <Link href="/signup/contractor" className="transition hover:text-[#111827]">
                    Create Your Profile
                  </Link>
                </li>
                <li>
                  <Link href="/signup/contractor" className="transition hover:text-[#111827]">
                    Travel Opportunities
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-[#111827]">Company</h4>
              <ul className="mt-3 space-y-2 text-sm text-[#6b7280]">
                <li>
                  <Link href="/login" className="transition hover:text-[#111827]">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="#trust" className="transition hover:text-[#111827]">
                    Trust &amp; Safety
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="transition hover:text-[#111827]">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="#events" className="transition hover:text-[#111827]">
                    Events &amp; Education
                  </Link>
                </li>
                <li>
                  <Link href="#membership" className="transition hover:text-[#111827]">
                    Membership
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-[#e5e7eb] pt-6 text-center text-sm text-[#6b7280]">
            &copy; {new Date().getFullYear()} HealthGig. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
