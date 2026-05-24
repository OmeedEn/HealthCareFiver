import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const contractorSignupSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    contractor_type: z.string().min(1, 'Please select your profession'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const facilitySignupSchema = z
  .object({
    facility_name: z.string().min(1, 'Facility name is required'),
    facility_type: z.string().min(1, 'Please select facility type'),
    contact_name: z.string().min(1, 'Contact name is required'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip_code: z
      .string()
      .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ContractorSignupInput = z.infer<typeof contractorSignupSchema>
export type FacilitySignupInput = z.infer<typeof facilitySignupSchema>
