'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Star,
  SlidersHorizontal,
  MapPin,
  ChevronDown,
  Menu,
} from 'lucide-react'
import { DEMO_PROVIDERS } from '@/lib/demo/data'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

/* ────────────────────── Constants ────────────────────── */

const CATEGORIES = [
  'All',
  'In-Home Nursing',
  'IV Therapy',
  'Virtual Consultations',
  'Nutrition & Wellness',
  'Post-Surgery Care',
  'Mental Health',
  'Physical Therapy',
] as const

const SPECIALTIES = [
  'All Specialties',
  'ICU & Critical Care',
  'Emergency Medicine',
  'Orthopedic Rehab',
  'Long-term & Geriatric Care',
  'Respiratory Therapy',
  'Clinical Nutrition',
  'Travel Nursing',
  'Mental Health Counseling',
] as const

const STATES = [
  'All States',
  'AZ',
  'CA',
  'CO',
  'IL',
  'TX',
  'WA',
] as const

const SORT_OPTIONS = [
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'most_reviewed', label: 'Most Reviewed' },
] as const

const AVATAR_COLORS: Record<string, string> = {
  'prov-1': 'bg-rose-100 text-rose-700',
  'prov-2': 'bg-blue-100 text-blue-700',
  'prov-3': 'bg-amber-100 text-amber-700',
  'prov-4': 'bg-purple-100 text-purple-700',
  'prov-5': 'bg-teal-100 text-teal-700',
  'prov-6': 'bg-emerald-100 text-emerald-700',
  'prov-7': 'bg-indigo-100 text-indigo-700',
  'prov-8': 'bg-pink-100 text-pink-700',
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

function ProviderCard({
  provider,
}: {
  provider: (typeof DEMO_PROVIDERS)[number]
}) {
  const initials = `${provider.first_name[0]}${provider.last_name[0]}`
  const colorClass = AVATAR_COLORS[provider.id] || 'bg-gray-100 text-gray-700'

  return (
    <div className="group rounded-2xl border border-[#e5e7eb] bg-white p-6 transition hover:shadow-lg">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${colorClass}`}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[#111827]">
              {provider.first_name} {provider.last_name}
            </h3>
            <span className="shrink-0 rounded-full bg-[#e8faf1] px-2.5 py-0.5 text-xs font-semibold text-[#0f4c3a]">
              {provider.credential}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-[#6b7280]">
            {provider.specialty}
          </p>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={provider.average_rating} />
            <span className="text-sm font-semibold text-[#111827]">
              {provider.average_rating}
            </span>
            <span className="text-sm text-[#6b7280]">
              ({provider.total_reviews} reviews)
            </span>
          </div>
        </div>
      </div>

      {/* Details row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold text-[#1dbf73]">
          ${provider.hourly_rate_min} &ndash; ${provider.hourly_rate_max}/hr
        </span>
        <span className="flex items-center gap-1 text-[#6b7280]">
          <MapPin className="h-3.5 w-3.5" />
          {provider.city}, {provider.state}
        </span>
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

      {/* Session types */}
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

      {/* Action */}
      <div className="mt-4">
        <Link
          href="/signup"
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

      {/* Session Type */}
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
            {SPECIALTIES.map((s) => (
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
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s === 'All States' ? s : s}
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

export default function FindCarePage() {
  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sessionType, setSessionType] = useState('all')
  const [rateMin, setRateMin] = useState('')
  const [rateMax, setRateMax] = useState('')
  const [minRating, setMinRating] = useState('any')
  const [specialty, setSpecialty] = useState('All Specialties')
  const [stateFilter, setStateFilter] = useState('All States')
  const [sortBy, setSortBy] = useState('highest_rated')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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

  // Filter & sort providers
  const filteredProviders = useMemo(() => {
    let results = [...DEMO_PROVIDERS]

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
          p.specialties.some((s) => s.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (activeCategory !== 'All') {
      const catMap: Record<string, (p: (typeof DEMO_PROVIDERS)[number]) => boolean> = {
        'In-Home Nursing': (p) =>
          p.contractor_type === 'rn' || p.contractor_type === 'cna',
        'IV Therapy': (p) => p.contractor_type === 'rn',
        'Virtual Consultations': (p) => p.session_types.includes('virtual'),
        'Nutrition & Wellness': (p) =>
          p.specialty.toLowerCase().includes('nutrition') ||
          p.specialties.some((s) => s.toLowerCase().includes('nutrition') || s.toLowerCase().includes('wellness')),
        'Post-Surgery Care': (p) =>
          p.specialty.toLowerCase().includes('ortho') ||
          p.specialties.some((s) => s.toLowerCase().includes('orthopedics')),
        'Mental Health': (p) =>
          p.specialty.toLowerCase().includes('mental') ||
          p.contractor_type === 'sw',
        'Physical Therapy': (p) => p.contractor_type === 'pt',
      }
      const fn = catMap[activeCategory]
      if (fn) results = results.filter(fn)
    }

    // Session type
    if (sessionType !== 'all') {
      results = results.filter((p) => p.session_types.includes(sessionType))
    }

    // Rate range
    if (rateMin) {
      const min = Number(rateMin)
      results = results.filter((p) => p.hourly_rate_max >= min)
    }
    if (rateMax) {
      const max = Number(rateMax)
      results = results.filter((p) => p.hourly_rate_min <= max)
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
        results.sort((a, b) => a.hourly_rate_min - b.hourly_rate_min)
        break
      case 'price_high':
        results.sort((a, b) => b.hourly_rate_max - a.hourly_rate_max)
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
  ])

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
              H
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              HealthGig<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#6b7280] lg:flex">
            <Link
              href="/find-care"
              className="font-semibold text-[#1dbf73]"
            >
              Find Care
            </Link>
            <Link href="/#events" className="transition hover:text-[#111827]">
              Events &amp; Education
            </Link>
            <Link href="/#membership" className="transition hover:text-[#111827]">
              Membership
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-[#6b7280] transition hover:text-[#111827] sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1dbf73] px-4 text-sm font-semibold text-white transition hover:bg-[#19a463]"
            >
              Get Started
            </Link>
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5 text-[#374151]" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <div className="border-t border-[#e5e7eb] bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-2 text-sm font-medium">
              <Link
                href="/find-care"
                className="rounded-lg px-3 py-2 font-semibold text-[#1dbf73]"
              >
                Find Care
              </Link>
              <Link
                href="/#events"
                className="rounded-lg px-3 py-2 text-[#6b7280] hover:text-[#111827]"
              >
                Events &amp; Education
              </Link>
              <Link
                href="/#membership"
                className="rounded-lg px-3 py-2 text-[#6b7280] hover:text-[#111827]"
              >
                Membership
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-[#6b7280] hover:text-[#111827] sm:hidden"
              >
                Sign In
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Page Heading ── */}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl md:text-4xl">
          Find Healthcare Professionals
        </h1>

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
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Category Pills ── */}
        <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => (
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
            {filteredProviders.length > 0 ? (
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
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[#6b7280] sm:px-6">
          &copy; {new Date().getFullYear()} HealthGig. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
