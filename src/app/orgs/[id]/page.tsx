import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { BadgeCheck, Building2, Eye, MapPin, ShieldCheck, Star } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { orgTypeLabel } from '@/lib/onboarding/organization'
import { getDemoOrgPage, getPublicOrgPage, type PublicOrgPage } from '@/lib/orgs/public'
import { OrgListingCard, OrgListingCta } from '@/components/orgs/org-listing-card'
import { SiteHeader } from '@/components/marketing/site-header'

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
const load = cache(async (id: string): Promise<{ data: PublicOrgPage | null; viewer: string | null }> => {
  if (isDemoMode()) return { data: getDemoOrgPage(id), viewer: null }
  const viewer = await viewerId()
  return { data: await getPublicOrgPage(id, viewer), viewer }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection()
  const { id } = await params
  const { data } = await load(id)
  if (!data) return { title: 'Organization not found — Sanus' }
  return {
    title: `${data.org.name} — Sanus`,
    description: data.org.description ?? undefined,
  }
}

/**
 * Public organization page: who they are and their live services and
 * events. Deliberately no phone, email, website or address — booking and
 * contact happen through Sanus.
 */
export default async function OrgPage({ params }: Props) {
  // Visibility depends on live approval state — render per request.
  await connection()
  const { id } = await params
  const { data, viewer } = await load(id)
  if (!data) notFound()

  const { org, listings, isOwner, approved } = data
  const location = [org.city, org.state].filter(Boolean).join(', ')
  const type = orgTypeLabel(org.orgType, org.orgTypeOther)
  const services = listings.filter((l) => l.kind === 'service')
  const events = listings.filter((l) => l.kind === 'event')

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#1a1a17]">
      <SiteHeader />

      {isOwner && (
        <div className="border-b border-[#ecd3a3] bg-[#fbf0dc]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-[#8a5a00] sm:px-6">
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 font-medium">
              {approved
                ? 'This is your public page. Only approved, live listings appear here.'
                : 'Preview: your page goes public once Sanus approves your organization.'}
            </p>
            <Link href="/facility/listings" className="font-semibold underline">
              Manage services &amp; events
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-[#e3dfd6] bg-white p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#eceefe] text-[#2330c8]">
              <Building2 className="size-9" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-[#1a1a17]">{org.name}</h1>
              {type && <p className="mt-0.5 text-sm text-[#5f5d57]">{type}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {approved && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eceefe] px-2.5 py-1 text-xs font-semibold text-[#2330c8]">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    Verified organization
                  </span>
                )}
                {org.totalReviews > 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm text-[#3a3934]">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    <span className="font-semibold">{org.averageRating.toFixed(1)}</span>
                    <span className="text-[#5f5d57]">
                      ({org.totalReviews} review{org.totalReviews === 1 ? '' : 's'})
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-[#5f5d57]">New on Sanus</span>
                )}
              </div>
              {location && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#3a3934]">
                  <MapPin className="size-4 text-[#706d65]" aria-hidden="true" />
                  {location}
                </p>
              )}
            </div>
          </div>
          {org.description && <p className="mt-5 whitespace-pre-line text-[#3a3934]">{org.description}</p>}
        </section>

        <ListingSection title="Services" empty="No services listed yet." listings={services} signedIn={!!viewer} isOwner={isOwner} />
        <ListingSection title="Events & training" empty="No upcoming events." listings={events} signedIn={!!viewer} isOwner={isOwner} />

        <p className="flex items-start gap-2 rounded-2xl border border-[#e3dfd6] bg-white p-4 text-sm text-[#5f5d57]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2f3cf5]" aria-hidden="true" />
          Book and pay through Sanus so your booking, payment, and messages stay protected in one place.
        </p>
      </main>
    </div>
  )
}

function ListingSection({
  title,
  empty,
  listings,
  signedIn,
  isOwner,
}: {
  title: string
  empty: string
  listings: PublicOrgPage['listings']
  signedIn: boolean
  isOwner: boolean
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-[#1a1a17]">{title}</h2>
      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e3dfd6] bg-white p-6 text-sm text-[#5f5d57]">{empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => (
            <OrgListingCard key={l.id} listing={l} footer={isOwner ? null : <OrgListingCta listing={l} signedIn={signedIn} />} />
          ))}
        </div>
      )}
    </section>
  )
}
