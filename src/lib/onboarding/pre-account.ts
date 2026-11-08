'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Answers given before the account exists (Single-Question Onboarding spec):
 * held in this browser tab only — sessionStorage, never sent to the server —
 * until the account screen sends them with the signup request (or the Google
 * path hands them to its account step). A refresh keeps them; closing the
 * tab drops them. Storage can be unavailable (private mode, blocked site
 * data), so every access is guarded and the flow still works from memory.
 */

const PREFIX = 'sanus:onboarding:'

function read<T>(key: string): Partial<T> | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as Partial<T>) : null
  } catch {
    return null
  }
}

function write<T>(key: string, value: T) {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: answers stay in memory for this page.
  }
}

export function clearPreAccountAnswers(key: string) {
  try {
    window.sessionStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

/** Drop every pre-account answer in this tab (all paths, the routing answers too). */
export function clearAllPreAccountAnswers() {
  try {
    const store = window.sessionStorage
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => store.removeItem(k))
  } catch {
    // ignore
  }
}

let documentResumeUsed = false

/**
 * Should /signup pick up the answers stored in this tab? Only when this
 * page itself was reloaded (or reached with the browser's Back / Forward,
 * e.g. back from Google's sign-in screen), and only for the first signup
 * flow shown in this document. Every other arrival (a "Join Sanus" link,
 * a typed URL, a client-side navigation later on) starts fresh.
 *
 * Call once per mount and keep the result (a ref): it's consumed.
 */
export function consumeResumeOnLoad(): boolean {
  if (documentResumeUsed) return false
  documentResumeUsed = true
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (!nav || (nav.type !== 'reload' && nav.type !== 'back_forward')) return false
    // The document was loaded at this page (not reloaded elsewhere, then navigated here).
    return new URL(nav.name).pathname === window.location.pathname
  } catch {
    return false
  }
}

/**
 * useState that mirrors to sessionStorage under `key`. `hydrated` turns true
 * after the stored answers are loaded (first client render uses `initial`,
 * so server and client markup match); compute the resume screen after that.
 */
export function usePreAccountAnswers<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)
  const initialRef = useRef(initial)

  useEffect(() => {
    const stored = read<T>(key)
    if (stored) setValue({ ...initialRef.current, ...stored })
    setHydrated(true)
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        write(key, v)
        return v
      })
    },
    [key]
  )

  const clear = useCallback(() => clearPreAccountAnswers(key), [key])

  return [value, update, { hydrated, clear }] as const
}
