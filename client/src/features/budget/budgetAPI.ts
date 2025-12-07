import { apiClient } from "@/app/api-client";

export interface BudgetStatus {
  totalSpentThisMonth: number;
  budgetLimit: number;
  remaining: number;
  overBudget: boolean;
  percentageUsed: number;
}

export interface Budget {
  _id: string;
  type: "USER" | "HOUSEHOLD";
  monthlyLimit: number;
  name: string;
  isActive: boolean;
  userId?: string;
  householdId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  _id: string;
  name: string;
  monthlyBudgetLimit: number;
  members: Array<{
    userId: {
      _id: string;
      name: string;
      email: string;
      profilePicture?: string;
    };
    role: "OWNER" | "MEMBER" | "VIEWER";
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetInput {
  type: "USER" | "HOUSEHOLD";
  monthlyLimit: number;
  name: string;
  householdId?: string;
}

export interface UpdateBudgetInput {
  monthlyLimit?: number;
  name?: string;
  isActive?: boolean;
}

export interface BudgetResponse {
  success: boolean;
  data: BudgetStatus | Budget | Budget[] | { userBudgets: Budget[]; householdBudgets: Budget[] };
  message?: string;
}

export interface HouseholdResponse {
  success: boolean;
  data: Household | null;
}

export const budgetApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    // Get all budgets for user
    getUserBudgets: builder.query<{ userBudgets: Budget[]; householdBudgets: Budget[] }, void>({
      query: () => ({
        url: "/budget",
        method: "GET",
      }),
      providesTags: ["budget"],
    }),

    // Get budget by ID
    getBudgetById: builder.query<Budget, string>({
      query: (budgetId) => ({
        url: `/budget/${budgetId}`,
        method: "GET",
      }),
      providesTags: (result, error, budgetId) => [{ type: "budget", id: budgetId }],
    }),

    // Get budget status
    getBudgetStatus: builder.query<BudgetStatus, string>({
      query: (budgetId) => ({
        url: `/budget/${budgetId}/status`,
        method: "GET",
      }),
      providesTags: (result, error, budgetId) => [{ type: "budget", id: budgetId }],
    }),

    // Create budget
    createBudget: builder.mutation<Budget, CreateBudgetInput>({
      query: (body) => ({
        url: "/budget/create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["budget"],
    }),

    // Update budget
    updateBudget: builder.mutation<Budget, { budgetId: string; data: UpdateBudgetInput }>({
      query: ({ budgetId, data }) => ({
        url: `/budget/${budgetId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { budgetId }) => [
        { type: "budget", id: budgetId },
        "budget",
      ],
    }),

    // Delete budget
    deleteBudget: builder.mutation<void, string>({
      query: (budgetId) => ({
        url: `/budget/${budgetId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["budget"],
    }),

    // Legacy: Get budget status by household
    getBudgetStatusByHousehold: builder.query<BudgetStatus, string>({
      query: (householdId) => ({
        url: `/budget/status/${householdId}`,
        method: "GET",
      }),
      providesTags: ["budget"],
    }),

    // Legacy: Get user household
    getUserHousehold: builder.query<Household | null, void>({
      query: () => ({
        url: "/budget/household",
        method: "GET",
      }),
      providesTags: ["household"],
    }),

    // Legacy: Update household budget limit
    updateBudgetLimit: builder.mutation<
      Household,
      { householdId: string; monthlyBudgetLimit: number }
    >({
      query: ({ householdId, monthlyBudgetLimit }) => ({
        url: `/budget/limit/${householdId}`,
        method: "PUT",
        body: { monthlyBudgetLimit },
      }),
      invalidatesTags: ["budget", "household"],
    }),

    // Legacy: Create household
    createHousehold: builder.mutation<
      Household,
      { name: string; monthlyBudgetLimit?: number }
    >({
      query: (body) => ({
        url: "/budget/household/create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["household"],
    }),

    // Legacy: Join household
    joinHousehold: builder.mutation<Household, { householdId: string }>({
      query: (body) => ({
        url: "/budget/household/join",
        method: "POST",
        body,
      }),
      invalidatesTags: ["household"],
    }),
  }),
});

export const {
  useGetUserBudgetsQuery,
  useGetBudgetByIdQuery,
  useGetBudgetStatusQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useDeleteBudgetMutation,
  useGetBudgetStatusByHouseholdQuery,
  useGetUserHouseholdQuery,
  useUpdateBudgetLimitMutation,
  useCreateHouseholdMutation,
  useJoinHouseholdMutation,
} = budgetApi;
