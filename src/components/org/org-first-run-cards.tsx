'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ORG_INTENTS, type OrgIntent } from '@/lib/onboarding/organization'
import { ORG_INTENT_ICONS } from '@/components/onboarding/choice-icons'
import { recordOrgIntent } from '@/app/onboarding/organization/actions'

/**
 * "What do you want to do first?" (Single-Question Onboarding spec): four
 * cards, the door's usual picks highlighted. Each opens the matching setup
 * and records the intent. Every account can use all four.
 */
export function OrgFirstRunCards({
  highlighted,
  hrefs,
}: {
  highlighted: OrgIntent[]
  /** Where each card goes; null = not available yet (shown as coming soon). */
  hrefs: Record<OrgIntent, string | null>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<OrgIntent | null>(null)

  async function open(intent: OrgIntent, href: string) {
    setBusy(intent)
    // Remembering the intent is a nicety; never block the navigation on it.
    await recordOrgIntent(intent).catch(() => null)
    router.push(href)
  }

  return (
    <section aria-labelledby="first-run-title" className="space-y-3">
      <h2 id="first-run-title" className="text-base font-semibold text-[#404145]">
        What do you want to do first?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_INTENTS.map((o) => {
          const href = hrefs[o.key]
          const Icon = ORG_INTENT_ICONS[o.key]
          const on = highlighted.includes(o.key)
          return (
            <button
              key={o.key}
              type="button"
              disabled={!href || busy !== null}
              onClick={() => href && void open(o.key, href)}
              className={`flex items-start gap-3 rounded-xl border-2 bg-white p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73] disabled:cursor-not-allowed ${
                on ? 'border-[#1dbf73] bg-[#f3fcf7]' : 'border-[#e4e5e7] hover:border-[#bcebd5]'
              } ${!href ? 'opacity-60' : ''}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-[#1dbf73]">
                {busy === o.key ? <Loader2 className="size-5 animate-spin" /> : Icon ? <Icon className="size-5" aria-hidden /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#404145]">{o.label}</span>
                <span className="mt-0.5 block text-xs text-[#62646a]">{href ? o.sub : 'Coming soon.'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
