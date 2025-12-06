import mongoose from "mongoose";
import { startOfMonth, endOfMonth } from "date-fns";
import BudgetModel, { BudgetTypeEnum } from "../models/budget.model";
import TransactionModel, { TransactionTypeEnum } from "../models/transaction.model";
import AlertModel, { AlertTypeEnum, AlertThresholdEnum, AlertStatusEnum } from "../models/alert.model";
import UserModel from "../models/user.model";
import { convertToDollarUnit } from "../utils/format-currency";
import { sendEmail } from "../mailers/mailer";
import { formatCurrency } from "../utils/format-currency";

// SMS service placeholder - integrate with Twilio or similar
const sendSMS = async (phoneNumber: string, message: string) => {
  // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
  console.log(`[SMS] To: ${phoneNumber}, Message: ${message}`);
  // For now, just log. In production, integrate with actual SMS service
  return { success: true };
};

// Check budget thresholds and send alerts
export const checkBudgetThresholdsService = async (budgetId: string) => {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget || !budget.isActive) {
    return;
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Build match query
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
  const percentageUsed = budgetLimit > 0 
    ? (totalSpentThisMonth / budgetLimit) * 100 
    : 0;

  // Get users to notify
  const usersToNotify: mongoose.Types.ObjectId[] = [];
  
  if (budget.type === BudgetTypeEnum.USER && budget.userId) {
    usersToNotify.push(budget.userId);
  } else if (budget.type === BudgetTypeEnum.HOUSEHOLD && budget.householdId) {
    const HouseholdModel = (await import("../models/household.model")).default;
    const household = await HouseholdModel.findById(budget.householdId);
    if (household) {
      usersToNotify.push(...household.members.map(m => m.userId));
    }
  }

  // Check each threshold (70%, 90%, 100%)
  const thresholds = [
    AlertThresholdEnum.SEVENTY_PERCENT,
    AlertThresholdEnum.NINETY_PERCENT,
    AlertThresholdEnum.HUNDRED_PERCENT,
  ];

  for (const threshold of thresholds) {
    if (percentageUsed >= threshold) {
      // Check if alert was already sent this month for this threshold
      const existingAlert = await AlertModel.findOne({
        budgetId: budget._id,
        threshold,
        status: AlertStatusEnum.SENT,
        createdAt: {
          $gte: monthStart,
        },
      });

      if (!existingAlert) {
        // Send alerts to all users
        for (const userId of usersToNotify) {
          await sendBudgetAlertService(
            userId.toString(),
            budgetId,
            budget.householdId?.toString(),
            threshold,
            {
              currentSpending: totalSpentThisMonth,
              budgetLimit,
              percentageUsed,
            }
          );
        }
      }
    }
  }
};

// Send budget alert (Email or SMS)
export const sendBudgetAlertService = async (
  userId: string,
  budgetId: string,
  householdId: string | undefined,
  threshold: number,
  metadata: {
    currentSpending: number;
    budgetLimit: number;
    percentageUsed: number;
  }
) => {
  const user = await UserModel.findById(userId);
  if (!user) {
    return;
  }

  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    return;
  }

  const thresholdText = threshold === 70 ? "70%" : threshold === 90 ? "90%" : "100%";
  const isOverBudget = threshold === 100 && metadata.percentageUsed >= 100;

  // Create alert records for both email and SMS
  const alerts = [];

  // Email alert
  if (user.email) {
    try {
      const emailSubject = isOverBudget
        ? `🚨 Budget Exceeded: ${budget.name}`
        : `⚠️ Budget Alert: ${budget.name} - ${thresholdText} Used`;

      const emailBody = `
        <h2>${isOverBudget ? "Budget Exceeded!" : "Budget Alert"}</h2>
        <p>Hello ${user.name},</p>
        <p>Your budget <strong>${budget.name}</strong> has reached ${thresholdText} of its limit.</p>
        <ul>
          <li><strong>Budget Limit:</strong> ${formatCurrency(metadata.budgetLimit)}</li>
          <li><strong>Current Spending:</strong> ${formatCurrency(metadata.currentSpending)}</li>
          <li><strong>Percentage Used:</strong> ${metadata.percentageUsed.toFixed(2)}%</li>
          <li><strong>Remaining:</strong> ${formatCurrency(metadata.budgetLimit - metadata.currentSpending)}</li>
        </ul>
        ${isOverBudget ? "<p style='color: red;'><strong>⚠️ You have exceeded your budget limit!</strong></p>" : ""}
        <p>Please review your spending and adjust accordingly.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, ""),
      });

      const emailAlert = await AlertModel.create({
        userId: user._id,
        budgetId: budget._id,
        householdId: householdId ? new mongoose.Types.ObjectId(householdId) : undefined,
        alertType: AlertTypeEnum.EMAIL,
        threshold,
        status: AlertStatusEnum.SENT,
        sentAt: new Date(),
        metadata,
      });

      alerts.push(emailAlert);
    } catch (error: any) {
      console.error("Failed to send email alert:", error);
      await AlertModel.create({
        userId: user._id,
        budgetId: budget._id,
        householdId: householdId ? new mongoose.Types.ObjectId(householdId) : undefined,
        alertType: AlertTypeEnum.EMAIL,
        threshold,
        status: AlertStatusEnum.FAILED,
        errorMessage: error.message,
        metadata,
      });
    }
  }

  // SMS alert
  if (user.phoneNumber) {
    try {
      const smsMessage = isOverBudget
        ? `🚨 Budget Alert: ${budget.name} exceeded! Spent: ${formatCurrency(metadata.currentSpending)} of ${formatCurrency(metadata.budgetLimit)}`
        : `⚠️ Budget Alert: ${budget.name} - ${thresholdText} used. Spent: ${formatCurrency(metadata.currentSpending)} of ${formatCurrency(metadata.budgetLimit)}`;

      await sendSMS(user.phoneNumber, smsMessage);

      const smsAlert = await AlertModel.create({
        userId: user._id,
        budgetId: budget._id,
        householdId: householdId ? new mongoose.Types.ObjectId(householdId) : undefined,
        alertType: AlertTypeEnum.SMS,
        threshold,
        status: AlertStatusEnum.SENT,
        sentAt: new Date(),
        metadata,
      });

      alerts.push(smsAlert);
    } catch (error: any) {
      console.error("Failed to send SMS alert:", error);
      await AlertModel.create({
        userId: user._id,
        budgetId: budget._id,
        householdId: householdId ? new mongoose.Types.ObjectId(householdId) : undefined,
        alertType: AlertTypeEnum.SMS,
        threshold,
        status: AlertStatusEnum.FAILED,
        errorMessage: error.message,
        metadata,
      });
    }
  }

  return alerts;
};

// Get user's alerts
export const getUserAlertsService = async (
  userId: string,
  filters?: {
    budgetId?: string;
    status?: keyof typeof AlertStatusEnum;
    threshold?: number;
    limit?: number;
  }
) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const query: any = { userId: userObjectId };

  if (filters?.budgetId) {
    query.budgetId = new mongoose.Types.ObjectId(filters.budgetId);
  }
  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.threshold) {
    query.threshold = filters.threshold;
  }

  const limit = filters?.limit || 50;

  const alerts = await AlertModel.find(query)
    .populate("budgetId", "name type")
    .populate("householdId", "name")
    .sort({ createdAt: -1 })
    .limit(limit);

  return alerts;
};

// Mark alert as read/viewed (for frontend)
export const markAlertAsReadService = async (alertId: string, userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const alert = await AlertModel.findOne({
    _id: alertId,
    userId: userObjectId,
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  // You can add a 'read' field to the alert model if needed
  return alert;
};

