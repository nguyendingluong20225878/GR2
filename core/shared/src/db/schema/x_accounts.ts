import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const xAccountSchema = new Schema(
  {
    _id: { type: String, required: true },
    displayName: { type: String },
    profileImageUrl: { type: String },
    lastTweetUpdatedAt: { type: Date, default: null },
    userIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  {
    collection: "x_accounts",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

xAccountSchema.index({ lastTweetUpdatedAt: -1 });

export type XAccountSchema = InferSchemaType<typeof xAccountSchema>;
export type XAccountDocument = HydratedDocument<XAccountSchema>;
export type XAccountSelect = XAccountDocument;
export type XAccountInsert = XAccountSchema;

export const xAccountTable = models.XAccount ?? model<XAccountSchema>("XAccount", xAccountSchema);
