import { desc, eq, gte } from "drizzle-orm";

let cachedShared: any = null;
async function getShared() {
  if (cachedShared) return cachedShared;

  const mongoUri = process.env.MONGODB_URI ?? process.env.DATABASE_URL;
  if (!mongoUri) {
    // Not configured to persist — return null to make callers no-op-friendly
    // This avoids importing shared top-level modules that may throw when env is missing
    // eslint-disable-next-line no-console
    console.warn("proposal-generator: DB not configured; DB helpers will be no-op");
    return null;
  }

  const sharedPath = "../../shared/src/index.js" as const;
  // use a non-literal import target so TS won't try to type-resolve the module at compile-time
  const shared = await import(sharedPath as any);
  cachedShared = shared;
  return cachedShared;
}

export const fetchUser = async (userId: string) => {
  const shared = await getShared();
  if (!shared) return null;

  const { db, usersTable } = shared as any;
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  return user;
};

export const fetchSignal = async (signalId: string) => {
  const shared = await getShared();
  if (!shared) return null;

  const { db, signalsTable } = shared as any;
  const signal = await db.query.signalsTable.findFirst({ where: eq(signalsTable.id, signalId) });
  return signal;
};

export const fetchTokenPrices = async (since: Date) => {
  const shared = await getShared();
  if (!shared) return [];

  const { db, tokenPricesTable } = shared as any;
  const tokenPrices = await db.query.tokenPricesTable.findMany({
    where: gte(tokenPricesTable.lastUpdated, since),
    orderBy: [desc(tokenPricesTable.lastUpdated)],
    limit: 10,
  });
  return tokenPrices;
};

export const fetchTweets = async (since: Date) => {
  const shared = await getShared();
  if (!shared) return [];

  const { db, tweetTable } = shared as any;
  const tweets = await db.query.tweetTable.findMany({
    where: gte(tweetTable.tweetTime, since),
    orderBy: [desc(tweetTable.tweetTime)],
    limit: 20,
  });
  return tweets;
};

export const fetchUserBalances = async (userId: string) => {
  const shared = await getShared();
  if (!shared) return [];

  const { db, userBalancesTable } = shared as any;
  const userBalances = await db.query.userBalancesTable.findMany({
    where: eq(userBalancesTable.userId, userId),
  });
  return userBalances;
};
