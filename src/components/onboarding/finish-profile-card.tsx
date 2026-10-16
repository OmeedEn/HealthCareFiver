import Link from 'next/link'
import { Check, ChevronRight, Lock } from 'lucide-react'
import {
  CHECKLIST_GROUPS,
  GROUP_ORDER,
  checklistPercent,
  type ChecklistItem,
  type GroupLabels,
} from '@/lib/onboarding/checklist'

const TAG_TONE = {
  red: 'bg-[#fdecec] text-[#b42318]',
  amber: 'bg-[#fff4e0] text-[#9a5b00]',
} as const

/**
 * The "Finish your profile" card pinned to the top of the dashboard: a
 * weighted progress bar and the open items by group. Finished items collapse
 * into a count so the card stays short. Renders nothing once everything's done.
 */
export function FinishProfileCard({
  items,
  title = 'Finish your profile',
  groupLabels,
}: {
  items: ChecklistItem[]
  title?: string
  groupLabels?: GroupLabels
}) {
  if (!items.length || items.every((i) => i.done)) return null
  const pct = checklistPercent(items)

  return (
    <section aria-labelledby="finish-profile-title" className="rounded-xl border border-[#e4e5e7] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="finish-profile-title" className="text-base font-semibold text-[#404145]">
          {title}
        </h2>
        <span className="text-sm font-semibold text-[#1dbf73]">{pct}%</span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${title}: ${pct}% complete`}
      >
        <div className="h-full rounded-full bg-[#1dbf73] transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-5 space-y-5">
        {GROUP_ORDER.map((g) => {
          const inGroup = items.filter((i) => i.group === g)
          if (!inGroup.length) return null
          const open = inGroup.filter((i) => !i.done)
          const doneCount = inGroup.length - open.length
          const cfg = CHECKLIST_GROUPS[g]
          return (
            <div key={g}>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#62646a]">
                  {groupLabels?.[g] ?? cfg.label}
                </h3>
                {cfg.tag && open.length > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_TONE[cfg.tag.tone]}`}>
                    {cfg.tag.text}
                  </span>
                )}
              </div>
              <ul className="mt-2 divide-y divide-[#f1f1f2]">
                {open.map((item) => (
                  <li key={item.id}>
                    {item.locked ? (
                      <div className="flex items-center gap-3 py-2.5 text-sm text-[#95979d]">
                        <Lock className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          {item.label}
                          {item.hint && <span className="block text-xs">{item.hint}</span>}
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className="group flex items-center gap-3 rounded-md py-2.5 text-sm text-[#404145] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
                      >
                        <span className="size-4 shrink-0 rounded-full border-2 border-[#c5c6c9]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium group-hover:text-[#1dbf73]">{item.label}</span>
                          {item.hint && <span className="block text-xs text-[#62646a]">{item.hint}</span>}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-[#95979d]" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {doneCount > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#0f8f56]">
                  <Check className="size-3.5" aria-hidden /> {doneCount} done
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
