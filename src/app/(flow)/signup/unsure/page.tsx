import type { Metadata } from 'next'
import { UnsureSignupFlow } from './flow'

export const metadata: Metadata = { title: 'Tell us what you do — Sanus' }

export default function UnsureSignupPage() {
  return <UnsureSignupFlow />
}
