import Link from 'next/link'
import { Info, Lock } from 'lucide-react'
import type { ProviderState } from '@/lib/listings/data'

export type PublishGate =
  | { kind: 'ok' }
  | { kind: 'not_approved' }
  | { kind: 'hold'; reason: string }
  | { kind: 'agreement' }

export function publishGate(state: ProviderState): PublishGate {
  if (!state.isApproved) return { kind: 'not_approved' }
  if (state.complianceHoldReason) {
    return { kind: 'hold', reason: state.complianceHoldReason }
  }
  if (!state.hasAgreement) return { kind: 'agreement' }
  return { kind: 'ok' }
}

/** Why the provider can't submit listings yet (renders nothing when they can). */
export function PublishGateNotice({ gate }: { gate: PublishGate }) {
  if (gate.kind === 'ok') return null
  if (gate.kind === 'agreement') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[#bcebd5] bg-[#e8faf1] p-3 text-sm text-[#0f5f3c]">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <Link href="/go-live" className="font-semibold underline">
            Accept the provider agreement to publish your first listing
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#e4e5e7] bg-[#f7f7f7] p-3 text-sm text-[#404145]">
      <Lock className="mt-0.5 size-4 shrink-0 text-[#62646a]" aria-hidden="true" />
      <p>
        {gate.kind === 'not_approved'
          ? 'You can publish once your application is approved. Until then you can build and save listings as drafts.'
          : `Your account is on hold, so listings can't be submitted right now: ${gate.reason}`}
      </p>
    </div>
  )
}
