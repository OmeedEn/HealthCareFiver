import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import {
  BadgeCheck,
  Eye,
  Globe,
  Languages,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import {
  getDemoPublicProfile,
  getPublicProfile,
  type PublicProfileResult,
} from '@/lib/find-care/profile'
import { ListingCard } from '@/components/listings/listing-card'
import { ListingStatusBadge } from '@/components/listings/listing-badges'
import { NavAuth } from '@/components/marketing/nav-auth'

type Props = { params: Promise<{ id: string }> }

async function viewerId(): Promise<string | null> {
  try {
    const { currentUser } = await import('@/lib/auth/roles')
    // currentUser() returns null unless the session completed MFA (AAL2).
    return (await currentUser())?.id ?? null
  } catch {
    return null
  }
}

// Deduped between generateMetadata and the page within one request.
const load = cache(async (id: string): Promise<PublicProfileResult | null> => {
  if (isDemoMode()) return getDemoPublicProfile(id)
  return getPublicProfile(id, await viewerId())
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection()
  const { id } = await params
  const data = await load(id)
  if (!data) return { title: 'Profile not found — Sanus' }
  const name = `${data.profile.first_name} ${data.profile.last_name}`.trim()
  return {
    title: `${name} — Sanus`,
    description: data.profile.headline ?? undefined,
    // Owner previews of not-yet-public profiles must never be indexed.
    robots: data.isPublic ? undefined : { index: false, follow: false },
  }
}

export default async function ProProfilePage({ params }: Props) {
  // Visibility depends on live verification state — render per request.
  await connection()
  const { id } = await params
  const data = await load(id)
  if (!data) notFound()

  const { profile: p, offerings, unpublished, isPublic, isOwner } = data
  const name = `${p.first_name} ${p.last_name}`.trim()
  const initials =
    `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase() || '?'
  const location = [p.city, p.state].filter(Boolean).join(', ')
  const role = p.otherProfession ?? p.categoryLabel

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              Sanus<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/find-care"
              className="hidden text-sm font-medium text-[#6b7280] hover:text-[#111827] sm:block"
            >
              Find care
            </Link>
            <NavAuth>
              <Link
                href="/login"
                className="text-sm font-medium text-[#6b7280] hover:text-[#111827]"
              >
                Sign In
              </Link>
            </NavAuth>
          </div>
        </div>
      </header>

      {isOwner && (
        <div className="border-b border-[#f5deb3] bg-[#fdf6e3]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-[#6b5208] sm:px-6">
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 font-medium">
              {isPublic
                ? 'This is your public profile — clients see exactly this.'
                : "Preview — this is how clients will see your profile. It's not public yet."}
            </p>
            <Link href="/contractor/profile/edit" className="font-semibold underline">
              Edit profile
            </Link>
            <Link href="/contractor/listings" className="font-semibold underline">
              Manage listings
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
              <img
                src={p.avatar_url}
                alt={name}
                className="size-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-2xl font-bold text-[#0f8f56]">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[#111827]">{name}</h1>
                {p.credential && (
                  <span className="rounded-full bg-[#e8faf1] px-2.5 py-0.5 text-xs font-semibold text-[#0f4c3a]">
                    {p.credential}
                  </span>
                )}
              </div>
              {p.headline && (
                <p className="mt-1 text-[#374151]">{p.headline}</p>
              )}
              {role && <p className="mt-0.5 text-sm text-[#6b7280]">{role}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e8faf1] px-2.5 py-1 text-xs font-semibold text-[#0f8f56]">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    Verified
                  </span>
                )}
                {p.insured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6ff] px-2.5 py-1 text-xs font-semibold text-[#1e5aa8]">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Insured
                  </span>
                )}
                {p.total_reviews > 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm text-[#374151]">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    <span className="font-semibold">{p.average_rating.toFixed(1)}</span>
                    <span className="text-[#6b7280]">
                      ({p.total_reviews} review{p.total_reviews === 1 ? '' : 's'})
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-[#6b7280]">New on Sanus</span>
                )}
              </div>

              <dl className="mt-4 grid gap-2 text-sm text-[#374151] sm:grid-cols-2">
                {location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-[#9ca3af]" aria-hidden="true" />
                    <dt className="sr-only">Location</dt>
                    <dd>{location}</dd>
                  </div>
                )}
                {p.yearsOfExperience != null && p.yearsOfExperience > 0 && (
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-[#9ca3af]" aria-hidden="true" />
                    <dt className="sr-only">Experience</dt>
                    <dd>
                      {p.yearsOfExperience} year{p.yearsOfExperience === 1 ? '' : 's'} of
                      experience
                    </dd>
                  </div>
                )}
                {p.languages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Languages className="size-4 text-[#9ca3af]" aria-hidden="true" />
                    <dt className="sr-only">Languages</dt>
                    <dd>{p.languages.join(', ')}</dd>
                  </div>
                )}
                {p.telehealthStates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-[#9ca3af]" aria-hidden="true" />
                    <dt className="sr-only">Telehealth states</dt>
                    <dd>Telehealth in {p.telehealthStates.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>

        {(p.bio || p.specialties.length > 0) && (
          <section className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
            {p.bio && (
              <>
                <h2 className="text-lg font-semibold text-[#111827]">About</h2>
                <p className="mt-2 whitespace-pre-line text-[#374151]">{p.bio}</p>
              </>
            )}
            {p.specialties.length > 0 && (
              <div className={p.bio ? 'mt-5' : ''}>
                <h2 className="text-sm font-semibold text-[#111827]">Specialties</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-[#f3f4f6] px-2.5 py-1 text-sm text-[#374151]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#111827]">
            Services, consulting &amp; events
          </h2>
          {offerings.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
              No bookable listings yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {offerings.map((o) => (
                <ListingCard
                  key={o.id}
                  listing={o}
                  footer={
                    isOwner ? null : (
                      <Link
                        href="/signup"
                        className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#1dbf73] text-sm font-semibold text-[#1dbf73] transition hover:bg-[#1dbf73] hover:text-white"
                      >
                        {o.kind === 'event' ? 'Sign up to register' : 'Sign up to book'}
                      </Link>
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        {isOwner && unpublished.length > 0 && (
          <section className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#111827]">
              Not shown to clients yet
            </h2>
            <p className="mt-0.5 text-xs text-[#6b7280]">
              Only you can see this list.
            </p>
            <ul className="mt-3 space-y-2">
              {unpublished.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-[#374151]">{u.title}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <ListingStatusBadge status={u.status} />
                    <Link
                      href={`/contractor/listings/${u.id}/review`}
                      className="font-medium text-[#1dbf73] hover:underline"
                    >
                      Review
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
