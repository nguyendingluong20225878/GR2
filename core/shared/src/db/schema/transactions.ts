import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const TRANSACTION_TYPES = ["swap", "staking", "liquid_staking", "perp_trade", "perp_close", "lending"] as const;

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transactionType: { type: String, enum: TRANSACTION_TYPES, required: true },
    fromTokenAddress: { type: String },
    toTokenAddress: { type: String },
    fromToken: { type: Schema.Types.ObjectId, ref: "Token" },
    toToken: { type: Schema.Types.ObjectId, ref: "Token" },
    amountFrom: { type: String },
    amountTo: { type: String },
    fee: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  {
    collection: "transactions",
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

transactionSchema.index({ transactionType: 1, userId: 1 });
transactionSchema.index({ fromTokenAddress: 1 });
transactionSchema.index({ toTokenAddress: 1 });

export type TransactionSchema = InferSchemaType<typeof transactionSchema>;
export type TransactionDocument = HydratedDocument<TransactionSchema>;
export type TransactionSelect = TransactionDocument;
export type TransactionInsert = TransactionSchema;

export const transactionsTable =
  models.Transaction ?? model<TransactionSchema>("Transaction", transactionSchema);
