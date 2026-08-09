import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Star } from 'lucide-react'
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

interface ReviewData {
  id: string
  rating: number
  title: string
  content: string
  reviewer_first_name: string
  reviewer_last_name: string
  created_at: string
  category_ratings?: Record<string, number>
}

export default async function FacilityReviewsPage() {
  let reviews: ReviewData[] = []

  if (isDemoMode()) {
    reviews = DEMO_REVIEWS.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      rating: r.rating as number,
      title: r.title as string,
      content: r.content as string,
      reviewer_first_name:
        (r.reviewer as Record<string, string>)?.first_name ?? 'Anonymous',
      reviewer_last_name:
        (r.reviewer as Record<string, string>)?.last_name ?? '',
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
      .select(
        'id, rating, title, content, category_ratings, created_at, profiles!reviewer_id(first_name, last_name)',
      )
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
  const roundedAverage = Math.round(averageRating)

  // Star breakdown by rating (5 to 1)
  const breakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => Math.round(r.rating) === stars).length
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
    return { stars, count, pct }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Reviews</h1>
        <p className="text-[#62646a]">
          Feedback from contractors who have worked at your facility
        </p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
              <Star className="size-6 text-[#1dbf73]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#404145]">
              No reviews yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-[#62646a]">
              Reviews from completed contracts will appear here once contractors
              share their experience
            </p>
            <Link
              href="/facility/jobs"
              className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-[#1dbf73] px-4 text-sm font-medium text-white transition-colors hover:bg-[#19a463]"
            >
              Manage jobs
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-8">
              <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <p className="text-4xl font-bold text-[#404145]">
                    {averageRating.toFixed(1)}
                  </p>
                  <div className="mt-2 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={
                          i < roundedAverage
                            ? 'size-5 fill-[#fbbf24] text-[#fbbf24]'
                            : 'size-5 text-[#e5e7eb]'
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[#62646a]">
                    {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                  </p>
                </div>

                <div className="space-y-2">
                  {breakdown.map((row) => (
                    <div
                      key={row.stars}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="flex w-8 items-center gap-0.5 text-[#62646a]">
                        {row.stars}
                        <Star className="size-3 fill-[#fbbf24] text-[#fbbf24]" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8faf1]">
                        <div
                          className="h-full rounded-full bg-[#1dbf73]"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-[#62646a]">
                        {row.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-[#404145]">
              All reviews
            </h2>
            <div className="space-y-4">
              {reviews.map((review) => {
                const reviewerName =
                  `${review.reviewer_first_name} ${review.reviewer_last_name}`.trim() ||
                  'Anonymous'
                const reviewRounded = Math.round(review.rating)
                const dateStr = new Date(review.created_at).toLocaleDateString(
                  'en-US',
                  { year: 'numeric', month: 'short', day: 'numeric' },
                )

                return (
                  <Card key={review.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-[#404145]">
                          {reviewerName}
                        </CardTitle>
                        {review.title && (
                          <p className="text-sm text-[#404145]">
                            {review.title}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-xs text-[#62646a]">
                        {dateStr}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={
                              i < reviewRounded
                                ? 'size-4 fill-[#fbbf24] text-[#fbbf24]'
                                : 'size-4 text-[#e5e7eb]'
                            }
                          />
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-[#404145]">
                        {review.content}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
