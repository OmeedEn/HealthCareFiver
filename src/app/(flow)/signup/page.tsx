import type { Metadata } from 'next'
import { parseSignupStart } from '@/lib/onboarding/signup-start'
import { SignupFlow } from './signup-flow'

export const metadata: Metadata = { title: 'Join Sanus' }

// One continuous signup flow: routing questions, the chosen path's
// questions, then the account (see ./signup-flow.tsx). `?start=` opens it at
// a door or a path; the old door URLs redirect here with it.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return <SignupFlow start={parseSignupStart((await searchParams).start)} />
}
