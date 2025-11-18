import { InferSchemaType, Schema } from "mongoose";

export const userBalanceSubSchema = new Schema(
  {
    tokenAddress: { type: String, required: true },
    token: { type: Schema.Types.ObjectId, ref: "Token", required: false },
    balance: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
  },
);

userBalanceSubSchema.index({ tokenAddress: 1 });

export type UserBalance = InferSchemaType<typeof userBalanceSubSchema>;
