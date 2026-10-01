'use client'

import { useRouter } from 'next/navigation'
import { StaffingForm } from '@/app/onboarding/organization/sections/staffing-form'

export function NewNeedForm({ defaults }: { defaults: { city: string; state: string; zip_code: string } }) {
  const router = useRouter()
  return <StaffingForm defaults={defaults} onSaved={() => router.push('/facility/jobs')} />
}
