import { redirect } from 'next/navigation'

// The old "Healthcare Facility" signup has been replaced by the
// 4-step organization onboarding at /signup/organization.
export default function FacilityRedirect() {
  redirect('/signup/organization')
}
