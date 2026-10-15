'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PRIMARY_BTN } from '@/app/onboarding/professional/ui'
import {
  trackQuestionAnswered,
  trackQuestionSkipped,
  trackQuestionViewed,
} from '@/components/auth/signup-tracking'

/** What a screen's save returns; matches the onboarding server actions' result. */
export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

/**
 * One screen of a single-question flow (onboarding, the dashboard's Finish
 * your profile items, listings): a single question (two at most).
 * `validate` runs before leaving; `save` persists the answer so a refresh
 * resumes here. `fields` names what the screen owns, so a server error on a
 * whole-step save can jump back to the right screen.
 */
export interface Screen {
  id: string
  /** Step the screen belongs to (a key of `stepWeights`); drives the progress bar. Defaults to the first step. */
  step?: number
  /** Small label above the bar (detailed chrome only). */
  section?: string
  title: string
  sub?: string
  /** Small gray "why we ask" line under the question (licenses, ID, disclosures). */
  whyWeAsk?: string
  optional?: boolean
  fields?: string[]
  validate?: () => Record<string, string>
  /**
   * Keeps Continue disabled until the answer is valid (Single-Question
   * Onboarding spec). Without it, Continue is always enabled and `validate`
   * explains what's missing.
   */
  canContinue?: () => boolean
  save?: () => Promise<ActionResult>
  continueLabel?: string
  /**
   * Single-select screens that advance on tap (they call `advance()` from
   * render). Hides the Continue button unless an answer is already chosen
   * and the person came back to change it.
   */
  autoAdvance?: boolean
  /**
   * Shows "Skip for now". `onSkip` records the skip (it becomes a Finish your
   * profile item) and the flow moves on without running validate/save.
   * `skipKind: 'upload'` tags the analytics event so upload skips can be counted.
   */
  skippable?: boolean
  onSkip?: () => Promise<ActionResult> | void
  skipKind?: 'upload'
  /**
   * How many questions this screen stands for in the progress count
   * (default 1). A "set it up now?" screen not answered "now" counts its
   * hidden follow-ups too, so picking "now" never moves the bar backwards.
   */
  weight?: number
  render: (ctx: { errors: Record<string, string>; advance: () => void }) => React.ReactNode
}

/** Organization onboarding: steps 2–5 and their share of the progress bar. */
export const ORG_STEP_WEIGHTS: Record<number, number> = { 2: 0.3, 3: 0.4, 4: 0.1, 5: 0.2 }

/** One step owning the whole bar: progress is a plain count of the screens shown. */
export const SINGLE_STEP: Record<number, number> = { 1: 1 }

export function QuestionFlow({
  screens,
  initialIndex,
  onFinish,
  stepWeights = ORG_STEP_WEIGHTS,
  chrome = 'detailed',
  flowId,
  onExit,
}: {
  screens: Screen[]
  initialIndex: number
  onFinish: () => void
  /** Each step's share of the bar (sums to 1). One step = a plain question count. */
  stepWeights?: Record<number, number>
  /**
   * 'minimal' is the Single-Question Onboarding look: a thin bar and a back
   * arrow, no step names or numbers. 'detailed' adds section, step and
   * question counts (organization wizard, listings).
   */
  chrome?: 'detailed' | 'minimal'
  /** Turns on per-question analytics under this flow name (question ids and timings only). */
  flowId?: string
  /** Back arrow on the first screen (e.g. return to the signup door). Hidden when absent. */
  onExit?: () => void
}) {
  const stepOrder = Object.keys(stepWeights).map(Number).sort((a, b) => a - b)
  const stepOf = (s: Screen) => s.step ?? stepOrder[0]
  const [index, setIndex] = useState(initialIndex)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  // Bumped by single-choice answers; the effect advances after re-render so
  // validate/save see the new answer rather than a stale closure.
  const [advanceToken, setAdvanceToken] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(0)

  const i = Math.min(index, screens.length - 1)
  const screen = screens[i]
  const step = stepOf(screen)
  // Each step owns a fixed slice of the bar, so it never jumps backwards
  // when later questions appear (e.g. quick setup after picking goals).
  const inStep = screens.filter((s) => stepOf(s) === step)
  const w = (s: Screen) => s.weight ?? 1
  const stepTotal = inStep.reduce((n, s) => n + w(s), 0)
  const position = inStep.slice(0, inStep.indexOf(screen)).reduce((n, s) => n + w(s), 0) + 1
  const before = stepOrder.filter((s) => s < step).reduce((n, s) => n + stepWeights[s], 0)
  const pct = Math.round((before + stepWeights[step] * (position / stepTotal)) * 100)
  const [multiline, setMultiline] = useState(false)

  const elapsed = () => Math.max(0, Date.now() - shownAt.current)

  function go(nextIndex: number) {
    setErrors({})
    if (nextIndex >= screens.length) onFinish()
    else setIndex(nextIndex)
  }

  async function next() {
    if (saving) return
    if (screen.canContinue && !screen.canContinue()) return
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
    if (flowId) trackQuestionAnswered(flowId, screen.id, elapsed())
    go(i + 1)
  }

  async function skip() {
    if (saving) return
    if (screen.onSkip) {
      setSaving(true)
      const res = await screen.onSkip()
      setSaving(false)
      if (res && !res.ok) {
        toast.error(res.error)
        return
      }
    }
    if (flowId) trackQuestionSkipped(flowId, screen.id, elapsed(), screen.skipKind)
    go(i + 1)
  }

  function back() {
    setErrors({})
    if (i === 0) onExit?.()
    else setIndex(i - 1)
  }

  useEffect(() => {
    if (!advanceToken) return
    const t = setTimeout(() => void next(), 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceToken])

  // New screen: scroll up, start its timer, and put the cursor in the first
  // text field. Choice tiles aren't focused: the focus ring reads as
  // "already picked".
  useEffect(() => {
    window.scrollTo({ top: 0 })
    shownAt.current = Date.now()
    if (flowId) trackQuestionViewed(flowId, screens[i].id)
    const el = bodyRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([type=checkbox]):not([type=file]):not([type=radio]), textarea, select'
    )
    el?.focus({ preventScroll: true })
    setMultiline(!!bodyRef.current?.querySelector('textarea'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const showSaved = savedAt !== null && !saving
  const minimal = chrome === 'minimal'
  const blocked = screen.canContinue ? !screen.canContinue() : false
  const hideContinue = screen.autoAdvance && blocked
  const showBack = i > 0 || !!onExit

  return (
    <div className="mx-auto w-full max-w-xl">
      {minimal ? (
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={back}
              disabled={saving}
              aria-label="Back"
              className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-[#62646a] transition hover:bg-[#f1f1f2] hover:text-[#404145] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <span className="size-9 shrink-0" />
          )}
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-[#e4e5e7]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Progress"
          >
            <div className="h-full rounded-full bg-[#1dbf73] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-9 shrink-0" aria-hidden />
        </div>
      ) : (
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
            aria-label={`${screen.section ?? 'Progress'}: question ${position} of ${stepTotal}`}
          >
            <div className="h-full rounded-full bg-[#1dbf73] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#95979d]">
            {stepOrder.length > 1 && `Step ${stepOrder.indexOf(step) + 1} of ${stepOrder.length} · `}
            Question {position} of {stepTotal}
          </p>
        </div>
      )}

      {/* noValidate: screens validate themselves; the browser's checks would
          block e.g. a scheme-less "linkedin.com/in/name" in a type=url field. */}
      <form
        key={screen.id}
        noValidate
        className={`animate-in fade-in slide-in-from-right-4 duration-300 ${minimal ? 'mt-8 sm:mt-12' : 'mt-10'}`}
        onSubmit={(e) => {
          e.preventDefault()
          void next()
        }}
      >
        <h1
          className={`font-bold tracking-tight text-[#404145] ${
            minimal ? 'text-2xl sm:text-[2rem] sm:leading-tight' : 'text-2xl sm:text-3xl'
          }`}
        >
          {screen.title}
          {screen.optional && <span className="ml-2 align-middle text-sm font-medium text-[#95979d]">Optional</span>}
        </h1>
        {screen.sub && <p className="mt-2 text-base text-[#62646a]">{screen.sub}</p>}
        {screen.whyWeAsk && <p className="mt-2 text-xs text-[#95979d]">{screen.whyWeAsk}</p>}

        <div ref={bodyRef} className={`space-y-5 ${minimal ? 'mt-6' : 'mt-8'}`}>
          {screen.render({ errors, advance: () => setAdvanceToken((n) => n + 1) })}
        </div>

        {minimal ? (
          <div className="mt-8 space-y-3">
            {!hideContinue && (
              <Button
                type="submit"
                disabled={saving || blocked}
                className={`${PRIMARY_BTN} h-12 w-full text-base`}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {screen.continueLabel ?? 'Continue'}
              </Button>
            )}
            {screen.skippable && (
              <button
                type="button"
                onClick={() => void skip()}
                disabled={saving}
                className="mx-auto block rounded text-sm font-semibold text-[#62646a] underline-offset-4 hover:text-[#404145] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
              >
                Skip for now
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-10 flex items-center justify-between gap-3">
              {showBack ? (
                <Button type="button" variant="outline" onClick={back} disabled={saving} className="h-11 px-5">
                  <ArrowLeft className="mr-1.5 size-4" />
                  Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-4">
                {screen.skippable && (
                  <button
                    type="button"
                    onClick={() => void skip()}
                    disabled={saving}
                    className="text-sm font-semibold text-[#62646a] hover:text-[#404145] hover:underline"
                  >
                    Skip for now
                  </button>
                )}
                {!hideContinue && (
                  <Button type="submit" disabled={saving || blocked} className={`${PRIMARY_BTN} min-w-36 px-6`}>
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {screen.continueLabel ?? 'Continue'}
                  </Button>
                )}
              </div>
            </div>
            {!multiline && (
              <p className="mt-3 text-right text-xs text-[#95979d]">
                Press <kbd className="font-sans font-semibold">Enter</kbd> to continue
              </p>
            )}
          </>
        )}
      </form>
    </div>
  )
}
