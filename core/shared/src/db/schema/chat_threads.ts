import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";
import { chatMessageSubSchema } from "./chat_messages";

const chatThreadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, default: "New Chat" },
    messages: { type: [chatMessageSubSchema], default: [] },
  },
  {
    collection: "chat_threads",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

chatThreadSchema.index({ createdAt: 1 });

export type ChatThreadSchema = InferSchemaType<typeof chatThreadSchema>;
export type ChatThreadDocument = HydratedDocument<ChatThreadSchema>;

export const chatThreadsTable = models.ChatThread ?? model<ChatThreadSchema>("ChatThread", chatThreadSchema);
