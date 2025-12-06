import { useState } from "react";
import PageLayout from "@/components/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGetUserAlertsQuery,
  useMarkAlertAsReadMutation,
} from "@/features/alerts/alertAPI";
import { formatCurrency } from "@/lib/format-currency";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, XCircle, Mail, MessageSquare, Bell } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Alerts = () => {
  const [filters, setFilters] = useState<{
    status?: "PENDING" | "SENT" | "FAILED";
    threshold?: number;
  }>({});

  const { data: alerts = [], isLoading } = useGetUserAlertsQuery(filters);
  const [markAsRead] = useMarkAlertAsReadMutation();

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAsRead(alertId).unwrap();
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <Badge variant="outline" className="border-green-500 text-green-500">Sent</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pending</Badge>;
    }
  };

  const getThresholdBadge = (threshold: number) => {
    const colors = {
      70: "bg-blue-500",
      90: "bg-orange-500",
      100: "bg-red-500",
    };
    return (
      <Badge className={colors[threshold as keyof typeof colors] || "bg-gray-500"}>
        {threshold}%
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading alerts...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Alerts</CardTitle>
            <CardDescription>
              View and manage your budget alert notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value === "all" ? undefined : (value as "PENDING" | "SENT" | "FAILED"),
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.threshold?.toString() || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    threshold: value === "all" ? undefined : Number(value),
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by threshold" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Thresholds</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No alerts found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert._id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(alert.status)}
                        <CardTitle className="text-lg">
                          {alert.budgetId.name}
                        </CardTitle>
                        {getThresholdBadge(alert.threshold)}
                        {getStatusBadge(alert.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {alert.alertType === "EMAIL" ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                          <span>{alert.alertType}</span>
                        </div>
                        {alert.sentAt && (
                          <span>
                            {format(new Date(alert.sentAt), "MMM dd, yyyy 'at' HH:mm")}
                          </span>
                        )}
                        {alert.householdId && (
                          <span>Household: {alert.householdId.name}</span>
                        )}
                      </div>

                      {alert.metadata && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                          <div>
                            <div className="text-xs text-muted-foreground">Budget Limit</div>
                            <div className="font-semibold">
                              {formatCurrency(alert.metadata.budgetLimit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Current Spending</div>
                            <div
                              className={`font-semibold ${
                                alert.threshold === 100 && alert.metadata.percentageUsed >= 100
                                  ? "text-red-500"
                                  : alert.threshold >= 90
                                  ? "text-orange-500"
                                  : ""
                              }`}
                            >
                              {formatCurrency(alert.metadata.currentSpending)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Percentage Used</div>
                            <div className="font-semibold">
                              {alert.metadata.percentageUsed.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Remaining</div>
                            <div
                              className={`font-semibold ${
                                alert.metadata.budgetLimit - alert.metadata.currentSpending < 0
                                  ? "text-red-500"
                                  : ""
                              }`}
                            >
                              {formatCurrency(
                                alert.metadata.budgetLimit - alert.metadata.currentSpending
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {alert.errorMessage && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Error: {alert.errorMessage}</span>
                        </div>
                      )}
                    </div>

                    {alert.status === "PENDING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(alert._id)}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Alerts;

