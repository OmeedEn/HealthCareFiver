import { z } from 'zod'

export const paymentCreateSchema = z.object({
  contract_id: z.string().uuid(),
  timesheet_id: z.string().uuid().optional(),
  gross_amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().optional(),
})

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
