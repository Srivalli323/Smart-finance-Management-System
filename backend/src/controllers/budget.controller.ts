import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import {
  getBudgetStatusService,
  createBudgetService,
  updateBudgetService,
  deleteBudgetService,
  getUserBudgetsService,
  getBudgetByIdService,
  getBudgetStatusByHouseholdService,
  updateBudgetLimitService,
  joinHouseholdService,
  createHouseholdService,
  getUserHouseholdService,
} from "../services/budget.service";
import {
  updateBudgetLimitSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
} from "../validators/budget.validator";
import { BadRequestException } from "../utils/app-error";
import { HTTPSTATUS } from "../config/http.config";
import { z } from "zod";

// Validators
const createBudgetSchema = z.object({
  type: z.enum(["USER", "HOUSEHOLD"]),
  monthlyLimit: z.number().min(0),
  name: z.string().min(1),
  householdId: z.string().optional(),
});

const updateBudgetSchema = z.object({
  monthlyLimit: z.number().min(0).optional(),
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// Get budget status
export const getBudgetStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const { budgetId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const budgetStatus = await getBudgetStatusService(budgetId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: budgetStatus,
    });
  }
);

// Create budget
export const createBudgetController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const validatedData = createBudgetSchema.parse(req.body);
    const userId = String(req.user._id);
    const budget = await createBudgetService(userId, validatedData);

    res.status(HTTPSTATUS.CREATED).json({
      success: true,
      message: "Budget created successfully",
      data: budget,
    });
  }
);

// Update budget
export const updateBudgetController = asyncHandler(
  async (req: Request, res: Response) => {
    const { budgetId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const validatedData = updateBudgetSchema.parse(req.body);
    const userId = String(req.user._id);
    const budget = await updateBudgetService(budgetId, userId, validatedData);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Budget updated successfully",
      data: budget,
    });
  }
);

// Delete budget
export const deleteBudgetController = asyncHandler(
  async (req: Request, res: Response) => {
    const { budgetId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    await deleteBudgetService(budgetId, userId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Budget deleted successfully",
    });
  }
);

// Get all budgets for user
export const getUserBudgetsController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    const budgets = await getUserBudgetsService(userId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: budgets,
    });
  }
);

// Get budget by ID
export const getBudgetByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const { budgetId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    const budget = await getBudgetByIdService(budgetId, userId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: budget,
    });
  }
);

// Legacy endpoints for backward compatibility
export const getBudgetStatusByHouseholdController = asyncHandler(
  async (req: Request, res: Response) => {
    const { householdId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const budgetStatus = await getBudgetStatusByHouseholdService(householdId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: budgetStatus,
    });
  }
);

export const updateBudgetLimitController = asyncHandler(
  async (req: Request, res: Response) => {
    const { householdId } = req.params;
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const validatedData = updateBudgetLimitSchema.parse(req.body);
    const userId = String(req.user._id);
    const household = await updateBudgetLimitService(
      householdId,
      userId,
      validatedData.monthlyBudgetLimit
    );

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: household,
    });
  }
);

export const createHouseholdController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const validatedData = createHouseholdSchema.parse(req.body);
    const userId = String(req.user._id);
    const household = await createHouseholdService(
      validatedData.name,
      userId,
      validatedData.monthlyBudgetLimit
    );

    res.status(HTTPSTATUS.CREATED).json({
      success: true,
      data: household,
    });
  }
);

export const joinHouseholdController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const validatedData = joinHouseholdSchema.parse(req.body);
    const userId = String(req.user._id);
    const household = await joinHouseholdService(
      validatedData.householdId,
      userId
    );

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: household,
    });
  }
);

export const getUserHouseholdController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    const household = await getUserHouseholdService(userId);

    res.status(HTTPSTATUS.OK).json({
      success: true,
      data: household,
    });
  }
);
