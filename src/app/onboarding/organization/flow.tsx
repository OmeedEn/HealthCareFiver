'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PRIMARY_BTN } from '../professional/ui'
import type { ActionResult } from './actions'

/**
 * One screen of the organization wizard: a single question (two at most).
 * `validate` runs before leaving; `save` persists the answer so a refresh
 * resumes here. `fields` names what the screen owns, so a server error on a
 * whole-step save can jump back to the right screen.
 */
export interface Screen {
  id: string
  /** Wizard step (2–5) the screen belongs to; drives the progress bar. */
  step: 2 | 3 | 4 | 5
  section: string
  title: string
  sub?: string
  optional?: boolean
  fields?: string[]
  validate?: () => Record<string, string>
  save?: () => Promise<ActionResult>
  continueLabel?: string
  /**
   * How many questions this screen stands for in the progress count
   * (default 1). A "set it up now?" screen not answered "now" counts its
   * hidden follow-ups too, so picking "now" never moves the bar backwards.
   */
  weight?: number
  render: (ctx: { errors: Record<string, string>; advance: () => void }) => React.ReactNode
}

const STEP_ORDER = [2, 3, 4, 5] as const
const STEP_WEIGHT = { 2: 0.3, 3: 0.4, 4: 0.1, 5: 0.2 } as const

export function QuestionFlow({
  screens,
  initialIndex,
  onFinish,
}: {
  screens: Screen[]
  initialIndex: number
  onFinish: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  // Bumped by single-choice answers; the effect advances after re-render so
  // validate/save see the new answer rather than a stale closure.
  const [advanceToken, setAdvanceToken] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const i = Math.min(index, screens.length - 1)
  const screen = screens[i]
  // Each step owns a fixed slice of the bar, so it never jumps backwards
  // when later questions appear (e.g. quick setup after picking goals).
  const inStep = screens.filter((s) => s.step === screen.step)
  const w = (s: Screen) => s.weight ?? 1
  const stepTotal = inStep.reduce((n, s) => n + w(s), 0)
  const position = inStep.slice(0, inStep.indexOf(screen)).reduce((n, s) => n + w(s), 0) + 1
  const before = STEP_ORDER.filter((s) => s < screen.step).reduce((n, s) => n + STEP_WEIGHT[s], 0)
  const pct = Math.round((before + STEP_WEIGHT[screen.step] * (position / stepTotal)) * 100)
  const [multiline, setMultiline] = useState(false)

  async function next() {
    if (saving) return
    const errs = screen.validate?.() ?? {}
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    if (screen.save) {
      setSaving(true)
      const res = await screen.save()
      setSaving(false)
      if (!res.ok) {
        const fields = res.fields ?? {}
        const target = screens.findIndex((s) =>
          (s.fields ?? []).some((f) => Object.keys(fields).some((k) => k === f || k.startsWith(`${f}.`)))
        )
        if (target >= 0 && target !== i) setIndex(target)
        setErrors(fields)
        toast.error(res.error)
        return
      }
      setSavedAt(Date.now())
    }
    setErrors({})
    if (i === screens.length - 1) onFinish()
    else setIndex(i + 1)
  }

  function back() {
    setErrors({})
    setIndex(Math.max(0, i - 1))
  }

  useEffect(() => {
    if (!advanceToken) return
    const t = setTimeout(() => void next(), 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceToken])

  // New screen: scroll up and put the cursor in the first text field.
  // Choice tiles aren't focused: the focus ring reads as "already picked".
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const el = bodyRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([type=checkbox]):not([type=file]), textarea, select'
    )
    el?.focus({ preventScroll: true })
    setMultiline(!!bodyRef.current?.querySelector('textarea'))
  }, [i])

  const showSaved = savedAt !== null && !saving

  return (
    <div className="mx-auto w-full max-w-xl">
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
          <span className="font-semibold uppercase tracking-wide text-[#1dbf73]">{screen.section}</span>
          <span className="flex items-center gap-3">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving
              </span>
            ) : showSaved ? (
              <span className="inline-flex items-center gap-1 text-[#0f8f56]">
                <Check className="size-3" /> Saved
              </span>
            ) : null}
            <span>{pct}%</span>
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e4e5e7]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${screen.section}: question ${position} of ${stepTotal}`}
        >
          <div className="h-full rounded-full bg-[#1dbf73] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-[#95979d]">
          Step {STEP_ORDER.indexOf(screen.step) + 1} of {STEP_ORDER.length} · Question {position} of {stepTotal}
        </p>
      </div>

      <form
        key={screen.id}
        className="mt-10 animate-in fade-in slide-in-from-right-4 duration-300"
        onSubmit={(e) => {
          e.preventDefault()
          void next()
        }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-[#404145] sm:text-3xl">
          {screen.title}
          {screen.optional && <span className="ml-2 align-middle text-sm font-medium text-[#95979d]">Optional</span>}
        </h1>
        {screen.sub && <p className="mt-2 text-base text-[#62646a]">{screen.sub}</p>}

        <div ref={bodyRef} className="mt-8 space-y-5">
          {screen.render({ errors, advance: () => setAdvanceToken((n) => n + 1) })}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          {i > 0 ? (
            <Button type="button" variant="outline" onClick={back} disabled={saving} className="h-11 px-5">
              <ArrowLeft className="mr-1.5 size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={saving} className={`${PRIMARY_BTN} min-w-36 px-6`}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {screen.continueLabel ?? 'Continue'}
          </Button>
        </div>
        {!multiline && (
          <p className="mt-3 text-right text-xs text-[#95979d]">
            Press <kbd className="font-sans font-semibold">Enter</kbd> to continue
          </p>
        )}
      </form>
    </div>
  )
}
