import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { formatCurrency, getInitials } from '@/lib/utils/format'
import {
  MapPin,
  Star,
  Briefcase,
  Clock,
  Car,
  Pencil,
  CheckCircle,
  XCircle,
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#404145]">My Profile</h1>
        <Button render={<Link href="/contractor/profile/edit" />}>
          <Pencil className="size-4" data-icon="inline-start" />
          Edit Profile
        </Button>
      </div>

      {/* Profile Completion */}
      {completionPct < 100 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Profile Completion</span>
              <span className="text-muted-foreground">{completionPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Complete your profile to increase visibility to facilities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Profile Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#1dbf73]/20 via-[#1dbf73]/10 to-transparent" />
        <CardHeader className="-mt-12 px-6">
          <div className="flex items-end gap-5">
            <Avatar size="lg" className="size-20 border-4 border-white shadow-md">
              {profile.profiles?.avatar_url && (
                <AvatarImage
                  src={profile.profiles.avatar_url}
                  alt={`${profile.first_name} ${profile.last_name}`}
                />
              )}
              <AvatarFallback className="text-xl bg-[#1dbf73]/10 text-[#1dbf73]">
                {getInitials(profile.first_name, profile.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[#404145]">
                  {profile.first_name} {profile.last_name}
                </h2>
                <Badge variant={profile.is_available ? 'default' : 'secondary'} className={profile.is_available ? 'bg-[#1dbf73] hover:bg-[#19a463]' : ''}>
                  {profile.is_available ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
              <p className="text-sm text-[#62646a]">
                {CONTRACTOR_TYPE_LABELS[profile.contractor_type] ?? profile.contractor_type}
              </p>
              {profile.headline && (
                <p className="mt-1 text-sm text-[#404145]">{profile.headline}</p>
              )}
              {profile.average_rating != null && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-[#404145]">{profile.average_rating.toFixed(1)}</span>
                  {profile.total_reviews != null && (
                    <span className="text-[#62646a]">
                      ({profile.total_reviews} {profile.total_reviews === 1 ? 'review' : 'reviews'})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {profile.specialties && profile.specialties.length > 0 && (
          <CardContent>
            <h3 className="text-sm font-medium mb-2">Specialties</h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.specialties.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}

        {profile.bio && (
          <CardContent>
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {profile.bio}
            </p>
          </CardContent>
        )}

        <Separator />

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.years_of_experience != null && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="size-4 text-muted-foreground" />
                <span>
                  {profile.years_of_experience}{' '}
                  {profile.years_of_experience === 1 ? 'year' : 'years'} of experience
                </span>
              </div>
            )}
            {profile.hourly_rate_min != null && profile.hourly_rate_max != null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <span>
                  {formatCurrency(profile.hourly_rate_min)} -{' '}
                  {formatCurrency(profile.hourly_rate_max)}/hr
                </span>
              </div>
            )}
            {(profile.city || profile.state) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                <span>
                  {[profile.city, profile.state, profile.zip_code]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Car className="size-4 text-muted-foreground" />
              {profile.willing_to_travel ? (
                <span>
                  Willing to travel
                  {profile.travel_radius_miles
                    ? ` (${profile.travel_radius_miles} mi radius)`
                    : ''}
                </span>
              ) : (
                <span>Local only</span>
              )}
            </div>
          </div>
        </CardContent>

        {(profile.npi_number || profile.state_license_number) && (
          <>
            <Separator />
            <CardContent>
              <h3 className="text-sm font-medium mb-3">License Information</h3>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                {profile.npi_number && (
                  <div>
                    <span className="text-muted-foreground">NPI Number</span>
                    <p className="font-medium">{profile.npi_number}</p>
                  </div>
                )}
                {profile.state_license_number && (
                  <div>
                    <span className="text-muted-foreground">State License</span>
                    <p className="font-medium">
                      {profile.state_license_number}
                      {profile.license_state ? ` (${profile.license_state})` : ''}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
