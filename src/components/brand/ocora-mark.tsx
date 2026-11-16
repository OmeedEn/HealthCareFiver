import { cn } from '@/lib/utils'

/**
 * The Ocora mark: a rounded "plus" (care) with a small dot that echoes the
 * period in the "Ocora." wordmark. Decorative — pair it with visible text or
 * an aria-label on the surrounding link.
 *
 * tone="brand": blue tile, white plus (default, on paper backgrounds)
 * tone="ink":   ink tile, paper plus (footer / dark-on-light alternative)
 */
export function OcoraMark({
  className,
  tone = 'brand',
}: {
  className?: string
  tone?: 'brand' | 'ink'
}) {
  const tile = tone === 'ink' ? '#1a1a17' : '#2f3cf5'
  const plus = tone === 'ink' ? '#f6f4ef' : '#ffffff'
  const dot = tone === 'ink' ? '#2f3cf5' : '#b4bbff'
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <rect width="64" height="64" rx="16" fill={tile} />
      <path
        fill={plus}
        d="M27 17a5 5 0 0 1 10 0v10h10a5 5 0 0 1 0 10H37v10a5 5 0 0 1-10 0V37H17a5 5 0 0 1 0-10h10z"
      />
      <circle cx="47" cy="17" r="5" fill={dot} />
    </svg>
  )
}
