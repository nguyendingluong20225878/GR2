import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const tokenPrice24hAgoSchema = new Schema(
  {
    tokenAddress: { type: String, required: true, unique: true },
    priceUsd: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  {
    collection: "token_price_24h_ago_view",
    timestamps: false,
  },
);

export type TokenPrice24hAgoSchema = InferSchemaType<typeof tokenPrice24hAgoSchema>;
export type TokenPrice24hAgoDocument = HydratedDocument<TokenPrice24hAgoSchema>;

export const tokenPrice24hAgoView =
  models.TokenPrice24hAgo ?? model<TokenPrice24hAgoSchema>("TokenPrice24hAgo", tokenPrice24hAgoSchema);
