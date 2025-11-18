import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const authenticatorSchema = new Schema(
  {
    credentialID: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerAccountId: { type: String, required: true },
    credentialPublicKey: { type: String, required: true },
    counter: { type: Number, required: true },
    credentialDeviceType: { type: String, required: true },
    credentialBackedUp: { type: Boolean, required: true },
    transports: { type: [String], default: undefined },
  },
  {
    collection: "authenticators",
    timestamps: true,
    versionKey: false,
  },
);

authenticatorSchema.index({ userId: 1, credentialID: 1 }, { unique: true });

export type AuthenticatorSchema = InferSchemaType<typeof authenticatorSchema>;
export type AuthenticatorDocument = HydratedDocument<AuthenticatorSchema>;
export type AuthenticatorSelect = AuthenticatorDocument;
export type AuthenticatorInsert = AuthenticatorSchema;

export const authenticatorsTable =
  models.Authenticator ?? model<AuthenticatorSchema>("Authenticator", authenticatorSchema);
