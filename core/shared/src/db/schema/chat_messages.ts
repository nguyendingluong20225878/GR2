import { InferSchemaType, Schema } from "mongoose";

export const chatMessageRoles = ["user", "assistant", "system"] as const;
export type ChatMessageRole = (typeof chatMessageRoles)[number];

export const chatMessageSubSchema = new Schema(
  {
    role: { type: String, enum: chatMessageRoles, required: true },
    parts: { type: Schema.Types.Mixed, required: true },
    attachments: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
  },
);

chatMessageSubSchema.index({ createdAt: 1 });

export type ChatMessage = InferSchemaType<typeof chatMessageSubSchema>;
