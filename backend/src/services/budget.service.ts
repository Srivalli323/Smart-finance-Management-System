import mongoose from "mongoose";
import { startOfMonth, endOfMonth } from "date-fns";
import TransactionModel, { TransactionTypeEnum } from "../models/transaction.model";
import HouseholdModel from "../models/household.model";
import BudgetModel, { BudgetTypeEnum } from "../models/budget.model";
import { NotFoundException, BadRequestException } from "../utils/app-error";
import { convertToDollarUnit, convertToCents } from "../utils/format-currency";

export interface BudgetStatus {
  totalSpentThisMonth: number;
  budgetLimit: number;
  remaining: number;
  overBudget: boolean;
  percentageUsed: number;
}

export interface CreateBudgetInput {
  type: keyof typeof BudgetTypeEnum;
  monthlyLimit: number;
  name: string;
  userId?: string;
  householdId?: string;
}

export interface UpdateBudgetInput {
  monthlyLimit?: number;
  name?: string;
  isActive?: boolean;
}

// Get budget status for a specific budget
export const getBudgetStatusService = async (
  budgetId: string
): Promise<BudgetStatus> => {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    throw new NotFoundException("Budget not found");
  }

  if (!budget.isActive) {
    return {
      totalSpentThisMonth: 0,
      budgetLimit: convertToDollarUnit(budget.monthlyLimit),
      remaining: convertToDollarUnit(budget.monthlyLimit),
      overBudget: false,
      percentageUsed: 0,
    };
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Build match query based on budget type
  const matchQuery: any = {
    type: TransactionTypeEnum.EXPENSE,
    date: {
      $gte: monthStart,
      $lte: monthEnd,
    },
    status: "COMPLETED",
  };

  if (budget.type === BudgetTypeEnum.USER) {
    matchQuery.userId = budget.userId;
  } else if (budget.type === BudgetTypeEnum.HOUSEHOLD) {
    matchQuery.householdId = budget.householdId;
  }

  const aggregationResult = await TransactionModel.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amount" },
      },
    },
  ]);

  const totalSpentInCents = aggregationResult[0]?.totalSpent || 0;
  const totalSpentThisMonth = convertToDollarUnit(totalSpentInCents);
  const budgetLimit = convertToDollarUnit(budget.monthlyLimit);
  const remaining = budgetLimit - totalSpentThisMonth;
  const overBudget = totalSpentThisMonth > budgetLimit;
  const percentageUsed =
    budgetLimit > 0
      ? Math.min((totalSpentThisMonth / budgetLimit) * 100, 100)
      : 0;

  return {
    totalSpentThisMonth,
    budgetLimit,
    remaining,
    overBudget,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
  };
};

// Create a new budget
export const createBudgetService = async (
  userId: string,
  input: CreateBudgetInput
) => {
  // Validate input based on type
  if (input.type === BudgetTypeEnum.USER && input.userId !== userId) {
    throw new BadRequestException("Cannot create budget for another user");
  }

  if (input.type === BudgetTypeEnum.HOUSEHOLD) {
    if (!input.householdId) {
      throw new BadRequestException("householdId is required for HOUSEHOLD budget");
    }
    // Verify user is member of household
    const household = await HouseholdModel.findById(input.householdId);
    if (!household) {
      throw new NotFoundException("Household not found");
    }
    const isMember = household.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!isMember) {
      throw new BadRequestException("You are not a member of this household");
    }
  }

  const budget = await BudgetModel.create({
    type: input.type,
    userId: input.type === BudgetTypeEnum.USER ? new mongoose.Types.ObjectId(userId) : undefined,
    householdId: input.type === BudgetTypeEnum.HOUSEHOLD ? new mongoose.Types.ObjectId(input.householdId!) : undefined,
    monthlyLimit: convertToCents(input.monthlyLimit),
    name: input.name,
    isActive: true,
  });

  return budget;
};

// Update a budget
export const updateBudgetService = async (
  budgetId: string,
  userId: string,
  input: UpdateBudgetInput
) => {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    throw new NotFoundException("Budget not found");
  }

  // Check ownership/permissions
  if (budget.type === BudgetTypeEnum.USER) {
    if (budget.userId?.toString() !== userId.toString()) {
      throw new BadRequestException("You can only update your own budgets");
    }
  } else if (budget.type === BudgetTypeEnum.HOUSEHOLD) {
    const household = await HouseholdModel.findById(budget.householdId);
    if (!household) {
      throw new NotFoundException("Household not found");
    }
    const member = household.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!member || member.role === "VIEWER") {
      throw new BadRequestException("You don't have permission to update this budget");
    }
  }

  if (input.monthlyLimit !== undefined) {
    budget.monthlyLimit = convertToCents(input.monthlyLimit);
  }
  if (input.name !== undefined) {
    budget.name = input.name;
  }
  if (input.isActive !== undefined) {
    budget.isActive = input.isActive;
  }

  await budget.save();
  return budget;
};

// Delete a budget
export const deleteBudgetService = async (budgetId: string, userId: string) => {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    throw new NotFoundException("Budget not found");
  }

  // Check ownership/permissions
  if (budget.type === BudgetTypeEnum.USER) {
    if (budget.userId?.toString() !== userId.toString()) {
      throw new BadRequestException("You can only delete your own budgets");
    }
  } else if (budget.type === BudgetTypeEnum.HOUSEHOLD) {
    const household = await HouseholdModel.findById(budget.householdId);
    if (!household) {
      throw new NotFoundException("Household not found");
    }
    const member = household.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!member || member.role !== "OWNER") {
      throw new BadRequestException("Only owners can delete household budgets");
    }
  }

  await BudgetModel.findByIdAndDelete(budgetId);
  return { success: true };
};

// Get all budgets for a user
export const getUserBudgetsService = async (userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const userBudgets = await BudgetModel.find({
    type: BudgetTypeEnum.USER,
    userId: userObjectId,
    isActive: true,
  });

  // Get household budgets where user is a member
  const households = await HouseholdModel.find({
    "members.userId": userObjectId,
  });
  const householdIds = households.map((h) => h._id);

  const householdBudgets = await BudgetModel.find({
    type: BudgetTypeEnum.HOUSEHOLD,
    householdId: { $in: householdIds },
    isActive: true,
  });

  return {
    userBudgets,
    householdBudgets,
  };
};

// Get budget by ID with permission check
export const getBudgetByIdService = async (budgetId: string, userId: string) => {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    throw new NotFoundException("Budget not found");
  }

  // Check access
  if (budget.type === BudgetTypeEnum.USER) {
    if (budget.userId?.toString() !== userId.toString()) {
      throw new BadRequestException("You don't have access to this budget");
    }
  } else if (budget.type === BudgetTypeEnum.HOUSEHOLD) {
    const household = await HouseholdModel.findById(budget.householdId);
    if (!household) {
      throw new NotFoundException("Household not found");
    }
    const isMember = household.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!isMember) {
      throw new BadRequestException("You don't have access to this budget");
    }
  }

  return budget;
};

// Legacy function for backward compatibility
export const getBudgetStatusByHouseholdService = async (
  householdId: string
): Promise<BudgetStatus> => {
  const household = await HouseholdModel.findById(householdId);
  if (!household) {
    throw new NotFoundException("Household not found");
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const aggregationResult = await TransactionModel.aggregate([
    {
      $match: {
        householdId: household._id,
        type: TransactionTypeEnum.EXPENSE,
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amount" },
      },
    },
  ]);

  const totalSpentInCents = aggregationResult[0]?.totalSpent || 0;
  const totalSpentThisMonth = convertToDollarUnit(totalSpentInCents);
  const budgetLimit = convertToDollarUnit(household.monthlyBudgetLimit);
  const remaining = budgetLimit - totalSpentThisMonth;
  const overBudget = totalSpentThisMonth > budgetLimit;
  const percentageUsed =
    budgetLimit > 0
      ? Math.min((totalSpentThisMonth / budgetLimit) * 100, 100)
      : 0;

  return {
    totalSpentThisMonth,
    budgetLimit,
    remaining,
    overBudget,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
  };
};

// Legacy functions for backward compatibility
export const updateBudgetLimitService = async (
  householdId: string,
  userId: string,
  newLimit: number
) => {
  const household = await HouseholdModel.findById(householdId);
  if (!household) {
    throw new NotFoundException("Household not found");
  }

  const member = household.members.find(
    (m) => m.userId.toString() === userId.toString()
  );

  if (!member) {
    throw new NotFoundException("User is not a member of this household");
  }

  if (member.role !== "OWNER") {
    throw new NotFoundException("Only household owners can update budget limit");
  }

  household.monthlyBudgetLimit = convertToCents(newLimit);
  await household.save();

  return household;
};

export const joinHouseholdService = async (
  householdId: string,
  userId: string
) => {
  const household = await HouseholdModel.findById(householdId);
  if (!household) {
    throw new NotFoundException("Household not found");
  }

  const existingMember = household.members.find(
    (m) => m.userId.toString() === userId.toString()
  );

  if (existingMember) {
    return household;
  }

  household.members.push({
    userId: new mongoose.Types.ObjectId(userId),
    role: "MEMBER",
    joinedAt: new Date(),
  });

  await household.save();
  return household;
};

export const createHouseholdService = async (
  name: string,
  userId: string,
  monthlyBudgetLimit: number = 0
) => {
  const household = await HouseholdModel.create({
    name,
    monthlyBudgetLimit: convertToCents(monthlyBudgetLimit),
    members: [
      {
        userId: new mongoose.Types.ObjectId(userId),
        role: "OWNER",
        joinedAt: new Date(),
      },
    ],
  });

  return household;
};

export const getUserHouseholdService = async (userId: string) => {
  const household = await HouseholdModel.findOne({
    "members.userId": userId,
  }).populate("members.userId", "name email profilePicture");

  return household;
};
