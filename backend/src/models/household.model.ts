import mongoose, { Document, Schema } from "mongoose";

export enum HouseholdRoleEnum {
  OWNER = "OWNER",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export interface HouseholdMember {
  userId: mongoose.Types.ObjectId;
  role: keyof typeof HouseholdRoleEnum;
  joinedAt: Date;
}

export interface HouseholdDocument extends Document {
  name: string;
  monthlyBudgetLimit: number; // Stored in cents
  members: HouseholdMember[];
  createdAt: Date;
  updatedAt: Date;
}

const householdMemberSchema = new Schema<HouseholdMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    role: {
      type: String,
      enum: Object.values(HouseholdRoleEnum),
      default: HouseholdRoleEnum.MEMBER,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const householdSchema = new Schema<HouseholdDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    monthlyBudgetLimit: {
      type: Number,
      required: true,
      default: 0, // 0 means no limit
      min: 0,
    },
    members: {
      type: [householdMemberSchema],
      required: true,
      validate: {
        validator: function (members: HouseholdMember[]) {
          return members.length > 0;
        },
        message: "Household must have at least one member",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
householdSchema.index({ "members.userId": 1 });

const HouseholdModel = mongoose.model<HouseholdDocument>(
  "Household",
  householdSchema
);

export default HouseholdModel;

