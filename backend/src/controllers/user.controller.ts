import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import {
  findByIdUserService,
  updateUserService,
} from "../services/user.service";
import { HTTPSTATUS } from "../config/http.config";
import { updateUserSchema } from "../validators/user.validator";
import { BadRequestException } from "../utils/app-error";

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const userId = String(req.user._id);
    const user = await findByIdUserService(userId);
    
    return res.status(HTTPSTATUS.OK).json({
      message: "User fetched successfully",
      user,
    });
  }
);

export const updateUserController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new BadRequestException("User not authenticated");
    }

    const body = updateUserSchema.parse(req.body);
    const userId = String(req.user._id);
    const profilePic = req.file;
    
    const user = await updateUserService(userId, body, profilePic);

    return res.status(HTTPSTATUS.OK).json({
      message: "User profile updated successfully",
      data: user,
    });
  }
);
