import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import {
  getUserAlertsService,
  markAlertAsReadService,
  checkBudgetThresholdsService,
} from "../services/alert.service";
import { BadRequestException } from "../utils/app-error";
import { HTTPSTATUS } from "../config/http.config";
import { z } from "zod";

const getAlertsSchema = z.object({
  budgetId: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  threshold: z.number().optional(),
  limit: z.number().optional(),
});

// Get user's alerts
export const getUserAlertsController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const filters = getAlertsSchema.parse(req.query);
    const userId = String(req.user._id);
    const alerts = await getUserAlertsService(userId, filters);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: alerts,
    });
  }
);

// Mark alert as read
export const markAlertAsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const { alertId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    const alert = await markAlertAsReadService(alertId, userId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Alert marked as read",
      data: alert,
    });
  }
);

// Manually trigger budget threshold check (for testing/admin)
export const triggerBudgetCheckController = asyncHandler(
  async (req: Request, res: Response) => {
    const { budgetId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    await checkBudgetThresholdsService(budgetId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Budget threshold check completed",
    });
  }
);

