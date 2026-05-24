import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  CONTRACTOR_TYPE_LABELS,
} from '@/lib/utils/constants'
import { formatCurrency } from '@/lib/utils/format'
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: contractor } = await supabase
    .from('contractor_profiles')
    .select('*, profiles!inner(avatar_url, email)')
    .eq('id', id)
    .single()

  if (!contractor) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Contractor not found.</p>
        <Link href="/facility/contractors">
          <Button variant="link">Back to search</Button>
        </Link>
      </div>
    )
  }

  // Fetch verified credentials count
  const { count: verifiedCredentials } = await supabase
    .from('credentials')
    .select('*', { count: 'exact', head: true })
    .eq('contractor_id', id)
    .eq('status', 'verified')

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, reviewer:reviewer_id(id, role, email)')
    .eq('reviewee_id', id)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const profile = contractor.profiles as { avatar_url: string | null; email: string }
  const typeLabel =
    CONTRACTOR_TYPE_LABELS[
      contractor.contractor_type as keyof typeof CONTRACTOR_TYPE_LABELS
    ] || contractor.contractor_type

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/facility/contractors"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to search
      </Link>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {contractor.first_name?.[0]}
                {contractor.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">
                    {contractor.first_name} {contractor.last_name}
                  </h1>
                  <p className="text-muted-foreground">{typeLabel}</p>
                  {contractor.headline && (
                    <p className="mt-1">{contractor.headline}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href={`/messages?start=${id}`}>
                    <Button variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {contractor.average_rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">
                      {contractor.average_rating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      ({contractor.total_reviews} reviews)
                    </span>
                  </div>
                )}
                {(contractor.city || contractor.state) && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {[contractor.city, contractor.state]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {contractor.years_of_experience} years experience
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {verifiedCredentials || 0} verified credentials
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Bio */}
          {contractor.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{contractor.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Specialties */}
          {contractor.specialties && contractor.specialties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {contractor.specialties.map((s: string) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        {review.title && (
                          <span className="font-medium">{review.title}</span>
                        )}
                      </div>
                      {review.content && (
                        <p className="text-sm text-muted-foreground">
                          {review.content}
                        </p>
                      )}
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No reviews yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {contractor.hourly_rate_min || contractor.hourly_rate_max ? (
                <p className="text-2xl font-bold">
                  {contractor.hourly_rate_min &&
                    formatCurrency(contractor.hourly_rate_min)}
                  {contractor.hourly_rate_max &&
                    ` - ${formatCurrency(contractor.hourly_rate_max)}`}
                  <span className="text-sm font-normal text-muted-foreground">
                    /hr
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">Rate not specified</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={contractor.is_available ? 'default' : 'secondary'}
                className={
                  contractor.is_available
                    ? 'bg-green-100 text-green-800'
                    : ''
                }
              >
                {contractor.is_available ? 'Available' : 'Not Available'}
              </Badge>
              {contractor.willing_to_travel && (
                <p className="text-sm text-muted-foreground mt-2">
                  Willing to travel
                  {contractor.travel_radius_miles &&
                    ` (${contractor.travel_radius_miles} mi radius)`}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jobs Completed</span>
                <span className="font-medium">
                  {contractor.total_jobs_completed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Experience</span>
                <span className="font-medium">
                  {contractor.years_of_experience} years
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
