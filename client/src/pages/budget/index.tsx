import { useEffect, useState } from "react";
import PageLayout from "@/components/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGetBudgetStatusByHouseholdQuery,
  useGetUserHouseholdQuery,
  useUpdateBudgetLimitMutation,
  useCreateHouseholdMutation,
} from "@/features/budget/budgetAPI";
import { formatCurrency } from "@/lib/format-currency";
import { useBudgetStore } from "@/stores/budget-store";
import { useSocket } from "@/hooks/use-socket";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, DollarSign, TrendingUp, Users } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

const Budget = () => {
  const { data: household, isLoading: householdLoading } = useGetUserHouseholdQuery();
  const householdId = household?._id;
  const currentUser = useSelector((state: RootState) => state.auth.user);
  
  const {
    data: budgetStatus,
    isLoading: budgetLoading,
    refetch,
  } = useGetBudgetStatusByHouseholdQuery(householdId || "", {
    skip: !householdId,
    refetchOnMountOrArgChange: true,
    pollingInterval: 30000, // Poll every 30 seconds
  });

  const [updateBudgetLimit, { isLoading: isUpdating }] = useUpdateBudgetLimitMutation();
  const [createHousehold, { isLoading: isCreating }] = useCreateHouseholdMutation();
  
  const { setBudgetStatus, setIsOverBudget } = useBudgetStore();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState("");

  // Initialize socket connection
  useSocket();

  // Update store when budget status changes
  useEffect(() => {
    if (budgetStatus) {
      setBudgetStatus(budgetStatus);
      setIsOverBudget(budgetStatus.overBudget);
    }
  }, [budgetStatus, setBudgetStatus, setIsOverBudget]);

  const handleUpdateBudget = async () => {
    if (!householdId || !newBudgetLimit) return;

    const limit = parseFloat(newBudgetLimit);
    if (isNaN(limit) || limit < 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    try {
      await updateBudgetLimit({
        householdId,
        monthlyBudgetLimit: limit,
      }).unwrap();
      toast.success("Budget limit updated successfully");
      setIsEditDialogOpen(false);
      setNewBudgetLimit("");
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update budget limit");
    }
  };

  const handleCreateHousehold = async () => {
    if (!newBudgetLimit) {
      toast.error("Please enter a budget amount");
      return;
    }

    const limit = parseFloat(newBudgetLimit);
    if (isNaN(limit) || limit < 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    try {
      await createHousehold({
        name: "My Household",
        monthlyBudgetLimit: limit,
      }).unwrap();
      toast.success("Household created successfully");
      setIsEditDialogOpen(false);
      setNewBudgetLimit("");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to create household");
    }
  };

  if (householdLoading || budgetLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading budget information...</div>
        </div>
      </PageLayout>
    );
  }

  if (!household) {
    return (
      <PageLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Household Found</CardTitle>
            <CardDescription>
              Create a household to start tracking your monthly budget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create Household</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Household</DialogTitle>
                  <DialogDescription>
                    Set up your household and monthly budget limit.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget-limit">Monthly Budget Limit ($)</Label>
                    <Input
                      id="budget-limit"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter monthly budget"
                      value={newBudgetLimit}
                      onChange={(e) => setNewBudgetLimit(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCreateHousehold}
                    disabled={isCreating}
                    className="w-full"
                  >
                    {isCreating ? "Creating..." : "Create Household"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (!budgetStatus) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Unable to load budget status</div>
        </div>
      </PageLayout>
    );
  }

  // Check if current user is admin (OWNER role)
  // Compare user IDs - handle both string and number formats
  const currentUserId = currentUser?.id?.toString() || currentUser?._id?.toString();
  const isAdmin = household.members.some(
    (member) => {
      const memberUserId = member.userId._id?.toString() || String(member.userId._id);
      return memberUserId === currentUserId && (member.role === "OWNER" || member.role === "ADMIN");
    }
  );

  const progressPercentage = Math.min(budgetStatus.percentageUsed, 100);
  const isWarning = progressPercentage >= 80;
  const isDanger = budgetStatus.overBudget;

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Household Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {household.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  {household.members.length} member{household.members.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Edit Budget
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Monthly Budget Limit</DialogTitle>
                      <DialogDescription>
                        Set a new monthly budget limit for your household.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="budget-limit">Monthly Budget Limit ($)</Label>
                        <Input
                          id="budget-limit"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={formatCurrency(budgetStatus.budgetLimit)}
                          value={newBudgetLimit}
                          onChange={(e) => setNewBudgetLimit(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleUpdateBudget}
                        disabled={isUpdating}
                        className="w-full"
                      >
                        {isUpdating ? "Updating..." : "Update Budget"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Budget Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Monthly Budget Status
            </CardTitle>
            <CardDescription>
              Track your spending for the current month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Budget Limit and Spent */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Budget Limit</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(budgetStatus.budgetLimit)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Total Spent</div>
                <div
                  className={`text-2xl font-bold ${
                    isDanger ? "text-destructive" : isWarning ? "text-orange-500" : ""
                  }`}
                >
                  {formatCurrency(budgetStatus.totalSpentThisMonth)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Remaining</div>
                <div
                  className={`text-2xl font-bold ${
                    budgetStatus.remaining < 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(budgetStatus.remaining)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
              </div>
              <Progress
                value={progressPercentage}
                className={`h-3 ${
                  isDanger
                    ? "[&>div]:bg-destructive"
                    : isWarning
                    ? "[&>div]:bg-orange-500"
                    : ""
                }`}
              />
            </div>

            {/* Warning Badge */}
            {isDanger && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <div className="font-semibold text-destructive">Budget Exceeded!</div>
                  <div className="text-sm text-muted-foreground">
                    You've exceeded your monthly budget limit. Consider reviewing your expenses.
                  </div>
                </div>
                <Badge variant="destructive">Over Budget</Badge>
              </div>
            )}

            {isWarning && !isDanger && (
              <div className="flex items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <div className="flex-1">
                  <div className="font-semibold text-orange-500">Approaching Limit</div>
                  <div className="text-sm text-muted-foreground">
                    You've used {progressPercentage.toFixed(1)}% of your budget. Be mindful of your spending.
                  </div>
                </div>
                <Badge variant="outline" className="border-orange-500 text-orange-500">
                  Warning
                </Badge>
              </div>
            )}

            {!isWarning && !isDanger && (
              <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <div className="font-semibold text-green-500">On Track</div>
                  <div className="text-sm text-muted-foreground">
                    You're within your budget. Keep up the good work!
                  </div>
                </div>
                <Badge variant="outline" className="border-green-500 text-green-500">
                  Healthy
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Budget;

