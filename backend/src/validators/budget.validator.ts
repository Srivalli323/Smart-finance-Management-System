import { z } from "zod";

export const updateBudgetLimitSchema = z.object({
  monthlyBudgetLimit: z.number().min(0, "Budget limit must be positive"),
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required"),
  monthlyBudgetLimit: z.number().min(0).optional().default(0),
});

export const joinHouseholdSchema = z.object({
  householdId: z.string().min(1, "Household ID is required"),
});

export type UpdateBudgetLimitType = z.infer<typeof updateBudgetLimitSchema>;
export type CreateHouseholdType = z.infer<typeof createHouseholdSchema>;
export type JoinHouseholdType = z.infer<typeof joinHouseholdSchema>;

