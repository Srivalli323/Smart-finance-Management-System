import { apiClient } from "@/app/api-client";

export interface Alert {
  _id: string;
  userId: string;
  budgetId: {
    _id: string;
    name: string;
    type: "USER" | "HOUSEHOLD";
  };
  householdId?: {
    _id: string;
    name: string;
  };
  alertType: "EMAIL" | "SMS";
  threshold: number;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt?: string;
  errorMessage?: string;
  metadata?: {
    currentSpending: number;
    budgetLimit: number;
    percentageUsed: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GetAlertsParams {
  budgetId?: string;
  status?: "PENDING" | "SENT" | "FAILED";
  threshold?: number;
  limit?: number;
}

export const alertApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    // Get user's alerts
    getUserAlerts: builder.query<Alert[], GetAlertsParams | void>({
      query: (params = {}) => ({
        url: "/alerts",
        method: "GET",
        params,
      }),
      providesTags: ["alerts"],
    }),

    // Mark alert as read
    markAlertAsRead: builder.mutation<Alert, string>({
      query: (alertId) => ({
        url: `/alerts/${alertId}/read`,
        method: "PUT",
      }),
      invalidatesTags: ["alerts"],
    }),

    // Trigger budget check (for testing)
    triggerBudgetCheck: builder.mutation<void, string>({
      query: (budgetId) => ({
        url: `/alerts/check/${budgetId}`,
        method: "POST",
      }),
      invalidatesTags: ["alerts", "budget"],
    }),
  }),
});

export const {
  useGetUserAlertsQuery,
  useMarkAlertAsReadMutation,
  useTriggerBudgetCheckMutation,
} = alertApi;

