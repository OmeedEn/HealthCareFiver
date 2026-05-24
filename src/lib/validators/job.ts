import { z } from 'zod'

export const jobPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  contractor_type: z.string().min(1, 'Contractor type is required'),
  specialties_required: z.array(z.string()).default([]),
  job_type: z.string().min(1, 'Job type is required'),
  shift_type: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  positions_available: z.coerce.number().min(1).default(1),

  // Location
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().optional(),
  is_remote: z.boolean().default(false),

  // Compensation
  pay_rate_min: z.coerce.number().min(0, 'Minimum pay rate is required'),
  pay_rate_max: z.coerce.number().min(0).optional(),
  pay_rate_type: z.enum(['hourly', 'daily', 'weekly', 'per_contract']).default('hourly'),
  overtime_rate: z.coerce.number().min(0).optional(),
  travel_reimbursement: z.boolean().default(false),
  housing_provided: z.boolean().default(false),

  // Schedule
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  shifts_per_week: z.coerce.number().min(1).optional(),
  hours_per_shift: z.coerce.number().min(1).optional(),

  // Requirements
  years_experience_min: z.coerce.number().min(0).default(0),
  required_credentials: z.array(z.string()).default([]),
  required_certifications: z.array(z.string()).default([]),
  additional_requirements: z.string().max(2000).optional(),
})

export const jobApplicationSchema = z.object({
  job_id: z.string().uuid(),
  cover_letter: z.string().max(2000).optional(),
  proposed_rate: z.coerce.number().min(0).optional(),
  available_start_date: z.string().optional(),
})

export type JobPostInput = z.infer<typeof jobPostSchema>
export type JobApplicationInput = z.infer<typeof jobApplicationSchema>
