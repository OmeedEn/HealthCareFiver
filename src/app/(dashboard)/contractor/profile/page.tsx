import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { formatCurrency, getInitials } from '@/lib/utils/format'
import {
  MapPin,
  Star,
  Briefcase,
  Clock,
  Car,
  Pencil,
  AlertCircle,
  CircleDollarSign,
  CalendarCheck,
  IdCard,
} from 'lucide-react'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'

interface ContractorProfile {
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
  npi_number: string | null
  state_license_number: string | null
  license_state: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  willing_to_travel: boolean
  travel_radius_miles: number | null
  is_available: boolean
  profile_completion_pct: number | null
  average_rating: number | null
  total_reviews: number | null
  profiles: {
    avatar_url: string | null
    email: string
    phone: string | null
  } | null
}

export default async function ContractorProfilePage() {
  let profile: ContractorProfile

  if (isDemoMode()) {
    profile = DEMO_CONTRACTOR as unknown as ContractorProfile
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: contractor } = await supabase
      .from('contractor_profiles')
      .select('*, profiles(*)')
      .eq('id', user.id)
      .single()

    if (!contractor) {
      redirect('/contractor/profile/edit')
    }

    profile = contractor as unknown as ContractorProfile
  }

  const completionPct = profile.profile_completion_pct ?? 0
  const credentialLabel =
    CONTRACTOR_TYPE_LABELS[profile.contractor_type] ?? profile.contractor_type
  const locationStr = [profile.city, profile.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Profile completion alert */}
      {completionPct < 100 && (
        <Card className="rounded-md border-[#bcebd5] bg-[#e8faf1]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0f8f56]">
              <AlertCircle className="h-5 w-5" />
              Complete Your Profile
            </CardTitle>
            <CardDescription className="font-semibold text-[#0f8f56]">
              Your profile is {completionPct}% complete. A complete profile helps
              you get matched with more jobs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/contractor/profile/edit"
              className="text-sm font-black text-[#1dbf73] hover:underline"
            >
              Complete profile &rarr;
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Hero card */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar size="lg" className="size-24">
                {profile.profiles?.avatar_url && (
                  <AvatarImage
                    src={profile.profiles.avatar_url}
                    alt={`${profile.first_name} ${profile.last_name}`}
                  />
                )}
                <AvatarFallback className="bg-[#e8faf1] text-2xl font-semibold text-[#0f8f56]">
                  {getInitials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#404145]">
                    {profile.first_name} {profile.last_name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]"
                  >
                    {credentialLabel}
                  </Badge>
                </div>

                <p className="text-sm text-[#62646a]">
                  {locationStr ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" />
                      {locationStr}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" />
                      Location not set
                    </span>
                  )}
                </p>

                {profile.headline && (
                  <p className="text-sm text-[#404145]">{profile.headline}</p>
                )}

                {profile.average_rating != null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                    <span className="font-medium text-[#404145]">
                      {profile.average_rating.toFixed(1)}
                    </span>
                    {profile.total_reviews != null && (
                      <span className="text-[#62646a]">
                        ({profile.total_reviews}{' '}
                        {profile.total_reviews === 1 ? 'review' : 'reviews'})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <Button
                className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                render={<Link href="/contractor/profile/edit" />}
              >
                <Pencil className="size-4" data-icon="inline-start" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bio */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">About</h2>
              {profile.bio ? (
                <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  Tell facilities a little about your background and what makes
                  you a great fit.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Specialties */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">
                Specialties
              </h2>
              {profile.specialties && profile.specialties.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.specialties.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  No specialties added yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">
                Experience
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Years of experience</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {profile.years_of_experience != null
                    ? `${profile.years_of_experience} ${
                        profile.years_of_experience === 1 ? 'year' : 'years'
                      }`
                    : 'Not set'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Car className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Travel</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {profile.willing_to_travel
                    ? profile.travel_radius_miles
                      ? `Up to ${profile.travel_radius_miles} mi`
                      : 'Willing to travel'
                    : 'Local only'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* License info */}
          {(profile.npi_number || profile.state_license_number) && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold text-[#404145]">
                  License Information
                </h2>
                {profile.npi_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <IdCard className="size-4 text-[#62646a]" />
                    <span className="text-[#62646a]">NPI Number</span>
                    <span className="ml-auto font-medium text-[#404145]">
                      {profile.npi_number}
                    </span>
                  </div>
                )}
                {profile.state_license_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <IdCard className="size-4 text-[#62646a]" />
                    <span className="text-[#62646a]">State License</span>
                    <span className="ml-auto font-medium text-[#404145]">
                      {profile.state_license_number}
                      {profile.license_state
                        ? ` (${profile.license_state})`
                        : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reviews preview */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Reviews</h2>
              {profile.average_rating != null &&
              profile.total_reviews != null &&
              profile.total_reviews > 0 ? (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                  <span className="font-medium text-[#404145]">
                    {profile.average_rating.toFixed(1)}
                  </span>
                  <span className="text-[#62646a]">
                    average across {profile.total_reviews}{' '}
                    {profile.total_reviews === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  No reviews yet. Complete jobs to start collecting feedback
                  from facilities.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-semibold text-[#404145]">
                Quick info
              </h2>

              <div className="flex items-center gap-3 text-sm">
                <CircleDollarSign className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Rate</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {profile.hourly_rate_min != null &&
                  profile.hourly_rate_max != null
                    ? `${formatCurrency(profile.hourly_rate_min)} - ${formatCurrency(
                        profile.hourly_rate_max,
                      )}/hr`
                    : 'Not set'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Location</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {locationStr || 'Not set'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <CalendarCheck className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Availability</span>
                <span className="ml-auto">
                  <Badge
                    variant="outline"
                    className={
                      profile.is_available
                        ? 'border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]'
                        : ''
                    }
                  >
                    {profile.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Experience</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {profile.years_of_experience != null
                    ? `${profile.years_of_experience} ${
                        profile.years_of_experience === 1 ? 'yr' : 'yrs'
                      }`
                    : 'Not set'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
