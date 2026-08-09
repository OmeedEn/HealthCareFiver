'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Briefcase, Building2, Shield } from 'lucide-react'

type DemoRole = 'contractor' | 'facility' | 'admin'

interface DemoRoleSwitcherProps {
  current: DemoRole
}

const ROLES: { value: DemoRole; label: string; icon: React.ElementType }[] = [
  { value: 'contractor', label: 'Contractor', icon: Briefcase },
  { value: 'facility', label: 'Facility', icon: Building2 },
  { value: 'admin', label: 'Admin', icon: Shield },
]

/**
 * Persists the chosen demo role to a `demo_role` cookie and refreshes the
 * route so both the layout (sidebar nav) and the dashboard page pick it up.
 * Only rendered when isDemoMode() is true on the server.
 */
export function DemoRoleSwitcher({ current }: DemoRoleSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function setRole(role: DemoRole) {
    if (role === current) return
    // 1 day TTL is plenty for a demo session; path=/ so layout + nested
    // routes all see the same value.
    document.cookie = `demo_role=${role}; path=/; max-age=86400; SameSite=Lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e5e7] bg-white p-1 text-sm shadow-sm">
      <span className="ml-2 mr-1 hidden text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:inline">
        View as
      </span>
      {ROLES.map((r) => {
        const Icon = r.icon
        const active = r.value === current
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => setRole(r.value)}
            disabled={pending}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#e8faf1] text-[#0f8f56]'
                : 'text-[#62646a] hover:bg-[#f7f7f7] hover:text-[#404145]'
            } disabled:opacity-60`}
          >
            <Icon className="size-3.5" />
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
