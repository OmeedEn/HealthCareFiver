'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    const target = trimmed
      ? `/find-care?q=${encodeURIComponent(trimmed)}`
      : '/find-care'
    router.push(target)
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="rounded-2xl bg-white p-2 shadow-xl shadow-black/10"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-h-12 flex-1 items-center gap-3 px-4">
          <Search
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-[#6b7280]"
          />
          <label htmlFor="hero-search" className="sr-only">
            Search healthcare professionals
          </label>
          <input
            id="hero-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "ICU nurse", "CNA night shift", or "respiratory therapist"'
            className="h-full flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none sm:text-base"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1dbf73] px-6 text-sm font-semibold text-white transition hover:bg-[#19a463] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73] focus-visible:ring-offset-2"
        >
          Search
        </button>
      </div>
    </form>
  )
}
