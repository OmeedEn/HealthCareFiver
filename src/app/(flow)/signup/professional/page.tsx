import type { Metadata } from 'next'
import { ProfessionalSignupFlow } from './flow'

export const metadata: Metadata = { title: 'Join as a professional | Sanus' }

/**
 * Professional signup, screens 1–4 (Single-Question Onboarding spec):
 * category, profession, license / certifying organization / link, then the
 * account. Answers stay in this browser tab until the account screen sends
 * them; screens 5–8 continue at /onboarding/professional.
 */
export default function ProfessionalSignupPage() {
  return <ProfessionalSignupFlow />
}
