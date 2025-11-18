import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const ACTION_TYPES = ["staking", "liquid_staking", "lending"] as const;
const STATUS_TYPES = ["active", "withdrawn"] as const;

const investmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenAddress: { type: String, required: true, index: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    actionType: { type: String, required: true, enum: ACTION_TYPES },
    principal: { type: String, required: true },
    accruedInterest: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    lastUpdate: { type: Date, default: Date.now },
    interestRate: { type: Number, required: true },
    status: { type: String, required: true, enum: STATUS_TYPES },
  },
  {
    collection: "investments",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

investmentSchema.index({ actionType: 1 });
investmentSchema.index({ status: 1 });

export type InvestmentSchema = InferSchemaType<typeof investmentSchema>;
export type InvestmentDocument = HydratedDocument<InvestmentSchema>;
export type InvestmentSelect = InvestmentDocument;
export type InvestmentInsert = InvestmentSchema;

export const investmentsTable = models.Investment ?? model<InvestmentSchema>("Investment", investmentSchema);
