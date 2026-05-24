import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FACILITY_TYPE_LABELS } from '@/lib/utils/constants'
import { Star, MapPin, Phone, Mail, Globe, ShieldCheck } from 'lucide-react'
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

  const facility = data as FacilityProfile | null

  if (!facility) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Facility Profile</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="font-medium">No facility profile found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please set up your facility profile below.
            </p>
          </CardContent>
        </Card>
        <FacilityProfileEditForm facility={null} />
      </div>
    )
  }

  const address = [
    facility.address_line1,
    facility.address_line2,
    [facility.city, facility.state].filter(Boolean).join(', '),
    facility.zip_code,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Facility Profile</h1>
      </div>

      {/* View Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{facility.facility_name}</CardTitle>
                {facility.is_verified && (
                  <Badge variant="default">
                    <ShieldCheck className="size-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {FACILITY_TYPE_LABELS[facility.facility_type] ?? facility.facility_type}
              </p>
            </div>
            {facility.average_rating != null && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{facility.average_rating.toFixed(1)}</span>
                {facility.total_reviews != null && (
                  <span className="text-muted-foreground">
                    ({facility.total_reviews})
                  </span>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {facility.description && (
          <CardContent>
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {facility.description}
            </p>
          </CardContent>
        )}

        <Separator />

        <CardContent>
          <h3 className="text-sm font-medium mb-3">Details</h3>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {address && (
              <div className="flex items-start gap-2">
                <MapPin className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{address}</span>
              </div>
            )}
            {facility.phone && (
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span>{facility.phone}</span>
              </div>
            )}
            {facility.website && (
              <div className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={facility.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {facility.website}
                </a>
              </div>
            )}
          </div>
        </CardContent>

        {(facility.contact_name || facility.contact_email) && (
          <>
            <Separator />
            <CardContent>
              <h3 className="text-sm font-medium mb-3">Contact Person</h3>
              <div className="text-sm space-y-1">
                {facility.contact_name && (
                  <p>
                    {facility.contact_name}
                    {facility.contact_title && (
                      <span className="text-muted-foreground">
                        {' '}
                        &mdash; {facility.contact_title}
                      </span>
                    )}
                  </p>
                )}
                {facility.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${facility.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {facility.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Inline Edit Form */}
      <FacilityProfileEditForm facility={facility} />
    </div>
  )
}
