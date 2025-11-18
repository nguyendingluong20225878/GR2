import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const farcasterKeywordSchema = new Schema(
  {
    keyword: { type: String, required: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    lastScannedAt: { type: Date },
  },
  {
    collection: "farcaster_keywords",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type FarcasterKeywordSchema = InferSchemaType<typeof farcasterKeywordSchema>;
export type FarcasterKeywordDocument = HydratedDocument<FarcasterKeywordSchema>;

export const farcasterKeywordsTable =
  models.FarcasterKeyword ?? model<FarcasterKeywordSchema>("FarcasterKeyword", farcasterKeywordSchema);
