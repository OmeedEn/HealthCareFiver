import { z } from 'zod'

export const contractSchema = z.object({
  job_id: z.string().uuid().optional(),
  application_id: z.string().uuid().optional(),
  contractor_id: z.string().uuid(),
  title: z.string().min(1, 'Contract title is required'),
  description: z.string().optional(),
  agreed_rate: z.coerce.number().min(0, 'Rate is required'),
  rate_type: z.enum(['hourly', 'daily', 'weekly', 'per_contract']).default('hourly'),
  overtime_rate: z.coerce.number().min(0).optional(),
  estimated_hours: z.coerce.number().min(0).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  shift_type: z.string().optional(),
  shifts_per_week: z.coerce.number().min(1).optional(),
  hours_per_shift: z.coerce.number().min(1).optional(),
})

export const timesheetSchema = z.object({
  contract_id: z.string().uuid(),
  shift_date: z.string().min(1, 'Shift date is required'),
  clock_in: z.string().min(1, 'Clock-in time is required'),
  clock_out: z.string().optional(),
  break_minutes: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional(),
})

export type ContractInput = z.infer<typeof contractSchema>
export type TimesheetInput = z.infer<typeof timesheetSchema>
