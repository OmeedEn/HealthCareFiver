/**
 * The jobs table stores hourly_rate_min/max, years_experience_required and
 * hours_per_week. The job detail UIs were written against pay_rate_* /
 * years_experience_min / shifts × hours names that never existed in the
 * database, so a raw `select('*')` row left those fields undefined. Map a raw
 * row onto the UI shape in one place.
 */
export function normalizeJobRow<T>(row: Record<string, unknown>): T {
  return {
    ...row,
    pay_rate_min: (row.hourly_rate_min as number | null) ?? null,
    pay_rate_max: (row.hourly_rate_max as number | null) ?? null,
    pay_rate_type: 'hourly',
    years_experience_min: (row.years_experience_required as number | null) ?? null,
    hours_per_week: (row.hours_per_week as number | null) ?? null,
    shifts_per_week: null,
    hours_per_shift: null,
    // Credentials and certifications share required_certifications.
    required_credentials: null,
  } as T
}
