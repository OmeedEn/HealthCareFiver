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
