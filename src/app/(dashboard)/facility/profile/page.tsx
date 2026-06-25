import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FACILITY_TYPE_LABELS } from '@/lib/utils/constants'
import {
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  ShieldCheck,
  Building,
  Pencil,
  User,
  Briefcase,
} from 'lucide-react'
import { isDemoMode, DEMO_FACILITY } from '@/lib/demo/data'
import { FacilityProfileEditForm } from './edit-form'

interface FacilityProfile {
  id: string
  facility_name: string
  facility_type: string
  description: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  ein: string | null
  average_rating: number | null
  total_reviews: number | null
  is_verified: boolean
}

export default async function FacilityProfilePage() {
  let facility: FacilityProfile | null
  const demo = isDemoMode()

  if (demo) {
    facility = {
      id: DEMO_FACILITY.id,
      facility_name: DEMO_FACILITY.facility_name,
      facility_type: DEMO_FACILITY.facility_type,
      description: DEMO_FACILITY.description ?? null,
      website: DEMO_FACILITY.website ?? null,
      address_line1: DEMO_FACILITY.address_line1 ?? null,
      address_line2: null,
      city: DEMO_FACILITY.city ?? null,
      state: DEMO_FACILITY.state ?? null,
      zip_code: DEMO_FACILITY.zip_code ?? null,
      phone: DEMO_FACILITY.phone ?? null,
      contact_name: DEMO_FACILITY.contact_name ?? null,
      contact_title: DEMO_FACILITY.contact_title ?? null,
      contact_email: DEMO_FACILITY.contact_email ?? null,
      ein: null,
      average_rating: DEMO_FACILITY.average_rating ?? null,
      total_reviews: DEMO_FACILITY.total_reviews ?? null,
      is_verified: DEMO_FACILITY.is_verified ?? false,
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data } = await supabase
      .from('facility_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    facility = (data as FacilityProfile | null) ?? null
  }

  if (!facility) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-[#404145]">Facility Profile</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="font-medium text-[#404145]">
              No facility profile found
            </h3>
            <p className="mt-1 text-sm text-[#62646a]">
              Please set up your facility profile below.
            </p>
          </CardContent>
        </Card>
        <FacilityProfileEditForm facility={null} />
      </div>
    )
  }

  const typeLabel =
    FACILITY_TYPE_LABELS[facility.facility_type] ?? facility.facility_type

  const address = [
    facility.address_line1,
    facility.address_line2,
    [facility.city, facility.state].filter(Boolean).join(', '),
    facility.zip_code,
  ]
    .filter(Boolean)
    .join(', ')

  const shortLocation = [facility.city, facility.state]
    .filter(Boolean)
    .join(', ')

  const initials = facility.facility_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar size="lg" className="size-24">
                <AvatarFallback className="bg-[#e8faf1] text-2xl font-semibold text-[#0f8f56]">
                  {initials || <Building className="size-10" />}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#404145]">
                    {facility.facility_name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]"
                  >
                    {typeLabel}
                  </Badge>
                  {facility.is_verified && (
                    <Badge
                      variant="outline"
                      className="border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]"
                    >
                      <ShieldCheck className="size-3" data-icon="inline-start" />
                      Verified
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-[#62646a]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {shortLocation || address || 'Location not set'}
                  </span>
                </p>

                {facility.average_rating != null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                    <span className="font-medium text-[#404145]">
                      {facility.average_rating.toFixed(1)}
                    </span>
                    {facility.total_reviews != null && (
                      <span className="text-[#62646a]">
                        ({facility.total_reviews}{' '}
                        {facility.total_reviews === 1 ? 'review' : 'reviews'})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <Button
                className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                render={<Link href="/facility/profile/edit" />}
              >
                <Pencil className="size-4" data-icon="inline-start" />
                Edit profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* About */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">About</h2>
              {facility.description ? (
                <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                  {facility.description}
                </p>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  Add a short description so contractors learn about your
                  facility.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Services</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{typeLabel}</Badge>
                {facility.is_verified && (
                  <Badge variant="outline">Verified Facility</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Details</h2>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#62646a]" />
                    <span className="text-[#404145]">{address}</span>
                  </div>
                )}
                {facility.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0 text-[#62646a]" />
                    <span className="text-[#404145]">{facility.phone}</span>
                  </div>
                )}
                {facility.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 shrink-0 text-[#62646a]" />
                    <a
                      href={facility.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[#1dbf73] hover:underline"
                    >
                      {facility.website}
                    </a>
                  </div>
                )}
                {facility.ein && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-4 shrink-0 text-[#62646a]" />
                    <span className="text-[#404145]">EIN: {facility.ein}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">Reviews</h2>
              {facility.average_rating != null &&
              facility.total_reviews != null &&
              facility.total_reviews > 0 ? (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                  <span className="font-medium text-[#404145]">
                    {facility.average_rating.toFixed(1)}
                  </span>
                  <span className="text-[#62646a]">
                    average across {facility.total_reviews}{' '}
                    {facility.total_reviews === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  No reviews yet. Reviews from contractors will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - sidebar */}
        <div className="space-y-6">
          {/* Contact person */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-[#404145]">
                Contact Person
              </h2>
              {facility.contact_name || facility.contact_email ? (
                <div className="space-y-2 text-sm">
                  {facility.contact_name && (
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 size-4 shrink-0 text-[#62646a]" />
                      <div>
                        <p className="font-medium text-[#404145]">
                          {facility.contact_name}
                        </p>
                        {facility.contact_title && (
                          <p className="text-[#62646a]">
                            {facility.contact_title}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {facility.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-[#62646a]" />
                      <a
                        href={`mailto:${facility.contact_email}`}
                        className="text-[#1dbf73] hover:underline"
                      >
                        {facility.contact_email}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">No contact set.</p>
              )}
            </CardContent>
          </Card>

          {/* Quick info */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-semibold text-[#404145]">
                Quick info
              </h2>

              <div className="flex items-center gap-3 text-sm">
                <Building className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Type</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {typeLabel}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Location</span>
                <span className="ml-auto font-medium text-[#404145]">
                  {shortLocation || 'Not set'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="size-4 text-[#62646a]" />
                <span className="text-[#62646a]">Status</span>
                <span className="ml-auto">
                  <Badge
                    variant="outline"
                    className={
                      facility.is_verified
                        ? 'border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]'
                        : ''
                    }
                  >
                    {facility.is_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                </span>
              </div>

              {facility.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="size-4 text-[#62646a]" />
                  <span className="text-[#62646a]">Phone</span>
                  <span className="ml-auto font-medium text-[#404145]">
                    {facility.phone}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inline Edit Form - real mode only */}
      {!demo && <FacilityProfileEditForm facility={facility} />}
    </div>
  )
}
