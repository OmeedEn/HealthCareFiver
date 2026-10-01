import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  AlertCircle,
  UserRound,
} from 'lucide-react'

type ReviewState = 'in_progress' | 'approved' | 'needs_info' | 'not_approved'

function reviewState(status: string): ReviewState {
  if (status === 'approved') return 'approved'
  if (status === 'more_info_requested') return 'needs_info'
  if (status === 'rejected') return 'not_approved'
  return 'in_progress'
}

export function PendingScreen({
  firstName,
  verificationStatus,
}: {
  firstName: string
  verificationStatus: string
}) {
  const state = reviewState(verificationStatus)
  const name = firstName.trim()

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
          <Check className="size-8 text-[#1dbf73]" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#404145]">
          {state === 'approved'
            ? `You're approved${name ? `, ${name}` : ''}.`
            : `Thanks${name ? ` ${name}` : ''}, you're in the queue.`}
        </h1>
        {state === 'in_progress' && (
          <p className="mt-2 text-sm text-[#62646a]">
            We review every application within 24-48 hours. You&apos;ll get an
            email when you&apos;re approved.
          </p>
        )}
      </div>

      <ul className="mt-6 divide-y divide-[#e4e5e7] rounded-xl border border-[#e4e5e7]">
        <li className="flex items-center gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1dbf73] text-white">
            <Check className="size-4" />
          </div>
          <p className="flex-1 text-sm font-semibold text-[#404145]">Account created</p>
          <span className="text-xs font-medium text-[#0f8f56]">Done</span>
        </li>
        <li className="flex items-center gap-3 p-4">
          {state === 'approved' ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1dbf73] text-white">
              <Check className="size-4" />
            </div>
          ) : state === 'in_progress' ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fff6e5] text-[#b7791f]">
              <Clock className="size-4" />
            </div>
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fdecec] text-[#c0392b]">
              <AlertCircle className="size-4" />
            </div>
          )}
          <p className="flex-1 text-sm font-semibold text-[#404145]">Credential review</p>
          <span
            className={`text-xs font-medium ${
              state === 'approved'
                ? 'text-[#0f8f56]'
                : state === 'in_progress'
                  ? 'text-[#b7791f]'
                  : 'text-[#c0392b]'
            }`}
          >
            {state === 'approved'
              ? 'Approved'
              : state === 'in_progress'
                ? 'In progress'
                : state === 'needs_info'
                  ? 'More info needed'
                  : 'Not approved'}
          </span>
        </li>
      </ul>

      {state === 'approved' && (
        <Link
          href="/go-live"
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-semibold text-white transition hover:bg-[#19a463]"
        >
          Go live on Sanus
          <ArrowRight className="ml-2 size-4" />
        </Link>
      )}
      {state === 'needs_info' && (
        <Link
          href="/contractor/credentials"
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-semibold text-white transition hover:bg-[#19a463]"
        >
          See what our team needs
          <ArrowRight className="ml-2 size-4" />
        </Link>
      )}

      <div className="mt-6 space-y-3">
        <Link
          href="/contractor/profile/edit"
          className="flex items-center gap-3 rounded-xl border border-[#e4e5e7] p-4 transition hover:border-[#bcebd5] hover:bg-[#fafefb]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f7f7] text-[#62646a]">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#404145]">Complete my profile</p>
            <p className="mt-0.5 text-xs text-[#62646a]">Bio, headshot, languages</p>
          </div>
          <ArrowRight className="size-4 text-[#95979d]" />
        </Link>
        <Link
          href="/contractor/profile"
          className="flex items-center gap-3 rounded-xl border border-[#e4e5e7] p-4 transition hover:border-[#bcebd5] hover:bg-[#fafefb]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f7f7] text-[#62646a]">
            <Eye className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#404145]">Preview my profile</p>
            <p className="mt-0.5 text-xs text-[#62646a]">See what clients will see</p>
          </div>
          <ArrowRight className="size-4 text-[#95979d]" />
        </Link>
      </div>
    </div>
  )
}
