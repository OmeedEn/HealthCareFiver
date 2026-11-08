'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Megaphone, Search } from 'lucide-react'
import { OrgListingCard, OrgListingCta } from '@/components/orgs/org-listing-card'
import type { PublicOrgListingWithOrg } from '@/lib/orgs/public'

const KINDS = [
  { value: 'all', label: 'All' },
  { value: 'service', label: 'Services', icon: Megaphone },
  { value: 'event', label: 'Events & training', icon: CalendarDays },
] as const

/** Find care → "Services & events": organizations' live listings. */
export function OrgListingsPanel({
  listings,
  signedIn,
  initialQuery = '',
  onlyKind,
}: {
  listings: PublicOrgListingWithOrg[]
  signedIn: boolean
  initialQuery?: string
  /** Lock to one kind and hide the kind filter (e.g. the Events page). */
  onlyKind?: 'service' | 'event'
}) {
  const [query, setQuery] = useState(initialQuery)
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>(onlyKind ?? 'all')

  const shown = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return listings.filter((l) => {
      if (kind !== 'all' && l.kind !== kind) return false
      const hay = [l.title, l.description, l.org.name, l.org.city, l.locations].filter(Boolean).join(' ').toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [listings, query, kind])

  return (
    <div className="mt-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#706d65]" />
        <label htmlFor="org-listing-search" className="sr-only">
          Search services and events
        </label>
        <input
          id="org-listing-search"
          type="search"
                    placeholder={onlyKind === 'event' ? 'Search events or organizations...' : 'Search services, events, or organizations...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 w-full rounded-xl border border-[#e3dfd6] bg-white pl-12 pr-4 text-base text-[#1a1a17] placeholder-[#706d65] shadow-sm outline-none transition focus:border-[#2f3cf5] focus:ring-2 focus:ring-[#2f3cf5]/20"
        />
      </div>

      <div className={onlyKind ? 'hidden' : 'mt-4 flex flex-wrap gap-2'}>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            aria-pressed={kind === k.value}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f3cf5] focus-visible:ring-offset-2 ${
              kind === k.value
                ? 'bg-[#1a1a17] text-white'
                : 'border border-[#e3dfd6] bg-white text-[#3a3934] hover:border-[#2f3cf5] hover:text-[#2f3cf5]'
            }`}
          >
            {'icon' in k && <k.icon className="size-4" aria-hidden="true" />}
            {k.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-[#5f5d57]">
        <span className="font-semibold text-[#1a1a17]">{shown.length}</span> listing{shown.length === 1 ? '' : 's'}
      </p>

      {listings.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#cbc6ba] bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-[#1a1a17]">
            {onlyKind === 'event' ? 'No upcoming events yet' : 'Services and events are coming soon'}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#5f5d57]">
            Verified organizations are setting up their services and events. Check back soon.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#cbc6ba] bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-[#1a1a17]">Nothing matches</h3>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setKind('all')
            }}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[#2f3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#2330c8]"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => (
            <OrgListingCard key={l.id} listing={l} showOrg hidePrice footer={<OrgListingCta listing={l} signedIn={signedIn} />} />
          ))}
        </div>
      )}
    </div>
  )
}
