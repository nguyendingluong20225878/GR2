import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const tokenSchema = new Schema(
  {
    address: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true, index: true },
    name: { type: String, required: true },
    decimals: { type: Number, required: true },
    type: { type: String, required: true, enum: ["normal", "lending", "perp", "staking"] },
    iconUrl: { type: String, required: true },
  },
  {
    collection: "tokens",
    versionKey: false,
  },
);

tokenSchema.index({ type: 1 });

export type TokenSchema = InferSchemaType<typeof tokenSchema>;
export type TokenDocument = HydratedDocument<TokenSchema>;
export type TokenSelect = TokenDocument;
export type TokenInsert = TokenSchema;

export const tokensTable = models.Token ?? model<TokenSchema>("Token", tokenSchema);
