import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  HeartPulse,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react'

const categories = [
  'Nursing',
  'Allied health',
  'Dental',
  'Long-term care',
  'Surgery centers',
  'Home health',
]

const marketplaceCards = [
  {
    title: 'ICU nurse for urgent weekend coverage',
    facility: 'Northline Medical Center',
    rate: '$82/hr',
    location: 'Los Angeles, CA',
    rating: '4.9',
    icon: HeartPulse,
  },
  {
    title: 'Travel respiratory therapist',
    facility: 'Vista Regional Hospital',
    rate: '$3.1k/wk',
    location: 'Phoenix, AZ',
    rating: '4.8',
    icon: Stethoscope,
  },
  {
    title: 'Credentialed CNA for long-term care',
    facility: 'Greenway Skilled Nursing',
    rate: '$34/hr',
    location: 'Austin, TX',
    rating: '5.0',
    icon: UserRoundCheck,
  },
]

const serviceCategories = [
  { label: 'Verified clinicians', icon: BadgeCheck },
  { label: 'Shift coverage', icon: CalendarClock },
  { label: 'Facility hiring', icon: Building2 },
  { label: 'Credential checks', icon: ShieldCheck },
  { label: 'Secure contracts', icon: BriefcaseBusiness },
  { label: 'Fast payouts', icon: WalletCards },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1f1f1f]">
      <header className="sticky top-0 z-50 border-b border-[#e4e5e7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1dbf73] text-base font-black text-white">
              H
            </div>
            <span className="text-2xl font-black tracking-tight text-[#404145]">
              HealthGig<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#62646a] md:flex">
            <Link href="#marketplace" className="hover:text-[#1dbf73]">
              Explore
            </Link>
            <Link href="#how-it-works" className="hover:text-[#1dbf73]">
              How it works
            </Link>
            <Link href="/signup/facility" className="hover:text-[#1dbf73]">
              Post a job
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-bold text-[#62646a] hover:text-[#1dbf73]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#1dbf73] px-4 text-sm font-bold text-[#1dbf73] transition hover:bg-[#1dbf73] hover:text-white"
            >
              Join
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#e4e5e7] bg-[#0f4c3a]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8ee7bf]">
                Healthcare talent marketplace
              </p>
              <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Find the right healthcare pro for every shift.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#d8f7e8]">
                Browse verified clinicians, compare availability, and hire for
                per-diem, contract, travel, and urgent facility coverage.
              </p>

              <div className="mt-8 max-w-3xl rounded-md bg-white p-2 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-12 flex-1 items-center gap-3 px-4 text-[#62646a]">
                    <Search className="h-5 w-5" />
                    <span className="text-sm sm:text-base">
                      Try "ICU nurse", "CNA night shift", or "respiratory therapist"
                    </span>
                  </div>
                  <Link
                    href="/signup"
                    className="inline-flex h-12 items-center justify-center rounded-md bg-[#1dbf73] px-6 text-sm font-black text-white transition hover:bg-[#19a463]"
                  >
                    Search
                  </Link>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/80">
                <span className="font-semibold">Popular:</span>
                {categories.slice(0, 4).map((category) => (
                  <Link
                    key={category}
                    href="/signup"
                    className="rounded-full border border-white/30 px-3 py-1 font-semibold hover:border-white hover:bg-white hover:text-[#0f4c3a]"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-md bg-[#f7f7f7] p-4 shadow-2xl shadow-black/25">
                <div className="rounded-md bg-white p-5">
                  <div className="flex items-center justify-between border-b border-[#e4e5e7] pb-4">
                    <div>
                      <p className="text-sm font-bold text-[#1dbf73]">
                        Live matches
                      </p>
                      <h2 className="text-xl font-black text-[#404145]">
                        Available today
                      </h2>
                    </div>
                    <div className="rounded-full bg-[#ffecd1] px-3 py-1 text-xs font-black text-[#8a4b00]">
                      128 jobs
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {marketplaceCards.map((card) => {
                      const Icon = card.icon
                      return (
                        <div
                          key={card.title}
                          className="rounded-md border border-[#e4e5e7] p-4 transition hover:border-[#1dbf73]"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#e8faf1] text-[#1dbf73]">
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-sm font-black text-[#404145]">
                                {card.title}
                              </h3>
                              <p className="mt-1 text-xs font-semibold text-[#74767e]">
                                {card.facility}
                              </p>
                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1 font-semibold text-[#74767e]">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {card.location}
                                </span>
                                <span className="font-black text-[#404145]">
                                  {card.rate}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1 border-t border-[#f1f1f1] pt-3 text-xs font-bold text-[#ffb33e]">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {card.rating}
                            <span className="font-semibold text-[#95979d]">
                              verified facility
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="marketplace" className="border-b border-[#e4e5e7] py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-[#404145]">
                  Explore healthcare services
                </h2>
                <p className="mt-2 text-[#62646a]">
                  Marketplace-style hiring, built for compliant care teams.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 text-sm font-black text-[#1dbf73]"
              >
                Browse all categories
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {serviceCategories.map((category) => {
                const Icon = category.icon
                return (
                  <Link
                    key={category.label}
                    href="/signup"
                    className="group rounded-md border border-[#e4e5e7] bg-white p-6 transition hover:border-[#1dbf73] hover:shadow-lg"
                  >
                    <Icon className="h-8 w-8 text-[#1dbf73]" />
                    <div className="mt-8 h-1 w-12 rounded-full bg-[#1dbf73] transition group-hover:w-20" />
                    <h3 className="mt-4 text-lg font-black text-[#404145]">
                      {category.label}
                    </h3>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#fafafa] py-14">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-[#404145]">
                A cleaner way to hire healthcare talent
              </h2>
              <div className="mt-8 space-y-5">
                {[
                  'Verified licenses, credentials, availability, and reviews in one profile.',
                  'Simple contracts, messaging, timesheets, and payments after hire.',
                  'Built for facilities, agencies, and independent clinicians.',
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1dbf73] text-white">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-base font-semibold leading-7 text-[#404145]">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['12k+', 'credentialed professionals'],
                ['4.8/5', 'average facility rating'],
                ['24 hr', 'typical urgent coverage'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-md border border-[#e4e5e7] bg-white p-6"
                >
                  <p className="text-3xl font-black text-[#1dbf73]">{value}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#62646a]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-black tracking-tight text-[#404145]">
              How HealthGig works
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <StepCard
                step="1"
                title="Search the marketplace"
                description="Facilities and clinicians browse by role, credential, shift, location, and pay."
              />
              <StepCard
                step="2"
                title="Compare verified profiles"
                description="Review credentials, reviews, availability, and facility details before engaging."
              />
              <StepCard
                step="3"
                title="Book and manage work"
                description="Keep messages, contracts, timesheets, and payments in one workflow."
              />
            </div>
          </div>
        </section>

        <section className="bg-[#404145] py-14">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-4 sm:px-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                Ready to staff your next shift?
              </h2>
              <p className="mt-2 text-[#d1d1d1]">
                Join HealthGig and start matching with qualified healthcare talent.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#1dbf73] px-6 text-sm font-black text-white hover:bg-[#19a463]"
            >
              Join HealthGig
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e4e5e7] bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 text-sm font-semibold text-[#74767e] sm:px-6 md:flex-row">
          <p>
            <span className="font-black text-[#404145]">HealthGig.</span> Healthcare
            staffing marketplace
          </p>
          <div className="flex flex-wrap gap-5">
            <Link href="/signup/contractor" className="hover:text-[#1dbf73]">
              Professionals
            </Link>
            <Link href="/signup/facility" className="hover:text-[#1dbf73]">
              Facilities
            </Link>
            <Link href="/login" className="hover:text-[#1dbf73]">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-[#e4e5e7] bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8faf1] text-sm font-black text-[#1dbf73]">
        {step}
      </div>
      <h3 className="mt-6 text-lg font-black text-[#404145]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#62646a]">
        {description}
      </p>
    </div>
  )
}
