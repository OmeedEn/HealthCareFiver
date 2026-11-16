import Link from 'next/link'
import { EyeOff, SearchX } from 'lucide-react'

/**
 * Shown instead of a generic "not found" when a profile link can't be opened.
 * 'unpublished': the professional exists but isn't published on Ocora right
 * now (we never say why — review state is private). 'missing': stale link.
 */
export function ProfileGate({
  kind,
  backHref,
  backLabel,
}: {
  kind: 'unpublished' | 'missing'
  backHref: string
  backLabel: string
}) {
  const Icon = kind === 'unpublished' ? EyeOff : SearchX
  return (
    <section
      role="status"
      aria-labelledby="profile-gate-title"
      className="mx-auto max-w-lg rounded-2xl border border-dashed border-[#cbc6ba] bg-white px-6 py-12 text-center"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eeebe4]">
        <Icon className="size-6 text-[#5f5d57]" aria-hidden="true" />
      </div>
      <h1 id="profile-gate-title" className="mt-4 text-lg font-semibold text-[#1a1a17]">
        {kind === 'unpublished'
          ? 'This profile isn’t published on Ocora right now'
          : 'This profile link is no longer valid'}
      </h1>
      <p className="mt-2 text-sm text-[#5f5d57]">
        {kind === 'unpublished'
          ? 'Profiles become visible only after Ocora approves the professional and they publish. It can’t be viewed, contacted or booked until then.'
          : 'The profile may have been removed, or the link is incomplete. Search again to find professionals who are published on Ocora.'}
      </p>
      <Link
        href={backHref}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#2f3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#2330c8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3cf5]"
      >
        {backLabel}
      </Link>
    </section>
  )
}
