import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

type AccountType = "oauth" | "email" | "credentials" | "oidc";

const accountSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["oauth", "email", "credentials", "oidc"] satisfies AccountType[] },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    refresh_token: { type: String },
    access_token: { type: String },
    expires_at: { type: Number },
    token_type: { type: String },
    scope: { type: String },
    id_token: { type: String },
    session_state: { type: String },
  },
  {
    collection: "accounts",
    versionKey: false,
    timestamps: true,
  },
);

accountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

export type AccountSchema = InferSchemaType<typeof accountSchema>;
export type AccountDocument = HydratedDocument<AccountSchema>;
export type AccountSelect = AccountDocument;
export type AccountInsert = AccountSchema;

export const accountsTable = models.Account ?? model<AccountSchema>("Account", accountSchema);
