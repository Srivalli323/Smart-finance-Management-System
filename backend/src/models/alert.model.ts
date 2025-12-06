import mongoose, { Document, Schema } from "mongoose";

export enum AlertTypeEnum {
  EMAIL = "EMAIL",
  SMS = "SMS",
}

export enum AlertThresholdEnum {
  SEVENTY_PERCENT = 70,
  NINETY_PERCENT = 90,
  HUNDRED_PERCENT = 100,
}

export enum AlertStatusEnum {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface AlertDocument extends Document {
  userId: mongoose.Types.ObjectId;
  budgetId: mongoose.Types.ObjectId;
  householdId?: mongoose.Types.ObjectId;
  alertType: keyof typeof AlertTypeEnum;
  threshold: number; // 70, 90, or 100
  status: keyof typeof AlertStatusEnum;
  sentAt?: Date;
  errorMessage?: string;
  metadata?: {
    currentSpending: number;
    budgetLimit: number;
    percentageUsed: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<AlertDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    budgetId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Budget",
    },
    householdId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
    },
    alertType: {
      type: String,
      enum: Object.values(AlertTypeEnum),
      required: true,
    },
    threshold: {
      type: Number,
      enum: Object.values(AlertThresholdEnum),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AlertStatusEnum),
      default: AlertStatusEnum.PENDING,
    },
    sentAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: {
        currentSpending: Number,
        budgetLimit: Number,
        percentageUsed: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
alertSchema.index({ userId: 1, budgetId: 1, threshold: 1, status: 1 });
alertSchema.index({ createdAt: -1 });

const AlertModel = mongoose.model<AlertDocument>("Alert", alertSchema);

export default AlertModel;

