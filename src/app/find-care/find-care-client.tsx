'use client'

import { Suspense, useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Star,
  SlidersHorizontal,
  MapPin,
  ChevronDown,
  UserPlus,
  ShieldCheck,
} from 'lucide-react'
import type { PublicProvider } from '@/lib/find-care/types'
import { SiteHeader } from '@/components/marketing/site-header'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

/* ────────────────────── Constants ────────────────────── */

const NURSING_TYPES = ['rn', 'lpn', 'cna', 'np']
const REHAB_TYPES = ['pt', 'ot', 'slp', 'rt']

function textMatches(p: PublicProvider, terms: string[]): boolean {
  const haystack = [p.specialty, p.headline, ...p.specialties]
    .join(' ')
    .toLowerCase()
  return terms.some((t) => haystack.includes(t))
}

/**
 * Category pills map onto contractor_profiles.professional_category (the
 * broad tier chosen at signup) and contractor_type (the license enum).
 */
const CATEGORY_FILTERS: { label: string; match: (p: PublicProvider) => boolean }[] = [
  { label: 'All', match: () => true },
  {
    label: 'Clinical',
    match: (p) => p.professional_category === 'clinical',
  },
  {
    label: 'Nursing',
    match: (p) => NURSING_TYPES.includes(p.contractor_type),
  },
  {
    label: 'Mental Health',
    match: (p) =>
      p.contractor_type === 'sw' ||
      textMatches(p, ['mental', 'counsel', 'anxiety', 'depression']),
  },
  {
    label: 'Physical & Rehab Therapy',
    match: (p) => REHAB_TYPES.includes(p.contractor_type),
  },
  {
    label: 'Nutrition & Wellness',
    match: (p) => textMatches(p, ['nutrition', 'dietitian', 'wellness', 'coach']),
  },
  {
    label: 'Allied & Certified',
    match: (p) => p.professional_category === 'allied',
  },
  {
    label: 'Consultants',
    match: (p) => p.professional_category === 'consultant',
  },
  {
    label: 'Educators',
    match: (p) => p.professional_category === 'educator',
  },
]

const SORT_OPTIONS = [
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'most_reviewed', label: 'Most Reviewed' },
] as const

const AVATAR_PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatRate(p: PublicProvider): string | null {
  const { hourly_rate_min: min, hourly_rate_max: max } = p
  if (min != null && max != null && max !== min) return `$${min} – $${max}/hr`
  if (min != null) return `From $${min}/hr`
  if (max != null) return `Up to $${max}/hr`
  return null
}

function compareNullsLast(
  a: number | null,
  b: number | null,
  dir: 'asc' | 'desc'
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return dir === 'asc' ? a - b : b - a
}

/* ────────────────────── Helper Components ────────────────────── */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.floor(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

function ProviderCard({ provider }: { provider: PublicProvider }) {
  const initials =
    `${provider.first_name[0] ?? ''}${provider.last_name[0] ?? ''}`.toUpperCase() ||
    '?'
  const colorClass = avatarColor(provider.id)
  const rate = formatRate(provider)
  const location = [provider.city, provider.state].filter(Boolean).join(', ')

  return (
    <div className="group rounded-2xl border border-[#e5e7eb] bg-white p-6 transition hover:shadow-lg">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {provider.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
          <img
            src={provider.avatar_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${colorClass}`}
          >
            {initials}
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[#111827]">
              {provider.first_name} {provider.last_name}
            </h3>
            <span className="shrink-0 rounded-full bg-[#e8faf1] px-2.5 py-0.5 text-xs font-semibold text-[#0f4c3a]">
              {provider.credential}
            </span>
            {provider.insured && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef6ff] px-2.5 py-0.5 text-xs font-semibold text-[#1e5aa8]">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Insured
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-[#6b7280]">
            {provider.specialty}
          </p>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            {provider.total_reviews > 0 ? (
              <>
                <StarRating rating={provider.average_rating} />
                <span className="text-sm font-semibold text-[#111827]">
                  {provider.average_rating.toFixed(1)}
                </span>
                <span className="text-sm text-[#6b7280]">
                  ({provider.total_reviews} review
                  {provider.total_reviews !== 1 ? 's' : ''})
                </span>
              </>
            ) : (
              <span className="text-sm text-[#6b7280]">New on Sanus</span>
            )}
          </div>
        </div>
      </div>

      {provider.headline && (
        <p className="mt-3 line-clamp-2 text-sm text-[#374151]">
          {provider.headline}
        </p>
      )}

      {/* Details row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold text-[#1dbf73]">
          {rate ?? 'Rate on request'}
        </span>
        {location && (
          <span className="flex items-center gap-1 text-[#6b7280]">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </span>
        )}
        {provider.is_available ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Available
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            Unavailable
          </span>
        )}
      </div>

      {/* Session types (only when known) */}
      {provider.session_types.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {provider.session_types.map((st) => (
            <span
              key={st}
              className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#374151]"
            >
              {st === 'in_person' ? 'In-Person' : st === 'virtual' ? 'Virtual' : st}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      <div className="mt-4">
        <Link
          href={`/pros/${provider.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#1dbf73] text-sm font-semibold text-[#1dbf73] transition hover:bg-[#1dbf73] hover:text-white"
        >
          View Profile
        </Link>
      </div>
    </div>
  )
}

/* ────────────────────── Filters Sidebar Content ────────────────────── */

function FiltersPanel({
  sessionType,
  setSessionType,
  rateMin,
  setRateMin,
  rateMax,
  setRateMax,
  minRating,
  setMinRating,
  specialty,
  setSpecialty,
  stateFilter,
  setStateFilter,
  clearAll,
  specialtyOptions,
  stateOptions,
  showSessionType,
}: {
  sessionType: string
  setSessionType: (v: string) => void
  rateMin: string
  setRateMin: (v: string) => void
  rateMax: string
  setRateMax: (v: string) => void
  minRating: string
  setMinRating: (v: string) => void
  specialty: string
  setSpecialty: (v: string) => void
  stateFilter: string
  setStateFilter: (v: string) => void
  clearAll: () => void
  specialtyOptions: string[]
  stateOptions: string[]
  showSessionType: boolean
}) {
  const activeCount = [
    sessionType !== 'all',
    rateMin !== '',
    rateMax !== '',
    minRating !== 'any',
    specialty !== 'All Specialties',
    stateFilter !== 'All States',
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111827]">
          Filters{activeCount > 0 && ` (${activeCount})`}
        </h3>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-[#1dbf73] hover:text-[#19a463]"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Session Type (demo data only — real profiles don't record formats yet) */}
      {showSessionType && (
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#111827]">
          Session Type
        </h4>
        <div className="space-y-2">
          {[
            { value: 'all', label: 'All Types' },
            { value: 'in_person', label: 'In-Person' },
            { value: 'virtual', label: 'Virtual' },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5"
            >
              <input
                type="radio"
                name="sessionType"
                checked={sessionType === opt.value}
                onChange={() => setSessionType(opt.value)}
                className="h-4 w-4 rounded-full border-[#d1d5db] text-[#1dbf73] accent-[#1dbf73]"
              />
              <span className="text-sm text-[#374151]">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      )}

      {/* Hourly Rate */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#111827]">
          Hourly Rate
        </h4>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">
              $
            </span>
            <Input
              type="number"
              placeholder="0"
              value={rateMin}
              onChange={(e) => setRateMin(e.target.value)}
              className="h-9 pl-6 text-sm"
            />
          </div>
          <span className="text-sm text-[#6b7280]">&ndash;</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">
              $
            </span>
            <Input
              type="number"
              placeholder="500+"
              value={rateMax}
              onChange={(e) => setRateMax(e.target.value)}
              className="h-9 pl-6 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Minimum Rating */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#111827]">
          Minimum Rating
        </h4>
        <div className="space-y-2">
          {[
            { value: 'any', label: 'Any rating' },
            { value: '3', label: '3+ stars', stars: 3 },
            { value: '4', label: '4+ stars', stars: 4 },
            { value: '5', label: '5 stars', stars: 5 },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5"
            >
              <input
                type="radio"
                name="minRating"
                checked={minRating === opt.value}
                onChange={() => setMinRating(opt.value)}
                className="h-4 w-4 rounded-full border-[#d1d5db] text-[#1dbf73] accent-[#1dbf73]"
              />
              <span className="flex items-center gap-1.5 text-sm text-[#374151]">
                {opt.stars ? (
                  <>
                    <span className="flex gap-0.5">
                      {Array.from({ length: opt.stars }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </span>
                    <span>& up</span>
                  </>
                ) : (
                  opt.label
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Specialty */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#111827]">
          Specialty
        </h4>
        <div className="relative">
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 pr-8 text-sm text-[#374151] outline-none focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20"
          >
            {['All Specialties', ...specialtyOptions].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        </div>
      </div>

      {/* State */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#111827]">
          Location / State
        </h4>
        <div className="relative">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 pr-8 text-sm text-[#374151] outline-none focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20"
          >
            {['All States', ...stateOptions].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        </div>
      </div>
    </div>
  )
}

/* ────────────────────── Main Page ────────────────────── */

type FindCareProps = {
  providers: PublicProvider[]
  isDemo: boolean
}

function FindCarePageContent({ providers, isDemo }: FindCareProps) {
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get('q') ?? ''
  // Search & filter state
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [activeCategory, setActiveCategory] = useState('All')
  const [sessionType, setSessionType] = useState('all')
  const [rateMin, setRateMin] = useState('')
  const [rateMax, setRateMax] = useState('')
  const [minRating, setMinRating] = useState('any')
  const [specialty, setSpecialty] = useState('All Specialties')
  const [stateFilter, setStateFilter] = useState('All States')
  const [sortBy, setSortBy] = useState('highest_rated')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const clearAll = () => {
    setSessionType('all')
    setRateMin('')
    setRateMax('')
    setMinRating('any')
    setSpecialty('All Specialties')
    setStateFilter('All States')
    setSearchQuery('')
    setActiveCategory('All')
  }

  const activeFilterCount = [
    sessionType !== 'all',
    rateMin !== '',
    rateMax !== '',
    minRating !== 'any',
    specialty !== 'All Specialties',
    stateFilter !== 'All States',
  ].filter(Boolean).length

  const specialtyOptions = useMemo(
    () => [...new Set(providers.map((p) => p.specialty))].sort(),
    [providers]
  )
  const stateOptions = useMemo(
    () =>
      [
        ...new Set(
          providers.map((p) => p.state).filter((s): s is string => !!s)
        ),
      ].sort(),
    [providers]
  )
  const showSessionType = providers.some((p) => p.session_types.length > 0)
  const filterOptionProps = { specialtyOptions, stateOptions, showSessionType }

  // Filter & sort providers
  const filteredProviders = useMemo(() => {
    let results = [...providers]

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      results = results.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          p.specialty.toLowerCase().includes(q) ||
          p.credential.toLowerCase().includes(q) ||
          p.headline.toLowerCase().includes(q) ||
          (p.bio ?? '').toLowerCase().includes(q) ||
          p.specialties.some((s) => s.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (activeCategory !== 'All') {
      const category = CATEGORY_FILTERS.find((c) => c.label === activeCategory)
      if (category) results = results.filter(category.match)
    }

    // Session type
    if (sessionType !== 'all') {
      results = results.filter((p) => p.session_types.includes(sessionType))
    }

    // Rate range
    if (rateMin) {
      const min = Number(rateMin)
      results = results.filter(
        (p) => (p.hourly_rate_max ?? p.hourly_rate_min ?? -Infinity) >= min
      )
    }
    if (rateMax) {
      const max = Number(rateMax)
      results = results.filter(
        (p) => (p.hourly_rate_min ?? p.hourly_rate_max ?? Infinity) <= max
      )
    }

    // Rating
    if (minRating !== 'any') {
      const min = Number(minRating)
      results = results.filter((p) => p.average_rating >= min)
    }

    // Specialty
    if (specialty !== 'All Specialties') {
      results = results.filter((p) => p.specialty === specialty)
    }

    // State
    if (stateFilter !== 'All States') {
      results = results.filter((p) => p.state === stateFilter)
    }

    // Sort
    switch (sortBy) {
      case 'highest_rated':
        results.sort((a, b) => b.average_rating - a.average_rating)
        break
      case 'price_low':
        results.sort((a, b) =>
          compareNullsLast(a.hourly_rate_min, b.hourly_rate_min, 'asc')
        )
        break
      case 'price_high':
        results.sort((a, b) =>
          compareNullsLast(a.hourly_rate_max, b.hourly_rate_max, 'desc')
        )
        break
      case 'most_reviewed':
        results.sort((a, b) => b.total_reviews - a.total_reviews)
        break
    }

    return results
  }, [
    searchQuery,
    activeCategory,
    sessionType,
    rateMin,
    rateMax,
    minRating,
    specialty,
    stateFilter,
    sortBy,
    providers,
  ])

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Page Heading ── */}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl md:text-4xl">
          Find Healthcare Professionals
        </h1>
        {isDemo ? (
          <p className="mt-2 inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            Demo mode — the profiles below are fictional sample data.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#6b7280]">
            Every professional listed here has been reviewed and approved by
            Sanus before they can be booked.
          </p>
        )}

        {/* ── Search Bar + Filters Button ── */}
        <div className="mt-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9ca3af]" />
            <label htmlFor="find-care-search" className="sr-only">
              Search providers
            </label>
            <input
              id="find-care-search"
              type="search"
              placeholder="Search by specialty, name, or condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#e5e7eb] bg-white pl-12 pr-4 text-base text-[#111827] placeholder-[#9ca3af] shadow-sm outline-none transition focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20"
            />
          </div>
          {/* Mobile filter button */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger
              className="relative inline-flex h-12 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 text-sm font-medium text-[#374151] shadow-sm transition hover:bg-[#f9fafb] lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1dbf73] text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">
                <FiltersPanel
                  sessionType={sessionType}
                  setSessionType={setSessionType}
                  rateMin={rateMin}
                  setRateMin={setRateMin}
                  rateMax={rateMax}
                  setRateMax={setRateMax}
                  minRating={minRating}
                  setMinRating={setMinRating}
                  specialty={specialty}
                  setSpecialty={setSpecialty}
                  stateFilter={stateFilter}
                  setStateFilter={setStateFilter}
                  clearAll={clearAll}
                  {...filterOptionProps}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Category Pills ── */}
        <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORY_FILTERS.map(({ label: cat }) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73] focus-visible:ring-offset-2 ${
                  activeCategory === cat
                    ? 'bg-[#0f4c3a] text-white'
                    : 'bg-white text-[#374151] border border-[#e5e7eb] hover:border-[#1dbf73] hover:text-[#1dbf73]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content: Sidebar + Results ── */}
        <div className="mt-6 flex gap-8">
          {/* Left sidebar — desktop only */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 rounded-2xl border border-[#e5e7eb] bg-white p-5">
              <FiltersPanel
                sessionType={sessionType}
                setSessionType={setSessionType}
                rateMin={rateMin}
                setRateMin={setRateMin}
                rateMax={rateMax}
                setRateMax={setRateMax}
                minRating={minRating}
                setMinRating={setMinRating}
                specialty={specialty}
                setSpecialty={setSpecialty}
                stateFilter={stateFilter}
                setStateFilter={setStateFilter}
                clearAll={clearAll}
                {...filterOptionProps}
              />
            </div>
          </aside>

          {/* Results area */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6b7280]">
                <span className="font-semibold text-[#111827]">
                  {filteredProviders.length}
                </span>{' '}
                provider{filteredProviders.length !== 1 ? 's' : ''} found
              </p>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-9 appearance-none rounded-lg border border-[#e5e7eb] bg-white pl-3 pr-8 text-sm text-[#374151] outline-none focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
              </div>
            </div>

            {/* Results grid or empty state */}
            {providers.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d5db] bg-white px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8faf1]">
                  <UserPlus className="h-7 w-7 text-[#1dbf73]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#111827]">
                  We&apos;re onboarding our first verified professionals
                </h3>
                <p className="mt-2 max-w-md text-sm text-[#6b7280]">
                  We&apos;re onboarding our first verified professionals in
                  your area — check back soon. Create a free account and
                  we&apos;ll be ready when you are.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                  >
                    Create an account
                  </Link>
                  <Link
                    href="/signup/professional"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e5e7eb] px-5 text-sm font-semibold text-[#111827] transition hover:border-[#1dbf73] hover:text-[#1dbf73]"
                  >
                    I&apos;m a health professional
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold text-[#6b7280] transition hover:text-[#111827]"
                  >
                    Keep browsing
                  </Link>
                </div>
              </div>
            ) : filteredProviders.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredProviders.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            ) : (
              <div className="mt-16 flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f4f6]">
                  <Search className="h-7 w-7 text-[#9ca3af]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#111827]">
                  No providers found
                </h3>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Try adjusting your filters or search terms
                </p>
                <button
                  onClick={clearAll}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 border-t border-[#e5e7eb] bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#6b7280] sm:flex-row sm:gap-4 sm:px-6">
          <span>&copy; {new Date().getFullYear()} Sanus. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/terms" className="transition hover:text-[#111827]">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition hover:text-[#111827]">
              Privacy Policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

export function FindCareClient(props: FindCareProps) {
  return (
    <Suspense fallback={null}>
      <FindCarePageContent {...props} />
    </Suspense>
  )
}
