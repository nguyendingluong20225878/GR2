import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const farcasterUserSchema = new Schema(
  {
    fid: { type: Number, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    displayName: { type: String },
    avatar: { type: String },
    bio: { type: String },
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    lastFetchedAt: { type: Date },
    isMonitored: { type: Boolean, default: false },
  },
  {
    collection: "farcaster_users",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type FarcasterUserSchema = InferSchemaType<typeof farcasterUserSchema>;
export type FarcasterUserDocument = HydratedDocument<FarcasterUserSchema>;

export const farcasterUsersTable =
  models.FarcasterUser ?? model<FarcasterUserSchema>("FarcasterUser", farcasterUserSchema);
