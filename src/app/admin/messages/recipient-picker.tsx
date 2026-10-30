'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MessageSquarePlusIcon, SearchIcon } from 'lucide-react'

interface Recipient {
  id: string
  name: string
  email: string | null
  role: string | null
}

export function RecipientPicker({ recipients }: { recipients: Recipient[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const router = useRouter()

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term
      ? recipients.filter((r) =>
          `${r.name} ${r.email ?? ''} ${r.role ?? ''}`.toLowerCase().includes(term)
        )
      : recipients
    return list.slice(0, 50)
  }, [q, recipients])

  return (
    <>
      <Button className="bg-[#1dbf73] text-white hover:bg-[#19a463]" onClick={() => setOpen(true)}>
        <MessageSquarePlusIcon className="size-4" data-icon="inline-start" />
        New message
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="font-sans">
          <DialogHeader>
            <DialogTitle className="text-[#404145]">Message a user</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6b7280]" />
            <Input
              autoFocus
              placeholder="Search by name, email or role"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="py-6 text-center text-sm text-[#62646a]">No matching users</li>
            ) : (
              matches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/messages/${r.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-[#f7f7f7]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#404145]">
                        {r.name !== '—' ? r.name : r.email ?? r.id}
                      </span>
                      {r.email && <span className="block truncate text-xs text-[#62646a]">{r.email}</span>}
                    </span>
                    {r.role && <span className="shrink-0 text-xs text-[#9ca3af]">{r.role}</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
