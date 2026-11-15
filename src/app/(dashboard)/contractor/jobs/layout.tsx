import { redirect } from 'next/navigation'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'

// Browsing and applying to staffing posts is part of the separate staffing
// product (same legal review as posting them), so it stays off until
// NEXT_PUBLIC_STAFFING_POSTS_ENABLED is turned on. The marketplace dashboard
// shows relevant next actions instead of job recommendations.
export default function ContractorJobsLayout({ children }: { children: React.ReactNode }) {
  if (!STAFFING_POSTS_ENABLED) redirect('/dashboard')
  return children
}
