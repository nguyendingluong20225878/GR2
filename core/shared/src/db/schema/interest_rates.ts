import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const ACTION_TYPES = ["staking", "liquid_staking", "lending"] as const;

const interestRateSchema = new Schema(
  {
    tokenAddress: { type: String, required: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    actionType: { type: String, required: true, enum: ACTION_TYPES },
    interestRate: { type: Number, required: true },
    effectiveDate: { type: Date, default: Date.now },
  },
  {
    collection: "interest_rates",
    timestamps: false,
  },
);

interestRateSchema.index({ tokenAddress: 1, actionType: 1 }, { unique: true });
interestRateSchema.index({ effectiveDate: 1 });

export type InterestRateSchema = InferSchemaType<typeof interestRateSchema>;
export type InterestRateDocument = HydratedDocument<InterestRateSchema>;
export type InterestRateSelect = InterestRateDocument;
export type InterestRateInsert = InterestRateSchema;

export const interestRatesTable =
  models.InterestRate ?? model<InterestRateSchema>("InterestRate", interestRateSchema);
