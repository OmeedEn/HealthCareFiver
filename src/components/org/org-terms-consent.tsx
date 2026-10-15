'use client'

import { ORG_AGREEMENT_PATH, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'

const LINK = 'font-semibold underline hover:text-[#404145]'

/**
 * The organization account screen's one consent checkbox: Terms of Service,
 * Privacy Policy, and Organization Terms (the Organization Agreement).
 * Links open in a new tab so the half-filled screen isn't lost.
 */
export function OrgTermsConsent({
  checked,
  onChange,
  id = 'accept-org-terms',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[#c5c6c9] accent-[#1dbf73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-5 text-[#62646a]">
        I agree to the{' '}
        <a href={TERMS_PATH} target="_blank" rel="noopener noreferrer" className={LINK}>
          Terms of Service
        </a>
        ,{' '}
        <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className={LINK}>
          Privacy Policy
        </a>
        , and{' '}
        <a href={ORG_AGREEMENT_PATH} target="_blank" rel="noopener noreferrer" className={LINK}>
          Organization Terms
        </a>
        .
      </label>
    </div>
  )
}
