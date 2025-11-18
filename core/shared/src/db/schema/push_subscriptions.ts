import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String },
    os: { type: String },
    browser: { type: String },
  },
  {
    collection: "push_subscriptions",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ userId: 1, os: 1, browser: 1 }, { unique: true, sparse: true });

export type PushSubscriptionSchema = InferSchemaType<typeof pushSubscriptionSchema>;
export type PushSubscriptionDocument = HydratedDocument<PushSubscriptionSchema>;

export const pushSubscriptionTable =
  models.PushSubscription ?? model<PushSubscriptionSchema>("PushSubscription", pushSubscriptionSchema);
