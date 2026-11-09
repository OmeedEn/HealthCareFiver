'use client'

// Client-side interactive pieces for the marketing pages. Everything here
// degrades to a static, fully readable render without JS and respects
// prefers-reduced-motion.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

/* ───────────── Credential explorer (hero) ───────────── */

// Illustrative kinds of expertise — not real people, ratings, or prices.
const credentials = [
  { code: 'RDN', name: 'Registered dietitian nutritionist', specialty: 'Nutrition & dietetics' },
  { code: 'MD', name: 'Physician', specialty: 'Physician consulting' },
  { code: 'NP', name: 'Nurse practitioner', specialty: 'Telehealth & second opinions' },
  { code: 'RN', name: 'Registered nurse', specialty: 'Nursing consulting' },
  { code: 'JD', name: 'Healthcare attorney', specialty: 'Healthcare legal' },
  { code: 'NBC-HWC', name: 'Board-certified health & wellness coach', specialty: 'Health & wellness coaching' },
  { code: 'CPT', name: 'Certified personal trainer', specialty: 'Personal & corporate training' },
  { code: 'CHC', name: 'Certified in healthcare compliance', specialty: 'HIPAA & compliance' },
  { code: 'CPC', name: 'Certified professional coder', specialty: 'Medical billing & coding' },
  { code: 'DPT', name: 'Physical therapist', specialty: 'Physical & occupational therapy' },
]

export function CredentialExplorer() {
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)
  const [hovering, setHovering] = useState(false)
  const reduced = usePrefersReducedMotion()
  const current = credentials[index]

  useEffect(() => {
    if (!auto || reduced || hovering) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % credentials.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [auto, reduced, hovering])

  // Size the giant code so long credentials still fit the measure.
  const len = current.code.length
  const size = `min(${(88 / (len * 0.56 + 0.4)).toFixed(1)}vw, ${len > 4 ? 11 : 17}rem)`

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-10"
    >
      <div className="lg:col-span-8">
        <p className="font-display text-lg font-medium text-ink-muted sm:text-xl">
          Book a reviewed
        </p>
        <div
          aria-hidden="true"
          className="relative -ml-[0.04em] flex h-[0.9em] items-end overflow-hidden"
          style={{ fontSize: size }}
        >
          <span
            key={current.code}
            className="type-condensed sanus-rise block text-brand"
          >
            {current.code}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-end lg:col-span-4 lg:pb-[1.2rem]">
        <div aria-live={auto ? 'off' : 'polite'} className="min-h-[7.5rem] border-t-2 border-ink pt-4">
          <p className="text-sm text-ink-muted">{current.code}</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
            {current.name}
          </p>
          <Link
            href={`/find-care?q=${encodeURIComponent(current.specialty)}`}
            className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink underline decoration-brand-line underline-offset-4 transition hover:decoration-brand"
          >
            Browse {current.specialty.toLowerCase()}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="lg:col-span-12">
        <p id="credential-picker-label" className="sr-only">
          Choose a credential to explore
        </p>
        <div
          role="group"
          aria-labelledby="credential-picker-label"
          className="flex flex-wrap gap-1.5"
        >
          {credentials.map((c, i) => {
            const active = i === index
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={active}
                aria-label={`${c.code}, ${c.name}`}
                onClick={() => {
                  setIndex(i)
                  setAuto(false)
                }}
                onFocus={() => setAuto(false)}
                className={cn(
                  'relative h-9 overflow-hidden rounded-md border px-3 font-display text-sm font-semibold tracking-wide transition-colors duration-200',
                  active
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line-strong bg-transparent text-ink-soft hover:border-ink hover:text-ink'
                )}
              >
                {c.code}
                {active && auto && !reduced && !hovering && (
                  <span
                    aria-hidden="true"
                    key={`p-${index}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand-on-ink"
                    style={{ animation: 'sanus-progress 2.6s linear both' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ───────────── Animated counter ───────────── */

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  duration = 1400,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight) return // already visible: no flash

    let frame = 0
    setDisplay(0)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 4)
          setDisplay(Math.round(value * eased))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.6 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">
        {prefix}
        {value}
        {suffix}
      </span>
      <span aria-hidden="true">
        {prefix}
        {display}
        {suffix}
      </span>
    </span>
  )
}

/* ───────────── Scroll reveal ───────────── */

/** Reveals its children once when scrolled into view. Use sparingly. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'shown' | 'hidden'>('shown')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return
    setState('hidden')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('shown')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal={state}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  )
}

/* ───────────── Category explorer ───────────── */

export type ExplorerTier = {
  id: string
  title: string
  short: string
  description: string
  categories: string[]
}

export function CategoryExplorer({ tiers }: { tiers: ExplorerTier[] }) {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tier = tiers[active]

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    }
    let next: number | null = null
    if (e.key in keys) next = (active + keys[e.key] + tiers.length) % tiers.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tiers.length - 1
    if (next === null) return
    e.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div
        role="tablist"
        aria-label="Kinds of professionals"
        aria-orientation="vertical"
        className="flex gap-2 overflow-x-auto pb-1 lg:col-span-5 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0"
      >
        {tiers.map((t, i) => {
          const selected = i === active
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`tier-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`tier-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
              className={cn(
                'group relative shrink-0 rounded-md border px-4 py-2.5 text-left transition-colors duration-300 lg:rounded-none lg:border-0 lg:border-t lg:px-0 lg:py-5 lg:last:border-b',
                selected
                  ? 'border-ink bg-ink text-paper lg:border-line-strong lg:bg-transparent lg:text-ink'
                  : 'border-line-strong text-ink-muted hover:text-ink lg:border-line-strong'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-1/2 hidden h-[60%] w-1 -translate-y-1/2 bg-brand transition-transform duration-500 ease-out-expo lg:block',
                  selected ? 'scale-y-100' : 'scale-y-0'
                )}
              />
              <span
                className={cn(
                  'block whitespace-nowrap text-sm font-semibold transition-transform duration-500 ease-out-expo lg:whitespace-normal lg:font-display lg:text-[clamp(1.5rem,2.6vw,2.25rem)] lg:font-semibold lg:leading-[1.05] lg:tracking-tight',
                  selected && 'lg:translate-x-5'
                )}
              >
                <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.title}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`tier-panel-${tier.id}`}
        aria-labelledby={`tier-tab-${tier.id}`}
        className="lg:col-span-7"
      >
        <div key={tier.id} className="sanus-rise rounded-2xl bg-surface p-6 shadow-lift ring-1 ring-line sm:p-9">
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
            {tier.description}
          </p>
          <ul className="mt-8 grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
            {tier.categories.map((c) => (
              <li key={c} className="border-b border-line">
                <Link
                  href={`/find-care?q=${encodeURIComponent(c)}`}
                  className="group flex items-center justify-between gap-3 py-3.5 text-[15px] font-medium text-ink transition-colors hover:text-brand-ink"
                >
                  {c}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
