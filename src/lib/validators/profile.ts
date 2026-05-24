import { z } from 'zod'

export const contractorProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  contractor_type: z.string().min(1, 'Profession is required'),
  headline: z.string().max(200, 'Headline must be under 200 characters').optional(),
  bio: z.string().max(2000, 'Bio must be under 2000 characters').optional(),
  specialties: z.array(z.string()).default([]),
  years_of_experience: z.coerce.number().min(0).max(60).optional(),
  hourly_rate_min: z.coerce.number().min(0).optional(),
  hourly_rate_max: z.coerce.number().min(0).optional(),
  npi_number: z.string().regex(/^\d{10}$/, 'NPI must be 10 digits').optional().or(z.literal('')),
  state_license_number: z.string().optional(),
  license_state: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional().or(z.literal('')),
  willing_to_travel: z.boolean().default(false),
  travel_radius_miles: z.coerce.number().min(0).optional(),
  is_available: z.boolean().default(true),
})

export const facilityProfileSchema = z.object({
  facility_name: z.string().min(1, 'Facility name is required'),
  facility_type: z.string().min(1, 'Facility type is required'),
  description: z.string().max(2000).optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z.string().optional(),
  contact_name: z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
})

export type ContractorProfileInput = z.infer<typeof contractorProfileSchema>
export type FacilityProfileInput = z.infer<typeof facilityProfileSchema>
