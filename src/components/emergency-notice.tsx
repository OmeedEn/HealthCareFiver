import { Phone } from 'lucide-react'

/** Exact copy from the Single-Question Onboarding spec (client flow, results, site footer). */
export const EMERGENCY_TEXT =
  "Sanus isn't for emergencies. If this is an emergency, call 911. If you're in a mental health crisis, call or text 988."

/**
 * The 911 / 988 line. `boxed` is the in-flow notice (client "How soon"
 * screen, results); `inline` is a single muted line for footers.
 */
export function EmergencyNotice({ variant = 'boxed' }: { variant?: 'boxed' | 'inline' }) {
  const body = (
    <>
      Sanus isn&apos;t for emergencies. If this is an emergency, call{' '}
      <a href="tel:911" className="font-semibold underline underline-offset-2">
        911
      </a>
      . If you&apos;re in a mental health crisis, call or text{' '}
      <a href="tel:988" className="font-semibold underline underline-offset-2">
        988
      </a>
      .
    </>
  )
  if (variant === 'inline') return <p className="text-xs text-[#5f5d57]">{body}</p>
  return (
    <div role="note" className="flex gap-2.5 rounded-lg border border-[#ecd3a3] bg-[#fbf0dc] p-3 text-sm text-[#8a5a00]">
      <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{body}</p>
    </div>
  )
}
