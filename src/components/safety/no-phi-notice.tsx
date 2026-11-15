import { ShieldAlert } from 'lucide-react'

/**
 * No-patient-information boundary (evaluation P0.3). Shown before free-text
 * entry. Pass `id` and point the field's `aria-describedby` at it so screen
 * readers hear it with the field.
 */
export const NO_PHI_TEXT =
  'Please do not submit medical records, diagnoses, test results, medications, insurance numbers, or other patient information. Sanus is a marketplace for wellness and health expertise, not an emergency or clinical-record service.'

/**
 * Client-facing emergency routing. Points people to public services only;
 * it must never suggest Sanus monitors, triages, dispatches, or responds.
 */
export const EMERGENCY_ROUTING_TEXT =
  'Sanus is not an emergency service and does not monitor messages for emergencies. If you or someone else is in immediate danger or has an emergency medical need, call 911. For suicidal thoughts or an emotional crisis in the U.S., call or text 988 (Suicide & Crisis Lifeline).'

function EmergencyLine() {
  return (
    <>
      Sanus is not an emergency service and does not monitor messages for emergencies. If you or someone else
      is in immediate danger or has an emergency medical need, call{' '}
      <a href="tel:911" className="font-semibold underline underline-offset-2">
        911
      </a>
      . For suicidal thoughts or an emotional crisis in the U.S., call or text{' '}
      <a href="tel:988" className="font-semibold underline underline-offset-2">
        988
      </a>{' '}
      (Suicide &amp; Crisis Lifeline).
    </>
  )
}

export function NoPhiNotice({
  id,
  audience = 'client',
  variant = 'boxed',
  className = '',
}: {
  /** Target for the field's aria-describedby. */
  id?: string
  /** 'client' adds the 911 / 988 line; 'general' is the no-PHI line only. */
  audience?: 'client' | 'general'
  /** 'boxed' for forms and dialogs; 'compact' for tight composers. */
  variant?: 'boxed' | 'compact'
  className?: string
}) {
  if (variant === 'compact') {
    return (
      <p id={id} className={`text-xs leading-relaxed text-[#5f5d57] ${className}`}>
        {NO_PHI_TEXT}
        {audience === 'client' && (
          <>
            {' '}
            <EmergencyLine />
          </>
        )}
      </p>
    )
  }
  return (
    <div
      id={id}
      role="note"
      className={`flex gap-2.5 rounded-lg border border-[#e3dfd6] bg-[#f6f4ef] p-3 text-xs leading-relaxed text-[#3a3934] sm:text-sm ${className}`}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#5f5d57]" aria-hidden />
      <div className="space-y-1.5">
        <p>{NO_PHI_TEXT}</p>
        {audience === 'client' && (
          <p>
            <EmergencyLine />
          </p>
        )}
      </div>
    </div>
  )
}
