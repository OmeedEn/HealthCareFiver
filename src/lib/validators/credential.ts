import { z } from 'zod'

export const credentialUploadSchema = z.object({
  credential_type: z.string().min(1, 'Credential type is required'),
  name: z.string().min(1, 'Credential name is required'),
  issuing_authority: z.string().optional(),
  license_number: z.string().optional(),
  issued_date: z.string().optional(),
  expiration_date: z.string().optional(),
})

export type CredentialUploadInput = z.infer<typeof credentialUploadSchema>
