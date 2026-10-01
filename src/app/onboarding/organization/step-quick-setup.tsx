'use client'

import { useState } from 'react'
import { Check, ChevronDown, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ORG_INTENTS, STAFFING_POSTS_ENABLED, type OrgIntent } from '@/lib/onboarding/organization'
import { PRIMARY_BTN, StepHeading } from '../professional/ui'
import { finishOnboarding } from './actions'
import { ServiceForm } from './sections/service-form'
import { EventForm } from './sections/event-form'
import { LookingForForm } from './sections/looking-for-form'
import { StaffingForm } from './sections/staffing-form'

type SectionState = { saved: number; skipped: boolean }

const DONE_COPY: Record<OrgIntent, (n: number) => string> = {
  advertise_services: (n) => `${n} service${n === 1 ? '' : 's'} saved as draft${n === 1 ? '' : 's'}`,
  host_events: (n) => `${n} event${n === 1 ? '' : 's'} saved as draft${n === 1 ? '' : 's'}`,
  find_professionals: () => 'Saved',
  post_needs: (n) => `${n} post${n === 1 ? '' : 's'} saved as draft${n === 1 ? '' : 's'}`,
}

/**
 * Step 5. Only the sections they picked in step 4, each skippable. Services,
 * events and staffing posts save as drafts — nothing publishes until the
 * organization is approved. "Submit for review" finishes onboarding.
 */
export function StepQuickSetup({
  intents,
  location,
  onBack,
  onDone,
}: {
  intents: OrgIntent[]
  location: { city: string; state: string; zip_code: string }
  onBack: () => void
  onDone: () => void
}) {
  const ordered = ORG_INTENTS.filter((i) => intents.includes(i.key))
  const [state, setState] = useState<Record<string, SectionState>>({})
  const [open, setOpen] = useState<OrgIntent | null>(ordered[0]?.key ?? null)
  const [submitting, setSubmitting] = useState(false)

  const mark = (key: OrgIntent, patch: Partial<SectionState>) => {
    setState((s) => ({ ...s, [key]: { ...(s[key] ?? { saved: 0, skipped: false }), ...patch } }))
  }
  const nextOpen = (key: OrgIntent) => {
    const i = ordered.findIndex((o) => o.key === key)
    setOpen(ordered[i + 1]?.key ?? null)
  }

  async function submit() {
    setSubmitting(true)
    const res = await finishOnboarding()
    if (!res.ok) {
      setSubmitting(false)
      toast.error(res.error)
      return
    }
    toast.success('Application submitted. We’ll email you within 24-48 hours.')
    onDone()
  }

  return (
    <div className="space-y-6">
      <StepHeading
        title="Quick setup"
        sub="Set up what you picked, or skip any of it and do it later from your dashboard. Nothing goes live until your organization is approved."
      />

      <div className="space-y-3">
        {ordered.map((intent) => {
          const s = state[intent.key]
          const isOpen = open === intent.key
          const staffingOff = intent.key === 'post_needs' && !STAFFING_POSTS_ENABLED
          return (
            <div key={intent.key} className="rounded-xl border border-[#e4e5e7] bg-white">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : intent.key)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                aria-expanded={isOpen}
              >
                <span>
                  <span className="block text-sm font-semibold text-[#404145]">{intent.label}</span>
                  <span className="block text-xs text-[#62646a]">
                    {s?.saved
                      ? DONE_COPY[intent.key](s.saved)
                      : s?.skipped
                        ? 'Skipped — set it up later from your dashboard'
                        : staffingOff
                          ? 'Coming soon'
                          : intent.sub}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {s?.saved ? <Check className="size-4 text-[#1dbf73]" /> : null}
                  <ChevronDown className={`size-4 text-[#95979d] transition ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#e4e5e7] p-4">
                  {intent.key === 'advertise_services' && (
                    <ServiceForm
                      onSaved={() => mark(intent.key, { saved: (s?.saved ?? 0) + 1, skipped: false })}
                      onSkip={() => {
                        mark(intent.key, { skipped: true })
                        nextOpen(intent.key)
                      }}
                    />
                  )}
                  {intent.key === 'host_events' && (
                    <EventForm
                      onSaved={() => mark(intent.key, { saved: (s?.saved ?? 0) + 1, skipped: false })}
                      onSkip={() => {
                        mark(intent.key, { skipped: true })
                        nextOpen(intent.key)
                      }}
                    />
                  )}
                  {intent.key === 'find_professionals' && (
                    <LookingForForm
                      onSaved={() => {
                        mark(intent.key, { saved: 1, skipped: false })
                        nextOpen(intent.key)
                      }}
                      onSkip={() => {
                        mark(intent.key, { skipped: true })
                        nextOpen(intent.key)
                      }}
                    />
                  )}
                  {intent.key === 'post_needs' &&
                    (staffingOff ? (
                      <div className="flex gap-2 text-sm text-[#62646a]">
                        <Clock className="mt-0.5 size-4 shrink-0" />
                        <p>
                          Posting urgent needs and staffing opportunities is coming soon. We&apos;ll let you
                          know as soon as it&apos;s available.
                        </p>
                      </div>
                    ) : (
                      <StaffingForm
                        defaults={location}
                        onSaved={() => mark(intent.key, { saved: (s?.saved ?? 0) + 1, skipped: false })}
                        onSkip={() => {
                          mark(intent.key, { skipped: true })
                          nextOpen(intent.key)
                        }}
                      />
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="h-11">
          Back
        </Button>
        <Button type="button" onClick={submit} disabled={submitting} className={PRIMARY_BTN}>
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Submit for review
        </Button>
      </div>
    </div>
  )
}
