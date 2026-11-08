import { Info } from 'lucide-react'
import { NOT_EMPLOYER_NOTICE } from '@/lib/onboarding/organization'

/** Required on every spec staffing post (Organization Onboarding spec). */
export function NotEmployerNotice() {
  return (
    <div className="flex gap-2 rounded-lg border border-[#c9cdfb] bg-[#eceefe] p-3 text-sm text-[#2330c8]">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{NOT_EMPLOYER_NOTICE}</p>
    </div>
  )
}
