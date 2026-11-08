import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import {
  BadgeCheck,
  BriefcaseMedical,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Camera,
  Car,
  CircleDollarSign,
  Clock,
  Eye,
  Globe,
  Images,
  Languages,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Star,
  Users,
  Video,
} from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import {
  getDemoPublicProfile,
  getPublicProfile,
  type AvailabilitySummary,
  type PublicProfileResult,
  type PublicReview,
} from '@/lib/find-care/profile'
import {
  KIND_LABELS,
  engagementLabel,
  eventTypeLabel,
  formatLabel,
} from '@/lib/listings/offering'
import type { PublicListing } from '@/components/listings/listing-card'
import { ListingStatusBadge } from '@/components/listings/listing-badges'
import { SiteHeader } from '@/components/marketing/site-header'
import { formatRateAmount, formatRateUnit, type ProfessionalRate } from '@/lib/rates/types'
import { MessageButton } from './message-button'
import { BookingRequestButton, PRIMARY_CTA } from './booking-request'
import { PhotoGallery } from './photo-gallery'

type Props = { params: Promise<{ id: string }> }

const viewer = cache(async (): Promise<{ id: string; role: string } | null> => {
  try {
    const { currentUser } = await import('@/lib/auth/roles')
    // currentUser() returns null unless the session completed MFA (AAL2).
    const u = await currentUser()
    return u ? { id: u.id, role: u.role } : null
  } catch {
    return null
  }
})

const ORG_ROLES = new Set(['facility', 'staffing_agency'])

// Deduped between generateMetadata and the page within one request.
const load = cache(async (id: string): Promise<PublicProfileResult | null> => {
  if (isDemoMode()) return getDemoPublicProfile(id)
  return getPublicProfile(id, (await viewer())?.id ?? null)
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

const SECONDARY_CTA =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cbc6ba] bg-white px-5 text-sm font-semibold text-[#1a1a17] transition hover:border-[#2f3cf5] hover:text-[#2330c8]'

/** Who's looking, and what they can do from here. */
type Cta = 'owner' | 'login' | 'client' | 'org' | 'none'

export default async function ProProfilePage({ params }: Props) {
  // Visibility depends on live verification state — render per request.
  await connection()
  const { id } = await params
  const data = await load(id)
  if (!data) notFound()

  const {
    profile: p,
    offerings,
    unpublished,
    rates,
    reviews,
    photos,
    availability,
    isPublic,
    isOwner,
  } = data
  const name = `${p.first_name} ${p.last_name}`.trim()
  const initials =
    `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase() || '?'
  const location = [p.city, p.state].filter(Boolean).join(', ')
  const role = p.otherProfession ?? p.categoryLabel
  const me = await viewer()
  const cta: Cta = isOwner
    ? 'owner'
    : !isPublic
      ? 'none'
      : isDemoMode()
        ? 'client'
        : !me
          ? 'login'
          : me.role === 'client'
            ? 'client'
            : ORG_ROLES.has(me.role)
              ? 'org'
              : 'none'
  const loginHref = `/login?redirectTo=${encodeURIComponent(`/pros/${p.id}`)}`
  const bookable = [
    ...new Set([...offerings.map((o) => o.title), ...(rates ?? []).map((r) => r.label)]),
  ].slice(0, 20)
  const firstName = p.first_name || 'this professional'

  const ctaBlock = (
    <CtaBlock
      cta={cta}
      proId={p.id}
      firstName={p.first_name}
      bookable={bookable}
      loginHref={loginHref}
    />
  )

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#1a1a17]">
      <SiteHeader />

      {isOwner && (
        <div className="border-b border-[#ecd3a3] bg-[#fbf0dc]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-[#8a5a00] sm:px-6">
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 font-medium">
              {isPublic
                ? 'This is your public profile — clients see exactly this.'
                : "Preview — this is how clients will see your profile. It's not public yet."}
            </p>
            <Link href="/contractor/profile/edit" className="font-semibold underline">
              Edit profile
            </Link>
            <Link href="/contractor/rates" className="font-semibold underline">
              Rates
            </Link>
            <Link href="/contractor/availability" className="font-semibold underline">
              Availability
            </Link>
            <Link href="/contractor/listings" className="font-semibold underline">
              Listings
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="overflow-hidden rounded-2xl border border-[#e3dfd6] bg-white">
          <div className="h-24 bg-gradient-to-r from-[#eceefe] via-[#f4f5fe] to-[#eceefe] sm:h-28" />
          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
                <img
                  src={p.avatar_url}
                  alt={name}
                  className="size-28 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:size-32"
                />
              ) : (
                <div className="flex size-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#eceefe] text-3xl font-bold text-[#2330c8] shadow-sm sm:size-32">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1 sm:pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[#1a1a17] sm:text-3xl">
                    {name}
                  </h1>
                  {p.credential && (
                    <span className="rounded-full bg-[#eceefe] px-2.5 py-0.5 text-xs font-semibold text-[#1a1a17]">
                      {p.credential}
                    </span>
                  )}
                  {p.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#2f3cf5] px-2.5 py-0.5 text-xs font-semibold text-white">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
                {role && <p className="mt-1 font-medium text-[#3a3934]">{role}</p>}
                {p.headline && <p className="mt-0.5 text-[#5f5d57]">{p.headline}</p>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#3a3934]">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-[#706d65]" aria-hidden="true" />
                  {location}
                </span>
              )}
              <RatingInline rating={p.average_rating} count={p.total_reviews} />
              {p.insured && (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#2330c8]" aria-hidden="true" />
                  Insured
                </span>
              )}
              {p.yearsOfExperience != null && p.yearsOfExperience > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseMedical className="size-4 text-[#706d65]" aria-hidden="true" />
                  {p.yearsOfExperience} year{p.yearsOfExperience === 1 ? '' : 's'} experience
                </span>
              )}
              {p.languages.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Languages className="size-4 text-[#706d65]" aria-hidden="true" />
                  {p.languages.join(', ')}
                </span>
              )}
              {p.telehealthStates.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="size-4 text-[#706d65]" aria-hidden="true" />
                  Telehealth in {p.telehealthStates.join(', ')}
                </span>
              )}
            </div>

            {/* Small screens: actions right under the hero. */}
            <div className="mt-6 lg:hidden">{ctaBlock}</div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {/* About */}
            <Card title="About" icon={BadgeCheck}>
              {p.bio ? (
                <p className="whitespace-pre-line leading-relaxed text-[#3a3934]">{p.bio}</p>
              ) : (
                <Empty>
                  {isOwner ? (
                    <>
                      Add a bio so clients know how you work.{' '}
                      <Link href="/contractor/profile/edit#about" className="font-semibold text-[#2330c8] underline">
                        Write your bio
                      </Link>
                    </>
                  ) : (
                    `${firstName} hasn't added a bio yet.`
                  )}
                </Empty>
              )}
              {p.specialties.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-[#1a1a17]">Specialties</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.specialties.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-[#eeebe4] px-3 py-1 text-sm text-[#3a3934]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Services */}
            <Card title="Services, consulting & events" icon={BriefcaseMedical}>
              {offerings.length === 0 ? (
                <Empty>
                  {isOwner ? (
                    <>
                      List what clients can book.{' '}
                      <Link href="/contractor/listings/new" className="font-semibold text-[#2330c8] underline">
                        Add a listing
                      </Link>
                    </>
                  ) : (
                    'No services listed yet. Send a message to ask what they offer.'
                  )}
                </Empty>
              ) : (
                <ul className="divide-y divide-[#f0f0f1]">
                  {offerings.map((o) => (
                    <OfferingRow key={o.id} listing={o} />
                  ))}
                </ul>
              )}
            </Card>

            {/* Photos */}
            {(photos.length > 0 || isOwner) && (
              <Card title="Photos" icon={Images}>
                {photos.length > 0 ? (
                  <PhotoGallery photos={photos} name={name} />
                ) : (
                  <Empty>
                    <Camera className="mx-auto mb-2 size-5 text-[#706d65]" aria-hidden="true" />
                    Show your practice, workspace, or work.{' '}
                    <Link href="/contractor/profile/edit#photos" className="font-semibold text-[#2330c8] underline">
                      Add photos
                    </Link>
                  </Empty>
                )}
              </Card>
            )}

            {/* Reviews */}
            <Card
              title="Reviews"
              icon={Star}
              aside={
                p.total_reviews > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Stars rating={p.average_rating} />
                    <span className="font-semibold text-[#1a1a17]">{p.average_rating.toFixed(1)}</span>
                    <span className="text-[#5f5d57]">({p.total_reviews})</span>
                  </span>
                ) : null
              }
            >
              {reviews.length === 0 ? (
                <Empty>
                  No reviews yet. Reviews appear here after completed work with clients
                  and organizations on Sanus.
                </Empty>
              ) : (
                <ul className="space-y-5">
                  {reviews.map((r) => (
                    <ReviewItem key={r.id} review={r} />
                  ))}
                </ul>
              )}
            </Card>

            {isOwner && unpublished.length > 0 && (
              <section className="rounded-2xl border border-dashed border-[#e3dfd6] bg-white p-5">
                <h2 className="text-sm font-semibold text-[#1a1a17]">
                  Not shown to clients yet
                </h2>
                <p className="mt-0.5 text-xs text-[#5f5d57]">
                  Only you can see this list.
                </p>
                <ul className="mt-3 space-y-2">
                  {unpublished.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-[#3a3934]">{u.title}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <ListingStatusBadge status={u.status} />
                        <Link
                          href={`/contractor/listings/${u.id}/review`}
                          className="font-medium text-[#2f3cf5] hover:underline"
                        >
                          Review
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="hidden rounded-2xl border border-[#e3dfd6] bg-white p-5 lg:block">
              {ctaBlock}
            </div>

            {rates && (rates.length > 0 || isOwner) && (
              <Card title="Rates" icon={CircleDollarSign} compact>
                {rates.length === 0 ? (
                  <Empty>
                    Clients see your prices here.{' '}
                    <Link href="/contractor/rates" className="font-semibold text-[#2330c8] underline">
                      Add your rates
                    </Link>
                  </Empty>
                ) : (
                  <RatesList rates={rates} />
                )}
              </Card>
            )}

            <Card title="Availability" icon={CalendarRange} compact>
              <AvailabilityBlock availability={availability} isOwner={isOwner} />
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}

/* ────────── Pieces ────────── */

function Card({
  title,
  icon: Icon,
  aside,
  compact,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  aside?: React.ReactNode
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border border-[#e3dfd6] bg-white ${compact ? 'p-5' : 'p-6'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1a1a17]">
          <Icon className="size-5 text-[#2f3cf5]" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[#e3dfd6] bg-[#f6f4ef] px-4 py-5 text-center text-sm text-[#5f5d57]">
      {children}
    </p>
  )
}

function CtaBlock({
  cta,
  proId,
  firstName,
  bookable,
  loginHref,
}: {
  cta: Cta
  proId: string
  firstName: string
  bookable: string[]
  loginHref: string
}) {
  const who = firstName || 'this professional'
  if (cta === 'owner') {
    return (
      <div className="space-y-2.5">
        <Link href="/contractor/profile/edit" className={`${PRIMARY_CTA} w-full`}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit profile
        </Link>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/contractor/rates" className={SECONDARY_CTA}>
            Rates
          </Link>
          <Link href="/contractor/availability" className={SECONDARY_CTA}>
            Availability
          </Link>
        </div>
      </div>
    )
  }
  if (cta === 'none') {
    return (
      <p className="text-sm text-[#5f5d57]">
        Booking and messaging are available to clients and organizations.
      </p>
    )
  }
  if (cta === 'login') {
    return (
      <div className="space-y-2.5">
        <Link href={loginHref} className={`${PRIMARY_CTA} w-full`}>
          <CalendarCheck className="size-4" aria-hidden="true" />
          Request booking
        </Link>
        <Link href={loginHref} className={`${SECONDARY_CTA} w-full`}>
          <MessageSquare className="size-4" aria-hidden="true" />
          Message {who}
        </Link>
        <p className="pt-1 text-center text-xs text-[#5f5d57]">
          New to Sanus?{' '}
          <Link href="/signup/looking" className="font-semibold text-[#2330c8] hover:underline">
            Create a free account
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      {cta === 'org' ? (
        <Link href={`/facility/contractors/${proId}`} className={`${PRIMARY_CTA} w-full`}>
          <CalendarCheck className="size-4" aria-hidden="true" />
          Request booking
        </Link>
      ) : (
        <BookingRequestButton
          proId={proId}
          firstName={firstName}
          services={bookable}
          className={`${PRIMARY_CTA} w-full`}
        />
      )}
      <MessageButton proId={proId} firstName={firstName} className={`${SECONDARY_CTA} w-full`} />
      <p className="pt-1 text-center text-xs text-[#5f5d57]">
        No charge to ask. {firstName || 'They'} will confirm the details with you.
      </p>
    </div>
  )
}

function RatingInline({ rating, count }: { rating: number; count: number }) {
  if (count <= 0) {
    return <span className="text-[#5f5d57]">New on Sanus</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      <span className="text-[#5f5d57]">
        ({count} review{count === 1 ? '' : 's'})
      </span>
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex" aria-label={`${rating.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`size-4 ${i <= full ? 'fill-amber-400 text-amber-400' : 'fill-[#e3dfd6] text-[#e3dfd6]'}`}
        />
      ))}
    </span>
  )
}

function ReviewItem({ review: r }: { review: PublicReview }) {
  const date = r.created_at
    ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  return (
    <li className="border-b border-[#f0f0f1] pb-5 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={r.rating} />
        {date && <span className="text-xs text-[#706d65]">{date}</span>}
      </div>
      {r.title && <p className="mt-2 font-semibold text-[#1a1a17]">{r.title}</p>}
      {r.content && (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3a3934]">
          {r.content}
        </p>
      )}
      <p className="mt-2 text-xs font-medium text-[#5f5d57]">— {r.reviewer}</p>
    </li>
  )
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })
}

/** A listing without its price: prices live in the Rates section only. */
function OfferingRow({ listing: l }: { listing: PublicListing }) {
  const kindLine =
    l.kind === 'service'
      ? formatLabel(l.format)
      : l.kind === 'consulting'
        ? engagementLabel(l.engagement_type)
        : eventTypeLabel(l.event_type)
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-md bg-[#eceefe] px-2 py-0.5 text-[#2330c8]">
          {KIND_LABELS[l.kind]}
        </span>
        {kindLine && <span className="text-[#5f5d57]">{kindLine}</span>}
      </div>
      <h3 className="mt-1.5 font-semibold text-[#1a1a17]">{l.title}</h3>
      {l.description && (
        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-[#3a3934]">
          {l.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5f5d57]">
        {l.kind === 'service' && l.duration_minutes && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {l.duration_minutes} min
          </span>
        )}
        {l.kind === 'service' && l.format === 'virtual' && (
          <span className="inline-flex items-center gap-1">
            <Video className="size-3.5" aria-hidden="true" />
            Video visit
          </span>
        )}
        {l.kind === 'service' && (l.format === 'in_person' || l.format === 'home_visit') && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {l.format === 'home_visit' ? 'Comes to you' : 'In person'}
          </span>
        )}
        {l.kind === 'event' && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {l.starts_at ? formatWhen(l.starts_at) : 'Date to be announced'}
          </span>
        )}
        {l.kind === 'event' && l.capacity && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            Up to {l.capacity}
          </span>
        )}
      </div>
    </li>
  )
}

function RatesList({ rates }: { rates: ProfessionalRate[] }) {
  return (
    <ul className="divide-y divide-[#f0f0f1]">
      {rates.map((r) => {
        const unit = formatRateUnit(r)
        return (
          <li key={r.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 font-medium text-[#1a1a17]">{r.label}</p>
              <p className="shrink-0 text-right">
                <span className={`font-semibold ${r.on_request || r.amount_cents == null ? 'text-sm text-[#5f5d57]' : 'text-[#1a1a17]'}`}>
                  {formatRateAmount(r)}
                </span>
                {unit && <span className="ml-1 text-xs text-[#5f5d57]">{unit}</span>}
              </p>
            </div>
            {r.description && (
              <p className="mt-0.5 text-sm text-[#5f5d57]">{r.description}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Monday-first display order.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function formatTime(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`
}

function AvailabilityBlock({
  availability: a,
  isOwner,
}: {
  availability: AvailabilitySummary
  isOwner: boolean
}) {
  const byDay = new Map<number, string[]>()
  for (const w of a.weekly) {
    const range = w.start && w.end ? `${formatTime(w.start)}–${formatTime(w.end)}` : 'Available'
    byDay.set(w.day, [...(byDay.get(w.day) ?? []), range])
  }
  return (
    <div className="space-y-4">
      {a.accepting != null && (
        <p
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            a.accepting ? 'bg-[#eceefe] text-[#2330c8]' : 'bg-[#eeebe4] text-[#5f5d57]'
          }`}
        >
          <span className={`size-2 rounded-full ${a.accepting ? 'bg-[#2f3cf5]' : 'bg-[#706d65]'}`} />
          {a.accepting ? 'Accepting new clients' : 'Not taking new clients right now'}
        </p>
      )}
      {byDay.size > 0 ? (
        <dl className="space-y-1.5 text-sm">
          {DAY_ORDER.map((d) => (
            <div key={d} className="flex justify-between gap-3">
              <dt className={byDay.has(d) ? 'font-medium text-[#1a1a17]' : 'text-[#706d65]'}>
                {DAYS[d]}
              </dt>
              <dd className={`text-right ${byDay.has(d) ? 'text-[#3a3934]' : 'text-[#706d65]'}`}>
                {byDay.get(d)?.join(', ') ?? 'Unavailable'}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-[#5f5d57]">
          {isOwner ? (
            <>
              Show clients when you work.{' '}
              <Link href="/contractor/availability" className="font-semibold text-[#2330c8] underline">
                Set your hours
              </Link>
            </>
          ) : (
            'Hours are flexible. Request a booking to find a time.'
          )}
        </p>
      )}
      {a.willingToTravel && (
        <p className="flex items-center gap-2 text-sm text-[#3a3934]">
          <Car className="size-4 text-[#706d65]" aria-hidden="true" />
          {a.travelRadiusMiles ? `Travels up to ${a.travelRadiusMiles} miles` : 'Willing to travel'}
        </p>
      )}
    </div>
  )
}
