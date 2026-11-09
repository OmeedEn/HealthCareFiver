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
      className="flex flex-col gap-2 sm:flex-row sm:gap-0"
    >
      <label htmlFor="hero-search" className="sr-only">
        Search healthcare professionals
      </label>
      <div className="flex h-14 flex-1 items-center gap-3 rounded-md border-2 border-ink bg-surface px-4 transition-colors focus-within:border-brand sm:rounded-r-none sm:border-r-0">
        <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "ICU nurse", "CNA night shift", or "respiratory therapist"'
          className="h-full flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint outline-none"
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-14 items-center justify-center rounded-md bg-ink px-7 text-sm font-semibold text-paper transition-colors hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:rounded-l-none"
      >
        Search
      </button>
    </form>
  )
}
