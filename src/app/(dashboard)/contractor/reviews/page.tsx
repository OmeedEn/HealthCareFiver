import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReviewCard, type ReviewData } from '@/components/reviews/review-card'
import { StarRating } from '@/components/reviews/star-rating'
import { Star, MessageSquare } from 'lucide-react'
import { isDemoMode, DEMO_REVIEWS } from '@/lib/demo/data'

interface ReviewRow {
  id: string
  rating: number
  title: string
  content: string
  category_ratings: Record<string, number> | null
  created_at: string
  profiles: {
    first_name: string
    last_name: string
  } | null
}

export default async function ContractorReviewsPage() {
  let reviews: ReviewData[] = []

  if (isDemoMode()) {
    reviews = DEMO_REVIEWS.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      rating: r.rating as number,
      title: r.title as string,
      content: r.content as string,
      reviewer_first_name: (r.reviewer as Record<string, string>)?.first_name ?? 'Anonymous',
      reviewer_last_name: (r.reviewer as Record<string, string>)?.last_name ?? '',
      created_at: r.created_at as string,
      category_ratings: r.category_ratings as Record<string, number> | undefined,
    }))
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, rating, title, content, category_ratings, created_at, profiles!reviewer_id(first_name, last_name)')
      .eq('reviewee_id', user.id)
      .order('created_at', { ascending: false })

    const reviewRows = (reviewData ?? []) as unknown as ReviewRow[]

    reviews = reviewRows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      reviewer_first_name: r.profiles?.first_name ?? 'Anonymous',
      reviewer_last_name: r.profiles?.last_name ?? '',
      created_at: r.created_at,
      category_ratings: r.category_ratings ?? undefined,
    }))
  }

  const totalReviews = reviews.length
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">My Reviews</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rating
            </CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">{averageRating.toFixed(1)}</p>
              <StarRating value={Math.round(averageRating)} size="sm" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reviews
            </CardTitle>
            <MessageSquare className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalReviews}</p>
          </CardContent>
        </Card>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium">No reviews yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reviews from completed contracts will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  )
}
