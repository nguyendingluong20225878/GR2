import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const verificationTokenSchema = new Schema(
  {
    identifier: { type: String, required: true },
    token: { type: String, required: true },
    expires: { type: Date, required: true },
  },
  {
    collection: "verification_tokens",
    timestamps: false,
  },
);

verificationTokenSchema.index({ identifier: 1, token: 1 }, { unique: true });

export type VerificationTokenSchema = InferSchemaType<typeof verificationTokenSchema>;
export type VerificationTokenDocument = HydratedDocument<VerificationTokenSchema>;
export type VerificationTokenSelect = VerificationTokenDocument;
export type VerificationTokenInsert = VerificationTokenSchema;

export const verificationTokensTable =
  models.VerificationToken ?? model<VerificationTokenSchema>("VerificationToken", verificationTokenSchema);
