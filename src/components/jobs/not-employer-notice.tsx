import { Info } from 'lucide-react'
import { NOT_EMPLOYER_NOTICE } from '@/lib/onboarding/organization'

/** Required on every spec staffing post (Organization Onboarding spec). */
export function NotEmployerNotice() {
  return (
    <div className="flex gap-2 rounded-lg border border-[#bcebd5] bg-[#e8faf1] p-3 text-sm text-[#0f8f56]">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{NOT_EMPLOYER_NOTICE}</p>
    </div>
  )
}
