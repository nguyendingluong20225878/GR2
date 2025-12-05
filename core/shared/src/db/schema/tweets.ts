import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const tweetSchema = new Schema(
  {
    authorId: { type: String, ref: "XAccount", required: true, index: true },
    url: { type: String, required: true },
    content: { type: String, required: true },
    retweetCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    tweetTime: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "tweets",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

tweetSchema.index({ tweetTime: -1 });

export type TweetSchema = InferSchemaType<typeof tweetSchema>;
export type TweetDocument = HydratedDocument<TweetSchema>;
export type TweetSelect = TweetDocument;
export type TweetInsert = TweetSchema;

export const tweetTable = models.Tweet ?? model<TweetSchema>("Tweet", tweetSchema);
