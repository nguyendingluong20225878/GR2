import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const sessionSchema = new Schema(
  {
    sessionToken: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    expires: { type: Date, required: true },
  },
  {
    collection: "sessions",
    timestamps: false,
  },
);

export type SessionSchema = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<SessionSchema>;
export type SessionSelect = SessionDocument;
export type SessionInsert = SessionSchema;

export const sessionsTable = models.Session ?? model<SessionSchema>("Session", sessionSchema);
