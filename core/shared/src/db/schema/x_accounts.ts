import { InferSchemaType, Schema, model, models, Model } from "mongoose";

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
    timestamps: true,
  },
);

xAccountSchema.index({ lastTweetUpdatedAt: -1 });

export type XAccountSchema = InferSchemaType<typeof xAccountSchema>;

export const xAccountTable: Model<XAccountSchema> =
  (models.XAccount as Model<XAccountSchema>) ??
  model<XAccountSchema>("XAccount", xAccountSchema);
