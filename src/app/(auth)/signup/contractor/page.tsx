import { redirect } from 'next/navigation'

// The old "Healthcare Professional" signup has been replaced by the
// Independent professional path of /signup. Anyone landing on the old URL
// gets redirected.
export default function ContractorRedirect() {
  redirect('/signup?start=independent')
}
