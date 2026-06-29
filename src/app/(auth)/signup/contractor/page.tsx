import { redirect } from 'next/navigation'

// The old "Healthcare Professional" signup has been replaced by the
// 6-step branching professional onboarding at /signup/professional.
// Anyone landing on the old URL gets redirected.
export default function ContractorRedirect() {
  redirect('/signup/professional')
}
