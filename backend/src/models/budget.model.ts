import mongoose, { Document, Schema } from "mongoose";

export enum BudgetTypeEnum {
  USER = "USER",
  HOUSEHOLD = "HOUSEHOLD",
}

export interface BudgetDocument extends Document {
  userId?: mongoose.Types.ObjectId; // Required for USER type
  householdId?: mongoose.Types.ObjectId; // Required for HOUSEHOLD type
  type: keyof typeof BudgetTypeEnum;
  monthlyLimit: number; // Stored in cents
  name: string; // Budget name/description
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<BudgetDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function (this: BudgetDocument) {
        return this.type === BudgetTypeEnum.USER;
      },
    },
    householdId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: function (this: BudgetDocument) {
        return this.type === BudgetTypeEnum.HOUSEHOLD;
      },
    },
    type: {
      type: String,
      enum: Object.values(BudgetTypeEnum),
      required: true,
    },
    monthlyLimit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
budgetSchema.index({ userId: 1, type: 1, isActive: 1 });
budgetSchema.index({ householdId: 1, type: 1, isActive: 1 });

// Validation: Ensure either userId or householdId is set based on type
budgetSchema.pre("save", function (next) {
  if (this.type === BudgetTypeEnum.USER && !this.userId) {
    return next(new Error("userId is required for USER budget type"));
  }
  if (this.type === BudgetTypeEnum.HOUSEHOLD && !this.householdId) {
    return next(new Error("householdId is required for HOUSEHOLD budget type"));
  }
  next();
});

const BudgetModel = mongoose.model<BudgetDocument>("Budget", budgetSchema);

export default BudgetModel;

