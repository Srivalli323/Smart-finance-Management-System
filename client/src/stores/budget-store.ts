import { create } from "zustand";
import { BudgetStatus, Household } from "@/features/budget/budgetAPI";

interface BudgetStore {
  budgetStatus: BudgetStatus | null;
  household: Household | null;
  setBudgetStatus: (status: BudgetStatus | null) => void;
  setHousehold: (household: Household | null) => void;
  isOverBudget: boolean;
  setIsOverBudget: (over: boolean) => void;
}

export const useBudgetStore = create<BudgetStore>((set) => ({
  budgetStatus: null,
  household: null,
  isOverBudget: false,
  setBudgetStatus: (status) =>
    set({ budgetStatus: status, isOverBudget: status?.overBudget || false }),
  setHousehold: (household) => set({ household }),
  setIsOverBudget: (over) => set({ isOverBudget: over }),
}));

