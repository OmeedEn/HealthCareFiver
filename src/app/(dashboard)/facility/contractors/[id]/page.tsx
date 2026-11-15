import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { InquiryPanel, type LatestInquiry } from './inquiry-panel'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProfileGate } from '@/components/contractor/profile-gate'
import { getInitials } from '@/lib/utils/format'
import { isOrgStatus, orgBlockedReason } from '@/lib/org/review'
import { orgVerifyHref } from '@/lib/onboarding/org-verify-later'
import { formatRateAmount, formatRateUnit } from '@/lib/rates/types'
import {
  getDemoPublicProfile,
  resolveProfileAccess,
  type PublicProfileResult,
} from '@/lib/find-care/profile'
import { ArrowLeft, Star, MapPin, Clock, BadgeCheck, ShieldCheck } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'

const BACK_HREF = '/facility/contractors'

/**
 * Organization view of a professional. Resolves the profile with the same
 * rule as discovery (resolveProfileAccess → getPublicProfile, mirroring
 * getLiveProviders), so any card from /facility/contractors opens here. A
 * profile that exists but isn't published shows a gate, not "not found".
 *
 * Root cause of the old "Contractor not found": this page embedded
 * profiles(avatar_url, email) with the signed-in client. profiles.email is
 * not granted to `authenticated` (20261017000200_profiles_private_columns),
 * so PostgREST rejected the whole query and `row` was null for every
 * professional.
 */
export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id } = await params

  let data: PublicProfileResult
  // Messaging and invites unlock once the viewing org is approved.
  let contactBlockedReason: string | null = null
  let contactVerifyHref: string | null = null
  let acceptsInquiries = true
  let latestInquiry: LatestInquiry | null = null
  const demo = isDemoMode()

  if (demo) {
    const result = getDemoPublicProfile(id)
    if (!result) {
      return <ProfileGate kind="missing" backHref={BACK_HREF} backLabel="Back to search" />
    }
    data = result
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`${BACK_HREF}/${id}`)}`)

    const access = await resolveProfileAccess(id, user.id)
    if (access.kind === 'missing' || access.kind === 'unpublished') {
      return <ProfileGate kind={access.kind} backHref={BACK_HREF} backLabel="Back to search" />
    }
    data = access.result

    const [{ data: viewerOrg }, { data: lastInq }, { data: prefs }] = await Promise.all([
      supabase
        .from('facility_profiles')
        .select('verification_status, onboarding_submitted_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('org_inquiries')
        .select('kind, status, created_at, conversation_id')
        .eq('facility_id', user.id)
        .eq('contractor_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('contractor_profiles')
        .select('accepts_inquiries')
        .eq('id', id)
        .maybeSingle(),
    ])
    contactBlockedReason = orgBlockedReason(
      isOrgStatus(viewerOrg?.verification_status) ? viewerOrg.verification_status : null
    )
    // Organizations verify later: contacting professionals is a moment we ask.
    if (viewerOrg && !viewerOrg.onboarding_submitted_at) {
      contactBlockedReason = 'Contacting professionals unlocks once your organization is verified and approved.'
      contactVerifyHref = orgVerifyHref('contact', `${BACK_HREF}/${id}`)
    }
    latestInquiry = (lastInq as LatestInquiry | null) ?? null
    acceptsInquiries = prefs?.accepts_inquiries !== false
  }

  const { profile: p, reviews, rates, availability } = data
  const name = `${p.first_name} ${p.last_name}`.trim()
  const roleLabel = p.otherProfession ?? p.categoryLabel ?? p.credential
  const locationStr = [p.city, p.state].filter(Boolean).join(', ')
  const activeRates = (rates ?? []).filter((r) => r.is_active)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={BACK_HREF}
        className="inline-flex items-center text-sm text-[#5f5d57] hover:text-[#1a1a17]"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back to search
      </Link>

      {demo && (
        <p className="inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
          Demo mode — this profile is fictional sample data and can&apos;t be booked.
        </p>
      )}

      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <Avatar size="lg" className="size-24">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                <AvatarFallback className="bg-[#eceefe] text-2xl font-semibold text-[#2330c8]">
                  {getInitials(p.first_name, p.last_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#1a1a17]">{name}</h1>
                  {roleLabel && (
                    <Badge variant="outline" className="border-[#c9cdfb] bg-[#eceefe] text-[#2330c8]">
                      {roleLabel}
                    </Badge>
                  )}
                </div>

                {p.headline && <p className="text-sm text-[#1a1a17]">{p.headline}</p>}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {p.total_reviews > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" aria-hidden="true" />
                      <span className="sr-only">Rated</span>
                      <span className="font-medium text-[#1a1a17]">{p.average_rating.toFixed(1)}</span>
                      <span className="text-[#5f5d57]">
                        <span className="sr-only">out of 5 from</span>({p.total_reviews}{' '}
                        {p.total_reviews === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-[#5f5d57]">New on Sanus — no reviews yet</span>
                  )}
                  {locationStr && (
                    <div className="flex items-center gap-1 text-[#5f5d57]">
                      <MapPin className="size-4" aria-hidden="true" />
                      {locationStr}
                    </div>
                  )}
                  {p.yearsOfExperience != null && (
                    <div className="flex items-center gap-1 text-[#5f5d57]">
                      <Clock className="size-4" aria-hidden="true" />
                      {p.yearsOfExperience} years experience
                    </div>
                  )}
                  {p.verified && (
                    <div className="flex items-center gap-1 text-[#2330c8]">
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Approved by Sanus
                    </div>
                  )}
                  {p.insured && (
                    <div className="flex items-center gap-1 text-[#2330c8]">
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      Insured
                    </div>
                  )}
                </div>
                <Link
                  href={`/pros/${p.id}`}
                  className="inline-block text-sm font-medium text-[#2f3cf5] hover:text-[#2330c8]"
                >
                  View full public profile
                </Link>
              </div>
            </div>

            {!demo && (
              <InquiryPanel
                contractorId={p.id}
                firstName={p.first_name}
                blockedReason={contactBlockedReason}
                verifyHref={contactVerifyHref}
                acceptsInquiries={acceptsInquiries}
                latest={latestInquiry}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1a1a17]">About</h2>
              <p className="text-sm whitespace-pre-wrap text-[#5f5d57]">
                {p.bio || 'No bio provided.'}
              </p>
            </CardContent>
          </Card>

          {p.specialties.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold text-[#1a1a17]">Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {p.specialties.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1a1a17]">Reviews</h2>
              {reviews.length > 0 ? (
                <ul className="space-y-4">
                  {reviews.map((review, idx) => (
                    <li key={review.id}>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <div className="flex" role="img" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              aria-hidden="true"
                              className={
                                i < review.rating
                                  ? 'size-4 fill-[#fbbf24] text-[#fbbf24]'
                                  : 'size-4 text-[#cbc6ba]'
                              }
                            />
                          ))}
                        </div>
                        {review.title && (
                          <span className="font-medium text-[#1a1a17]">{review.title}</span>
                        )}
                        <span className="text-xs text-[#706d65]">— {review.reviewer}</span>
                      </div>
                      {review.content && (
                        <p className="text-sm text-[#5f5d57]">{review.content}</p>
                      )}
                      {idx < reviews.length - 1 && <Separator className="mt-4" />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#5f5d57]">No reviews yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1a1a17]">Rates</h2>
              {activeRates.length > 0 ? (
                <ul className="divide-y divide-[#eeebe4]">
                  {activeRates.map((r) => {
                    const unit = formatRateUnit(r)
                    const priced = !r.on_request && r.amount_cents != null
                    return (
                      <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                        <p className="text-sm font-medium text-[#1a1a17]">{r.label}</p>
                        <p>
                          <span
                            className={
                              priced ? 'font-semibold text-[#1a1a17]' : 'text-sm text-[#5f5d57]'
                            }
                          >
                            {formatRateAmount(r)}
                          </span>
                          {unit && <span className="ml-1 text-xs text-[#5f5d57]">{unit}</span>}
                        </p>
                        {r.description && (
                          <p className="mt-0.5 text-xs text-[#5f5d57]">{r.description}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm font-medium text-[#5f5d57]">Contact for pricing</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1a1a17]">Availability</h2>
              {availability.accepting == null ? (
                <p className="text-sm text-[#5f5d57]">Not specified</p>
              ) : (
                <Badge
                  variant="outline"
                  className={availability.accepting ? 'border-[#c9cdfb] bg-[#eceefe] text-[#2330c8]' : ''}
                >
                  {availability.accepting ? 'Accepting clients' : 'Not accepting clients'}
                </Badge>
              )}
              {availability.willingToTravel && (
                <p className="text-sm text-[#5f5d57]">
                  Willing to travel
                  {availability.travelRadiusMiles != null &&
                    ` (${availability.travelRadiusMiles} mi radius)`}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
