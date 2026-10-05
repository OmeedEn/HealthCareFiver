'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileSignature, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ORG_AGREEMENT_PATH } from '@/lib/legal'
import { acceptOrgAgreement } from '@/app/(dashboard)/facility/listings/actions'

/** Shown to approved orgs until they accept the organization agreement. */
export function OrgAgreementCard() {
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  async function accept() {
    setSaving(true)
    const res = await acceptOrgAgreement()
    setSaving(false)
    if (!res.ok) toast.error(res.error)
    else toast.success('Agreement accepted — you can submit listings for review')
  }

  return (
    <Card className="border-[#bcebd5] bg-[#f3fcf7]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#0f8f56]">
          <FileSignature className="size-5" />
          One more step before you publish
        </CardTitle>
        <CardDescription>
          Accept the Organization Agreement before your first listing or post goes live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-[#404145]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#1dbf73]"
          />
          <span>
            I agree to the{' '}
            <Link href={ORG_AGREEMENT_PATH} target="_blank" className="font-semibold text-[#0f8f56] underline">
              Organization Agreement
            </Link>{' '}
            on behalf of my organization.
          </span>
        </label>
        <Button type="button" onClick={accept} disabled={!checked || saving} className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Accept agreement
        </Button>
      </CardContent>
    </Card>
  )
}
