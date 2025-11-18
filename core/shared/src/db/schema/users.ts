import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";
import { userBalanceSubSchema } from "./user_balances";

const userSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, index: true, unique: true },
    emailVerified: { type: Date, default: null },
    age: { type: Number },
    image: { type: String },
    tradeStyle: { type: String },
    totalAssetUsd: { type: Number },
    cryptoInvestmentUsd: { type: Number },
    walletAddress: {
      type: String,
      required: true,
      default: "1nc1nerator11111111111111111111111111111111",
      index: true,
    },
    riskTolerance: { type: String, default: "medium" },
    notificationEnabled: { type: Boolean, default: false },
    balances: { type: [userBalanceSubSchema], default: [] },
  },
  {
    collection: "users",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserSchema>;
export type UserSelect = UserDocument;
export type UserInsert = UserSchema;

export const usersTable = models.User ?? model<UserSchema>("User", userSchema);
