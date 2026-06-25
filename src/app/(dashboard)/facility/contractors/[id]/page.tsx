import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { formatCurrency, getInitials } from '@/lib/utils/format'
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  MessageSquare,
  UserPlus,
} from 'lucide-react'
import {
  isDemoMode,
  DEMO_PROVIDERS,
  DEMO_CONTRACTOR,
  DEMO_REVIEWS,
} from '@/lib/demo/data'

interface ContractorView {
  id: string
  first_name: string
  last_name: string
  contractor_type: string
  specialties: string[] | null
  headline: string | null
  bio: string | null
  years_of_experience: number | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  city: string | null
  state: string | null
  willing_to_travel: boolean
  travel_radius_miles: number | null
  is_available: boolean
  average_rating: number | null
  total_reviews: number | null
  total_jobs_completed: number | null
  avatar_url: string | null
}

interface ReviewView {
  id: string
  rating: number
  title: string | null
  content: string | null
}

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let contractor: ContractorView
  let reviews: ReviewView[] = []
  let verifiedCredentials = 0

  if (isDemoMode()) {
    const provider = DEMO_PROVIDERS.find((p) => p.id === id)

    if (provider) {
      contractor = {
        id: provider.id,
        first_name: provider.first_name,
        last_name: provider.last_name,
        contractor_type: provider.contractor_type,
        specialties: provider.specialties ?? null,
        headline: provider.headline ?? null,
        bio: null,
        years_of_experience: provider.years_of_experience ?? null,
        hourly_rate_min: provider.hourly_rate_min ?? null,
        hourly_rate_max: provider.hourly_rate_max ?? null,
        city: provider.city ?? null,
        state: provider.state ?? null,
        willing_to_travel: false,
        travel_radius_miles: null,
        is_available: provider.is_available,
        average_rating: provider.average_rating ?? null,
        total_reviews: provider.total_reviews ?? null,
        total_jobs_completed: null,
        avatar_url: null,
      }
    } else if (id === 'demo-contractor-1') {
      contractor = {
        id: DEMO_CONTRACTOR.id,
        first_name: DEMO_CONTRACTOR.first_name,
        last_name: DEMO_CONTRACTOR.last_name,
        contractor_type: DEMO_CONTRACTOR.contractor_type,
        specialties: DEMO_CONTRACTOR.specialties,
        headline: DEMO_CONTRACTOR.headline,
        bio: DEMO_CONTRACTOR.bio,
        years_of_experience: DEMO_CONTRACTOR.years_of_experience,
        hourly_rate_min: DEMO_CONTRACTOR.hourly_rate_min,
        hourly_rate_max: DEMO_CONTRACTOR.hourly_rate_max,
        city: DEMO_CONTRACTOR.city,
        state: DEMO_CONTRACTOR.state,
        willing_to_travel: DEMO_CONTRACTOR.willing_to_travel,
        travel_radius_miles: DEMO_CONTRACTOR.travel_radius_miles,
        is_available: DEMO_CONTRACTOR.is_available,
        average_rating: DEMO_CONTRACTOR.average_rating,
        total_reviews: DEMO_CONTRACTOR.total_reviews,
        total_jobs_completed: DEMO_CONTRACTOR.total_jobs_completed,
        avatar_url: DEMO_CONTRACTOR.avatar_url,
      }
    } else {
      notFound()
    }

    reviews = DEMO_REVIEWS.filter((r) => r.reviewee_id === id).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
    }))
    // Approximate "verified credentials" for demo display
    verifiedCredentials = id === 'demo-contractor-1' ? 4 : 3
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: row } = await supabase
      .from('contractor_profiles')
      .select('*, profiles!inner(avatar_url, email)')
      .eq('id', id)
      .single()

    if (!row) {
      return (
        <div className="space-y-3 py-12 text-center">
          <p className="text-sm text-[#62646a]">Contractor not found.</p>
          <Link href="/facility/contractors">
            <Button variant="link" className="text-[#1dbf73]">
              Back to search
            </Button>
          </Link>
        </div>
      )
    }

    const profile = row.profiles as {
      avatar_url: string | null
      email: string
    }
    contractor = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      contractor_type: row.contractor_type,
      specialties: row.specialties,
      headline: row.headline,
      bio: row.bio,
      years_of_experience: row.years_of_experience,
      hourly_rate_min: row.hourly_rate_min,
      hourly_rate_max: row.hourly_rate_max,
      city: row.city,
      state: row.state,
      willing_to_travel: row.willing_to_travel,
      travel_radius_miles: row.travel_radius_miles,
      is_available: row.is_available,
      average_rating: row.average_rating,
      total_reviews: row.total_reviews,
      total_jobs_completed: row.total_jobs_completed,
      avatar_url: profile?.avatar_url ?? null,
    }

    const { count } = await supabase
      .from('credentials')
      .select('*', { count: 'exact', head: true })
      .eq('contractor_id', id)
      .eq('status', 'verified')
    verifiedCredentials = count ?? 0

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('*, reviewer:reviewer_id(id, role, email)')
      .eq('reviewee_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(5)
    reviews = (reviewRows ?? []).map((r) => ({
      id: r.id as string,
      rating: r.rating as number,
      title: (r.title as string | null) ?? null,
      content: (r.content as string | null) ?? null,
    }))
  }

  const typeLabel =
    CONTRACTOR_TYPE_LABELS[contractor.contractor_type] ??
    contractor.contractor_type
  const locationStr = [contractor.city, contractor.state]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/facility/contractors"
        className="inline-flex items-center text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to search
      </Link>

      {/* Hero card */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <Avatar size="lg" className="size-24">
                {contractor.avatar_url && (
                  <AvatarImage
                    src={contractor.avatar_url}
                    alt={`${contractor.first_name} ${contractor.last_name}`}
                  />
                )}
                <AvatarFallback className="bg-[#e8faf1] text-2xl font-semibold text-[#0f8f56]">
                  {getInitials(contractor.first_name, contractor.last_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#404145]">
                    {contractor.first_name} {contractor.last_name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]"
                  >
                    {typeLabel}
                  </Badge>
                </div>

                {contractor.headline && (
                  <p className="text-sm text-[#404145]">{contractor.headline}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {contractor.average_rating != null &&
                    contractor.average_rating > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                        <span className="font-medium text-[#404145]">
                          {contractor.average_rating.toFixed(1)}
                        </span>
                        {contractor.total_reviews != null && (
                          <span className="text-[#62646a]">
                            ({contractor.total_reviews}{' '}
                            {contractor.total_reviews === 1
                              ? 'review'
                              : 'reviews'}
                            )
                          </span>
                        )}
                      </div>
                    )}
                  {locationStr && (
                    <div className="flex items-center gap-1 text-[#62646a]">
                      <MapPin className="size-4" />
                      {locationStr}
                    </div>
                  )}
                  {contractor.years_of_experience != null && (
                    <div className="flex items-center gap-1 text-[#62646a]">
                      <Clock className="size-4" />
                      {contractor.years_of_experience} years experience
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[#0f8f56]">
                    <CheckCircle2 className="size-4" />
                    {verifiedCredentials} verified credentials
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-[#bcebd5] text-[#0f8f56] hover:bg-[#e8faf1]"
                render={<Link href={`/messages?start=${contractor.id}`} />}
              >
                <MessageSquare className="size-4" data-icon="inline-start" />
                Message
              </Button>
              <Button
                className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                render={
                  <Link href={`/facility/jobs?invite=${contractor.id}`} />
                }
              >
                <UserPlus className="size-4" data-icon="inline-start" />
                Invite to apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 md:col-span-2">
          {/* Bio */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">About</h2>
              {contractor.bio ? (
                <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                  {contractor.bio}
                </p>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  No bio provided.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Specialties */}
          {contractor.specialties && contractor.specialties.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold text-[#404145]">
                  Specialties
                </h2>
                <div className="flex flex-wrap gap-2">
                  {contractor.specialties.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Reviews</h2>
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review, idx) => (
                    <div key={review.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={
                                i < review.rating
                                  ? 'size-4 fill-[#fbbf24] text-[#fbbf24]'
                                  : 'size-4 text-[#d1d5db]'
                              }
                            />
                          ))}
                        </div>
                        {review.title && (
                          <span className="font-medium text-[#404145]">
                            {review.title}
                          </span>
                        )}
                      </div>
                      {review.content && (
                        <p className="text-sm text-[#62646a]">
                          {review.content}
                        </p>
                      )}
                      {idx < reviews.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">No reviews yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Rate</h2>
              {contractor.hourly_rate_min != null ||
              contractor.hourly_rate_max != null ? (
                <p className="text-2xl font-bold text-[#404145]">
                  {contractor.hourly_rate_min != null &&
                    formatCurrency(contractor.hourly_rate_min)}
                  {contractor.hourly_rate_max != null &&
                    ` - ${formatCurrency(contractor.hourly_rate_max)}`}
                  <span className="text-sm font-normal text-[#62646a]">
                    /hr
                  </span>
                </p>
              ) : (
                <p className="text-sm text-[#6b7280]">Rate not specified</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">
                Availability
              </h2>
              <Badge
                variant="outline"
                className={
                  contractor.is_available
                    ? 'border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]'
                    : ''
                }
              >
                {contractor.is_available ? 'Available' : 'Not Available'}
              </Badge>
              {contractor.willing_to_travel && (
                <p className="text-sm text-[#62646a]">
                  Willing to travel
                  {contractor.travel_radius_miles != null &&
                    ` (${contractor.travel_radius_miles} mi radius)`}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Stats</h2>
              <div className="space-y-2 text-sm">
                {contractor.total_jobs_completed != null && (
                  <div className="flex justify-between">
                    <span className="text-[#62646a]">Jobs Completed</span>
                    <span className="font-medium text-[#404145]">
                      {contractor.total_jobs_completed}
                    </span>
                  </div>
                )}
                {contractor.years_of_experience != null && (
                  <div className="flex justify-between">
                    <span className="text-[#62646a]">Experience</span>
                    <span className="font-medium text-[#404145]">
                      {contractor.years_of_experience} years
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
