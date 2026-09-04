// types/sale.ts
import { z } from "zod";

export const SaleDetailsSchema = z.object({
  // Pre-filled fields (from existing sale)
  clientName: z.string().min(1),
  leadSource: z.string().min(1),
  saleDate: z.string().datetime(),
  saleAmount: z.number().positive(),

  // VA-editable fields
  fundedDate: z.string().datetime().optional(),
  financeProvider: z.string().min(1, "Required").optional(),
  interestRate: z.number().min(0).max(100).optional(),
  stockNumber: z.string().min(1, "Required").optional(),
  vehicle: z.string().optional(),
  amountFunded: z.number().positive().optional(),
  tradeDescription: z.string().optional(),
  lienAmount: z.number().min(0).optional(),
  adminFee: z.number().min(0).optional(),
  // ... include all other fields with appropriate validation
});

export type SaleDetails = z.infer<typeof SaleDetailsSchema>;
export type SaleDetailsFormData = Partial<SaleDetails>;
