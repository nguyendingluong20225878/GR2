import {
  Logger,
  LogLevel,
  Tweet,
  xAccountTable,
  tweetTable,
  connectToDatabase,
} from "../../shared/src";
import { XAccount } from "../../shared/src/types/x-account";

const log = new Logger({ level: LogLevel.INFO });

let dbInitialized = false;
async function initDB() {
  if (!dbInitialized) {
    await connectToDatabase();
    dbInitialized = true;
  }
}

// =============================
//      LẤY DANH SÁCH ACCOUNT
// =============================
export const getAllXAccounts = async (): Promise<XAccount[]> => {
  await initDB();

  const docs = await xAccountTable.find().lean();

  return docs.map((d) => ({
    id: d._id,
    displayName: d.displayName,
    profileImageUrl: d.profileImageUrl,
    lastTweetUpdatedAt: d.lastTweetUpdatedAt ?? null,
  }));
};

// =============================
//          LƯU TWEETS
// =============================
export const saveTweets = async (
  accountId: string,
  tweets: Tweet[],
): Promise<Date | null> => {
  await initDB();

  if (!tweets.length) return null;

  const tweetDocuments = tweets.map((t) => ({
    authorId: accountId,
    url: t.url,
    retweetCount: t.retweetCount ?? 0,
    replyCount: t.replyCount ?? 0,
    likeCount: t.likeCount ?? 0,
    content: t.data,
    tweetTime: new Date(t.time),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await tweetTable.insertMany(tweetDocuments, { ordered: false }).catch(() => {});

  const newest = tweets
    .map((t) => new Date(t.time))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (newest) {
    await xAccountTable.updateOne(
      { _id: accountId },
      { $set: { lastTweetUpdatedAt: newest } },
    );
  }

  return newest ?? null;
};
