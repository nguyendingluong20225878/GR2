import {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  models,
  Model,
} from "mongoose";

const tokenSchema = new Schema(
  {
    address: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true, index: true },
    name: { type: String, required: true },
    decimals: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: ["normal", "lending", "perp", "staking"],
    },
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
export type TokenSelect = TokenSchema;
export type TokenInsert = TokenSchema;

export const tokensTable: Model<TokenSchema> =
  (models.Token as Model<TokenSchema>) ??
  model<TokenSchema>("Token", tokenSchema);
