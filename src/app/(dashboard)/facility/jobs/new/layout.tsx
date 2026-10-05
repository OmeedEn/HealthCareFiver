import { redirect } from 'next/navigation'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'

// Job posting has the same legal exposure as spec staffing posts, so it stays
// off until NEXT_PUBLIC_STAFFING_POSTS_ENABLED is turned on.
export default function NewJobLayout({ children }: { children: React.ReactNode }) {
  if (!STAFFING_POSTS_ENABLED) redirect('/facility/jobs')
  return children
}
