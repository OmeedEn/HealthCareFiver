import { redirect } from 'next/navigation'

// The old "Healthcare Facility" signup. Organizations now pick their door
// (practice or company) on /signup/offer before the organization flow.
export default function FacilityRedirect() {
  redirect('/signup/offer')
}
