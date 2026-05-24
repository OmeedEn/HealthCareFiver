import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StarRating } from '@/components/reviews/star-rating'
import { formatDate } from '@/lib/utils/format'
import { getInitials } from '@/lib/utils/format'

interface CategoryRatings {
  professionalism?: number
  communication?: number
  skill?: number
  punctuality?: number
}

export interface ReviewData {
  id: string
  rating: number
  title: string
  content: string
  reviewer_first_name: string
  reviewer_last_name: string
  created_at: string
  category_ratings?: CategoryRatings
}

interface ReviewCardProps {
  review: ReviewData
}

const categoryLabels: Record<string, string> = {
  professionalism: 'Professionalism',
  communication: 'Communication',
  skill: 'Skill',
  punctuality: 'Punctuality',
}

export function ReviewCard({ review }: ReviewCardProps) {
  const initials = getInitials(review.reviewer_first_name, review.reviewer_last_name)
  const reviewerName = `${review.reviewer_first_name} ${review.reviewer_last_name}`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{review.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {reviewerName} &middot; {formatDate(review.created_at)}
              </p>
            </div>
          </div>
          <StarRating value={review.rating} size="sm" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{review.content}</p>

        {review.category_ratings && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(review.category_ratings).map(([key, val]) =>
              val != null ? (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {categoryLabels[key] ?? key}
                  </span>
                  <StarRating value={val} size="sm" />
                </div>
              ) : null
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
