'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ServiceForm } from '@/app/onboarding/organization/sections/service-form'
import { EventForm } from '@/app/onboarding/organization/sections/event-form'
import { deleteOrgListing } from './actions'

/** "Add a service" / "Add an event" using the same forms as onboarding step 5. */
export function AddListing() {
  const router = useRouter()
  const [open, setOpen] = useState<'service' | 'event' | null>(null)
  const saved = () => {
    setOpen(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={open === 'service' ? 'default' : 'outline'} onClick={() => setOpen(open === 'service' ? null : 'service')}>
          <Plus className="mr-1.5 size-4" /> Add a service
        </Button>
        <Button type="button" variant={open === 'event' ? 'default' : 'outline'} onClick={() => setOpen(open === 'event' ? null : 'event')}>
          <Plus className="mr-1.5 size-4" /> Add an event
        </Button>
      </div>
      {open && (
        <Card>
          <CardContent className="pt-6">
            {open === 'service' ? <ServiceForm onSaved={saved} /> : <EventForm onSaved={saved} />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function DeleteListingButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete draft"
      onClick={async () => {
        setBusy(true)
        const res = await deleteOrgListing(id)
        setBusy(false)
        if (!res.ok) toast.error(res.error ?? 'Could not delete')
      }}
      className="text-[#95979d] hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  )
}
