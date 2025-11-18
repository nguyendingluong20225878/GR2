import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const castKeywordSchema = new Schema(
  {
    castId: { type: Schema.Types.ObjectId, ref: "FarcasterCast", required: true },
    keywordId: { type: Schema.Types.ObjectId, ref: "FarcasterKeyword", required: true },
  },
  {
    collection: "cast_keywords",
    timestamps: true,
  },
);

castKeywordSchema.index({ castId: 1, keywordId: 1 }, { unique: true });

export type CastKeywordSchema = InferSchemaType<typeof castKeywordSchema>;
export type CastKeywordDocument = HydratedDocument<CastKeywordSchema>;

export const castKeywordsTable = models.CastKeyword ?? model<CastKeywordSchema>("CastKeyword", castKeywordSchema);
