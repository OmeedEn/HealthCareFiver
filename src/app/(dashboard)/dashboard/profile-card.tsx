import Link from 'next/link'
import {
  BadgeCheck,
  CalendarRange,
  CircleDollarSign,
  ExternalLink,
  Pencil,
} from 'lucide-react'

export type ProfileCardData = {
  firstName: string
  lastName: string
  avatarUrl: string | null
  headline: string | null
  verified: boolean
  /** /pros/[id] */
  publicHref: string
  /** What's filled in, for the completeness meter. */
  checks: { label: string; done: boolean; href: string }[]
}

type Row = Record<string, unknown> | null | undefined

const filled = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? v > 0 : typeof v === 'string' ? v.trim() !== '' : v != null

/** Completeness checklist from the contractor_profiles row + headshot. */
export function profileChecks(row: Row, avatarUrl: string | null) {
  const r = row ?? {}
  return [
    { label: 'Add a headshot', done: !!avatarUrl, href: '/contractor/profile/edit#basic' },
    { label: 'Add your name', done: filled(r.first_name) && filled(r.last_name), href: '/contractor/profile/edit#basic' },
    { label: 'Write a headline', done: filled(r.headline), href: '/contractor/profile/edit#basic' },
    { label: 'Add your city', done: filled(r.city) && filled(r.state), href: '/contractor/profile/edit#location' },
    { label: 'Add specialties', done: filled(r.specialties), href: '/contractor/profile/edit#experience' },
    { label: 'Add languages', done: filled(r.languages), href: '/contractor/profile/edit#experience' },
    { label: 'Add years of experience', done: filled(r.years_of_experience), href: '/contractor/profile/edit#experience' },
    { label: 'Write your bio', done: filled(r.bio), href: '/contractor/profile/edit#about' },
  ]
}

/**
 * Top of the professional dashboard: who you are on Sanus, how complete your
 * profile is, and the one obvious way to change it.
 */
export function ProfileCard({ data }: { data: ProfileCardData }) {
  const name = `${data.firstName} ${data.lastName}`.trim() || 'Your name'
  const initials =
    `${data.firstName[0] ?? ''}${data.lastName[0] ?? ''}`.toUpperCase() || '?'
  const done = data.checks.filter((c) => c.done).length
  const pct = data.checks.length ? Math.round((done / data.checks.length) * 100) : 100
  const next = data.checks.find((c) => !c.done)

  return (
    <section
      aria-label="Your profile"
      className="overflow-hidden rounded-2xl border border-[#c9cdfb] bg-gradient-to-br from-[#f4f5fe] via-white to-white shadow-sm"
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase storage host
            <img
              src={data.avatarUrl}
              alt=""
              className="size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:size-24"
            />
          ) : (
            <Link
              href="/contractor/profile/edit#basic"
              className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#eceefe] text-2xl font-bold text-[#2330c8] shadow-sm sm:size-24"
              aria-label="Add a headshot"
            >
              {initials}
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-[#2330c8] uppercase">
              Your public profile
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-[#1a1a17] sm:text-2xl">{name}</h2>
              {data.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2f3cf5] px-2 py-0.5 text-xs font-semibold text-white">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-[#5f5d57]">
              {data.headline || 'Add a headline so clients know what you do.'}
            </p>
            <div className="mt-3 max-w-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1a1a17]">Profile {pct}% complete</span>
                {next && (
                  <Link href={next.href} className="font-semibold text-[#2330c8] hover:underline">
                    Next: {next.label}
                  </Link>
                )}
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#e3dfd6]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div className="h-full rounded-full bg-[#2f3cf5]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:min-w-72">
          <Link
            href="/contractor/profile/edit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2f3cf5] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#2330c8] focus-visible:ring-4 focus-visible:ring-[#2f3cf5]/30 focus-visible:outline-none"
          >
            <Pencil className="size-5" aria-hidden="true" />
            Edit profile
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <SecondaryLink href={data.publicHref} icon={ExternalLink} title="View public profile">
              Public profile
            </SecondaryLink>
            <SecondaryLink href="/contractor/rates" icon={CircleDollarSign}>
              Rates
            </SecondaryLink>
            <SecondaryLink href="/contractor/availability" icon={CalendarRange}>
              Availability
            </SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function SecondaryLink({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#e3dfd6] bg-white px-2 text-xs font-semibold text-[#1a1a17] transition hover:border-[#2f3cf5] hover:text-[#2330c8] sm:text-sm"
      title={title}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </Link>
  )
}
