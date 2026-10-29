import Link from 'next/link'
import { CheckCircle2, Circle, ExternalLink, Lock } from 'lucide-react'
import { CheckRow } from '@/app/onboarding/professional/ui'

/** Page frame for the go-live flow: logo, and a way out to the dashboard. */
export function Shell({ children, exit = true }: { children: React.ReactNode; exit?: boolean }) {
  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
            S
          </div>
          <span className="text-xl font-bold tracking-tight text-[#111827]">
            Sanus<span className="text-[#1dbf73]">.</span>
          </span>
        </Link>
        {exit && (
          <Link href="/dashboard" className="text-sm font-semibold text-[#62646a] hover:text-[#404145] hover:underline">
            Save and exit
          </Link>
        )}
      </div>
      <div className="mx-auto mt-8 w-full max-w-xl sm:mt-12">{children}</div>
    </div>
  )
}

/** Body of an agreement screen: plain-language summary, the full text, the checkbox. */
export function AgreementBody({
  summary,
  path,
  outdated,
  label,
  agreed,
  onAgree,
}: {
  summary: string[]
  path: string
  outdated?: boolean
  label: string
  agreed: boolean
  onAgree: (v: boolean) => void
}) {
  return (
    <>
      {outdated && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          We&apos;ve updated the agreement since you last accepted it. Please review and accept the current version.
        </p>
      )}
      <ul className="space-y-2.5">
        {summary.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-[#404145]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={path}
        target="_blank"
        className="inline-flex items-center gap-1 text-sm font-semibold text-[#0f8f56] hover:underline"
      >
        Read the full agreement
        <ExternalLink className="size-3.5" />
      </Link>
      <div className="rounded-xl border border-[#e4e5e7] bg-[#fafafa] p-4">
        <CheckRow id="go-live-agree" checked={agreed} onChange={onAgree} label={label} />
      </div>
    </>
  )
}

/** Payouts screen body: Stripe handles the sensitive details. */
export function PayoutsBody({ returnedUnfinished, note }: { returnedUnfinished: boolean; note: string }) {
  return (
    <>
      <p className="flex items-start gap-2 rounded-lg bg-[#fafafa] p-3 text-sm text-[#62646a]">
        <Lock className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" />
        <span>Bank info, date of birth, and SSN digits are collected and handled by Stripe. Sanus never sees them.</span>
      </p>
      {returnedUnfinished && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Stripe is still finishing your setup, or needs a few more details. If you left anything unfinished, continue
          below. Otherwise check back shortly.
        </p>
      )}
      <p className="text-xs text-[#95979d]">{note}</p>
    </>
  )
}

/** One line of the done screen's summary. */
export function DoneRow({ done, label, detail }: { done: boolean; label: string; detail?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1dbf73]" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-[#c5c6c9]" />
      )}
      <div className="text-sm">
        <p className="font-semibold text-[#404145]">{label}</p>
        {detail && <p className="mt-0.5 text-[#62646a]">{detail}</p>}
      </div>
    </li>
  )
}
