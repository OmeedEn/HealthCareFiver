import { redirect } from 'next/navigation'

// The old "Healthcare Facility" signup. Organizations now pick their door
// (practice or company) on the "How do you work?" screen of /signup.
export default function FacilityRedirect() {
  redirect('/signup?start=offer')
}
