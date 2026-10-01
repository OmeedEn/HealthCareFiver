'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LookingForForm } from '@/app/onboarding/organization/sections/looking-for-form'
import type { LookingForData } from '@/app/onboarding/organization/shared'

/** The org's "looking for" profile (spec step 5 C), editable any time. */
export function LookingForCard({ initial }: { initial: LookingForData }) {
  const router = useRouter()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Professionals you&apos;re looking for</CardTitle>
        <CardDescription>We use this to suggest matching professionals.</CardDescription>
      </CardHeader>
      <CardContent>
        <LookingForForm initial={initial} onSaved={() => router.refresh()} />
      </CardContent>
    </Card>
  )
}
