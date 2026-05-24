'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { formatCurrency, getInitials } from '@/lib/utils/format'
import { MapPin, Star, Clock } from 'lucide-react'

export interface ContractorProfileData {
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
  is_available: boolean
  average_rating: number | null
  total_reviews: number | null
  avatar_url?: string | null
}

interface ProfileCardProps {
  contractor: ContractorProfileData
  href?: string
}

export function ContractorProfileCard({ contractor, href }: ProfileCardProps) {
  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            {contractor.avatar_url && (
              <AvatarImage src={contractor.avatar_url} alt={`${contractor.first_name} ${contractor.last_name}`} />
            )}
            <AvatarFallback>
              {getInitials(contractor.first_name, contractor.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">
                {contractor.first_name} {contractor.last_name}
              </h3>
              <Badge variant={contractor.is_available ? 'default' : 'secondary'}>
                {contractor.is_available ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {CONTRACTOR_TYPE_LABELS[contractor.contractor_type] ?? contractor.contractor_type}
            </p>
            {contractor.headline && (
              <p className="text-sm mt-1 line-clamp-1">{contractor.headline}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {contractor.average_rating != null && (
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
              {contractor.average_rating.toFixed(1)}
              {contractor.total_reviews != null && (
                <span className="text-xs">({contractor.total_reviews})</span>
              )}
            </span>
          )}
          {(contractor.city || contractor.state) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {[contractor.city, contractor.state].filter(Boolean).join(', ')}
            </span>
          )}
          {contractor.hourly_rate_min != null && contractor.hourly_rate_max != null && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatCurrency(contractor.hourly_rate_min)} - {formatCurrency(contractor.hourly_rate_max)}/hr
            </span>
          )}
        </div>
        {contractor.specialties && contractor.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {contractor.specialties.slice(0, 5).map((specialty) => (
              <Badge key={specialty} variant="secondary">
                {specialty}
              </Badge>
            ))}
            {contractor.specialties.length > 5 && (
              <Badge variant="outline">+{contractor.specialties.length - 5}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}
