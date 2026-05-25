'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StarRating } from '@/components/reviews/star-rating'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ReviewFormProps {
  contractId: string
  revieweeId: string
  onSuccess?: () => void
}

const categoryLabels = [
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'communication', label: 'Communication' },
  { key: 'skill', label: 'Skill' },
  { key: 'punctuality', label: 'Punctuality' },
] as const

export function ReviewForm({ contractId, revieweeId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({
    professionalism: 0,
    communication: 0,
    skill: 0,
    punctuality: 0,
  })
  const [submitting, setSubmitting] = useState(false)

  function handleCategoryChange(key: string, value: number) {
    setCategoryRatings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (rating === 0) {
      toast.error('Please select an overall rating')
      return
    }
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setSubmitting(true)

    if (isDemoMode()) {
      toast.success('Review submitted successfully (demo mode)')
      setRating(0)
      setTitle('')
      setContent('')
      setCategoryRatings({
        professionalism: 0,
        communication: 0,
        skill: 0,
        punctuality: 0,
      })
      setSubmitting(false)
      onSuccess?.()
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to submit a review')
        return
      }

      const { error } = await supabase.from('reviews').insert({
        contract_id: contractId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        title: title.trim(),
        content: content.trim(),
        category_ratings: categoryRatings,
      })

      if (error) throw error

      toast.success('Review submitted successfully')
      setRating(0)
      setTitle('')
      setContent('')
      setCategoryRatings({
        professionalism: 0,
        communication: 0,
        skill: 0,
        punctuality: 0,
      })
      onSuccess?.()
    } catch {
      toast.error('Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Overall Rating</Label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-title">Title</Label>
            <Input
              id="review-title"
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-content">Review</Label>
            <Textarea
              id="review-content"
              placeholder="Share details about your experience..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label>Category Ratings</Label>
            {categoryLabels.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <StarRating
                  value={categoryRatings[key] ?? 0}
                  onChange={(val) => handleCategoryChange(key, val)}
                  size="sm"
                />
              </div>
            ))}
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            Submit Review
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
