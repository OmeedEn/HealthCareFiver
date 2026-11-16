'use client'

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContractorProfileCard } from '@/components/contractor/profile-card'
import { CONTRACTOR_TYPE_LABELS, US_STATES } from '@/lib/utils/constants'
import type { PublicProvider } from '@/lib/find-care/types'

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-[#e3dfd6] bg-white px-3 text-sm text-[#3a3934] outline-none focus:border-[#2f3cf5] focus:ring-2 focus:ring-[#2f3cf5]/20'

/** Client-side filtering over the server-provided discovery list. */
export function ContractorDirectory({
  providers,
  isDemo,
}: {
  providers: PublicProvider[]
  isDemo: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [contractorType, setContractorType] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [acceptingOnly, setAcceptingOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const activeCount = [contractorType, stateFilter, acceptingOnly ? 'x' : ''].filter(Boolean).length
  const hasQuery = activeCount > 0 || searchQuery.trim() !== ''

  const shown = useMemo(() => {
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    return providers.filter((p) => {
      if (contractorType && p.contractor_type !== contractorType) return false
      if (stateFilter && p.state !== stateFilter) return false
      if (acceptingOnly && !p.is_available) return false
      if (terms.length === 0) return true
      const hay = [
        p.first_name,
        p.last_name,
        p.credential,
        p.specialty,
        p.headline,
        p.bio ?? '',
        p.city ?? '',
        p.state ?? '',
        ...p.specialties,
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [providers, searchQuery, contractorType, stateFilter, acceptingOnly])

  function clearFilters() {
    setSearchQuery('')
    setContractorType('')
    setStateFilter('')
    setAcceptingOnly(false)
  }

  const stateLabel = US_STATES.find((s) => s.value === stateFilter)?.label

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a17]">Find professionals</h1>
        <p className="text-[#5f5d57]">
          Professionals approved by Ocora and published on the marketplace.
        </p>
        {isDemo && (
          <p className="mt-2 inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            Demo mode — these profiles are fictional sample data and can&apos;t be booked.
          </p>
        )}
      </div>

      <form
        role="search"
        aria-label="Search professionals"
        className="flex flex-wrap gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#706d65]"
            aria-hidden="true"
          />
          <label htmlFor="org-directory-search" className="sr-only">
            Search by name, specialty or location
          </label>
          <Input
            id="org-directory-search"
            type="search"
            placeholder="Search by name, specialty, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="org-directory-filters"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5">
              ({activeCount}
              <span className="sr-only"> active</span>)
            </span>
          )}
        </Button>
      </form>

      {showFilters && (
        <div id="org-directory-filters" className="space-y-4 rounded-lg border border-[#e3dfd6] p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="org-directory-profession" className="text-sm font-medium text-[#1a1a17]">
                Profession
              </label>
              <select
                id="org-directory-profession"
                value={contractorType}
                onChange={(e) => setContractorType(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">All professions</option>
                {Object.entries(CONTRACTOR_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="org-directory-state" className="text-sm font-medium text-[#1a1a17]">
                State
              </label>
              <select
                id="org-directory-state"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-[#1a1a17]">
                <input
                  type="checkbox"
                  checked={acceptingOnly}
                  onChange={(e) => setAcceptingOnly(e.target.checked)}
                  className="rounded"
                />
                Accepting clients only
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!hasQuery}>
              <X className="mr-1 h-4 w-4" aria-hidden="true" />
              Reset filters
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-[#5f5d57]" role="status" aria-live="polite" aria-atomic="true">
        <span className="font-semibold text-[#1a1a17]">{shown.length}</span> professional
        {shown.length === 1 ? '' : 's'}
        {hasQuery && providers.length > 0 ? ` match (of ${providers.length} on Ocora)` : ' on Ocora'}
      </p>

      {providers.length === 0 ? (
        <section
          role="status"
          className="rounded-2xl border border-dashed border-[#cbc6ba] bg-white px-6 py-12 text-center"
        >
          <h2 className="text-lg font-semibold text-[#1a1a17]">
            No professionals are published on Ocora yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#5f5d57]">
            Profiles appear here only after Ocora approves the professional and they publish. Check
            back soon.
          </p>
        </section>
      ) : shown.length === 0 ? (
        <section
          role="status"
          className="rounded-2xl border border-dashed border-[#cbc6ba] bg-white px-6 py-12 text-center"
        >
          <h2 className="text-lg font-semibold text-[#1a1a17]">
            No professionals match these filters
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#5f5d57]">
            {providers.length} professional{providers.length === 1 ? ' is' : 's are'} published on
            Ocora, but none match your search{stateLabel ? ` in ${stateLabel}` : ''}.
          </p>
          <Button type="button" className="mt-4" onClick={clearFilters}>
            Reset filters
          </Button>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Professionals">
          {shown.map((p) => (
            <li key={p.id}>
              <ContractorProfileCard
                contractor={{
                  id: p.id,
                  first_name: p.first_name,
                  last_name: p.last_name,
                  contractor_type: p.contractor_type,
                  specialties: p.specialties,
                  headline: p.headline || null,
                  bio: p.bio,
                  years_of_experience: null,
                  city: p.city,
                  state: p.state,
                  is_available: p.is_available,
                  average_rating: p.average_rating,
                  total_reviews: p.total_reviews,
                  avatar_url: p.avatar_url,
                }}
                hasPublicRates={p.has_public_rates}
                href={`/facility/contractors/${p.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
