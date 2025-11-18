import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const farcasterCastSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
    author: { type: String },
    authorFid: { type: Number },
    text: { type: String, required: true },
    replyTo: { type: String },
    timestamp: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
    isLatest: { type: Boolean, default: false },
  },
  {
    collection: "farcaster_casts",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type FarcasterCastSchema = InferSchemaType<typeof farcasterCastSchema>;
export type FarcasterCastDocument = HydratedDocument<FarcasterCastSchema>;

export const farcasterCastsTable =
  models.FarcasterCast ?? model<FarcasterCastSchema>("FarcasterCast", farcasterCastSchema);
