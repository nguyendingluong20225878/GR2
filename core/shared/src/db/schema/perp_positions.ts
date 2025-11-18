import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const POSITION_DIRECTIONS = ["long", "short"] as const;
const PERP_STATUS = ["open", "closed", "liquidated"] as const;

const perpPositionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenAddress: { type: String, required: true, index: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    positionDirection: { type: String, enum: POSITION_DIRECTIONS, required: true },
    leverage: { type: Number, required: true },
    entryPrice: { type: String, required: true },
    positionSize: { type: String, required: true },
    collateralAmount: { type: String, required: true },
    liquidationPrice: { type: String, required: true, index: true },
    entryFundingRate: { type: Number, required: true },
    accumulatedFunding: { type: String, required: true },
    fundingRateLastApplied: { type: Date, default: Date.now },
    status: { type: String, enum: PERP_STATUS, required: true, index: true },
  },
  {
    collection: "perp_positions",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

perpPositionSchema.index({ userId: 1, status: 1 });

export type PerpPositionSchema = InferSchemaType<typeof perpPositionSchema>;
export type PerpPositionDocument = HydratedDocument<PerpPositionSchema>;
export type PerpPositionSelect = PerpPositionDocument;
export type PerpPositionInsert = PerpPositionSchema;

export const perpPositionsTable =
  models.PerpPosition ?? model<PerpPositionSchema>("PerpPosition", perpPositionSchema);
