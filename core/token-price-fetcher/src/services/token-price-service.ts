type TokenSelect = any;
import { sql } from "drizzle-orm";

// Jupiterの価格レスポンスの型定義
interface JupiterPriceResponse {
  data: {
    [tokenAddress: string]: {
      id: string;
      type: string;
      price: string;
    };
  };
  timeTaken: number;
}

interface TokenPriceUpdate {
  tokenAddress: string;
  priceUsd: string;
  lastUpdated: Date;
  source: string;
}

interface TokenPriceHistoryInsert {
  token_address: string;
  price_usd: string;
  timestamp: Date;
  source: string;
}

let cachedShared: any = null;
async function getSharedIfConfigured() {
  if (cachedShared) return cachedShared;
  const sqlUrl = process.env.DATABASE_URL;
  const mongoUri = process.env.MONGODB_URI;
  if (!sqlUrl && !mongoUri) {
    // DB not configured — log and return null to make persistence optional
    // eslint-disable-next-line no-console
    console.warn("token-price-fetcher: DB not configured (DATABASE_URL or MONGODB_URI missing); persistence will be skipped");
    return null;
  }

  // If using SQL (DATABASE_URL), import shared runtime which exposes drizzle helpers
  if (sqlUrl) {
    const sharedPath = "../../shared/src/index.js" as const;
    const shared = await import(sharedPath as any);
    cachedShared = shared;
    return cachedShared;
  }

  // If MONGODB_URI is present but this package uses SQL via drizzle, we skip for now and add TODO
  // TODO: provide a Mongoose-based persistence adapter for token prices when migrating to Mongo
  // eslint-disable-next-line no-console
  console.warn("token-price-fetcher: MONGODB_URI present but SQL-based persistence not implemented; skipping DB writes");
  return null;
}

export class TokenPriceService {
  private jupiterApiUrl: string;
  private lastRefreshDate: Date | null = null; // Store the date of the last refresh

  constructor() {
    this.jupiterApiUrl = process.env.JUPITER_API_URL || "https://api.jup.ag/price/v2";
  }

  /**
   * 全トークンの価格を更新する
   */
  async updateAllTokenPrices(): Promise<void> {
    try {
      const shared = await getSharedIfConfigured();
      const logger = shared?.logger ?? console;
      logger.debug?.("updateAllTokenPrices", "start updating all token prices...");

      // DBから全トークンを取得 — if DB not configured, skip updating and just log
      const tokens = shared ? await shared.db.query.tokensTable.findMany() : [];
      if (tokens.length === 0) {
        logger.debug?.("updateAllTokenPrices", "no tokens to update");
        return;
      }

      logger.debug?.("updateAllTokenPrices", `${tokens.length} tokens to update`);

      // バッチでトークンを処理（APIレート制限を考慮）
      const batchSize = 30;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await this.updateTokenPricesBatch(batch, shared);

        // APIレート制限を考慮して少し待機
        if (i + batchSize < tokens.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.debug?.("updateAllTokenPrices", "token prices updated");
    } catch (error) {
      // If logger is not available, fallback to console
      // eslint-disable-next-line no-console
      console.error("updateAllTokenPrices: error updating token prices", error);
      throw error;
    }
  }

  /**
   * 指定されたトークンのバッチの価格を更新する
   */
  private async updateTokenPricesBatch(tokens: TokenSelect[], shared: any): Promise<void> {
    try {
      const logger = shared?.logger ?? console;

      // トークンアドレスのリストを作成
      const tokenAddresses = tokens.map((token) => token.address);
      const addressesParam = tokenAddresses.join(",");

      // Jupiterの価格APIを呼び出す
      const response = await fetch(`${this.jupiterApiUrl}?ids=${addressesParam}`);

      if (!response.ok) {
        logger.error?.("updateTokenPricesBatch", "error fetching token prices", {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Jupiter API から価格を取得できませんでした: ${response.status} ${response.statusText}`);
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const now = new Date();

      // 更新と挿入するレコードを準備
      const priceInserts: TokenPriceUpdate[] = [];
      const historyInserts: TokenPriceHistoryInsert[] = [];

      for (const token of tokens) {
        const tokenPrice = priceData.data[token.address];
        if (!tokenPrice || !tokenPrice.price) {
          logger.warn?.("updateTokenPricesBatch", `${token.symbol} (${token.address}) price not found`);
          continue;
        }

        // 価格履歴用のレコードを準備
        historyInserts.push({
          token_address: token.address,
          price_usd: tokenPrice.price,
          timestamp: now,
          source: "jupiter",
        });

        // 新しい価格レコードを準備（UPSERTで処理）
        priceInserts.push({
          tokenAddress: token.address,
          priceUsd: tokenPrice.price,
          lastUpdated: now,
          source: "jupiter",
        });

        logger.debug?.("updateTokenPricesBatch", `${token.symbol} (${token.address}): ${tokenPrice.price} USD updated`);
      }

      // If shared db is not available, skip persistence (no-op)
      if (!shared) {
        logger.debug?.("updateTokenPricesBatch", `DB not configured — skipping persistence, ${priceInserts.length} prices prepared`);
        return;
      }

      const { db, tokenPricesTable, tokenPriceHistory } = shared as any;

      // 一括でデータを更新
      if (priceInserts.length > 0) {
        await db
          .insert(tokenPricesTable)
          .values(priceInserts)
          .onConflictDoUpdate({
            target: tokenPricesTable.tokenAddress,
            set: {
              priceUsd: sql`EXCLUDED.price_usd`,
              lastUpdated: sql`EXCLUDED.last_updated`,
              source: sql`EXCLUDED.source`,
            },
          });
      }

      // 価格履歴を一括で挿入
      if (historyInserts.length > 0) {
        await db.insert(tokenPriceHistory).values(historyInserts);
      }

      logger.debug?.("updateTokenPricesBatch", `${historyInserts.length} tokens prices updated`);
    } catch (error) {
      const logger = (await getSharedIfConfigured())?.logger ?? console;
      logger.error?.("updateTokenPricesBatch", "error updating token prices", error);
      throw error;
    }
  }

  /**
   * 特定のトークンの価格を取得する
   */
  async getTokenPrice(tokenAddress: string): Promise<string | null> {
    try {
      // Jupiter APIから価格を取得
      const response = await fetch(`${this.jupiterApiUrl}?ids=${tokenAddress}`);

      if (!response.ok) {
        throw new Error(`Jupiter API から価格を取得できませんでした: ${response.status} ${response.statusText}`);
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const tokenPrice = priceData.data[tokenAddress];

      if (tokenPrice && tokenPrice.price) {
        return tokenPrice.price;
      }

      return null;
    } catch (error) {
      const logger = (await getSharedIfConfigured())?.logger ?? console;
      logger.error?.("getTokenPrice", `error fetching token price for ${tokenAddress}`, error);
      return null;
    }
  }

  private shouldRefreshTokenPriceView(): boolean {
    // Made synchronous
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if current time is between 00:00 and 00:05
    const isRefreshWindow = currentHour === 0 && currentMinute >= 0 && currentMinute <= 5;

    if (!isRefreshWindow) {
      // console.log(`[TokenPriceService] Not in refresh window (00:00-00:05). Current time: ${now.toLocaleTimeString()}`);
      return false;
    }

    // If in the refresh window, check if already refreshed today
    if (this.lastRefreshDate) {
      const lastRefreshDay =
        this.lastRefreshDate.getFullYear() * 10000 +
        (this.lastRefreshDate.getMonth() + 1) * 100 +
        this.lastRefreshDate.getDate();
      const currentDay = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

      if (lastRefreshDay === currentDay) {
        (getSharedIfConfigured())?.then(s => s?.logger?.debug?.(
          "shouldRefreshTokenPriceView",
          `materialized view already refreshed today (${now.toLocaleDateString()}).`,
        ));
        return false;
      }
    }
    // console.log(`[TokenPriceService] Eligible for refresh. Time: ${now.toLocaleTimeString()}, Last refresh: ${this.lastRefreshDate}`);
    return true; // Eligible for refresh
  }

  public async refreshMaterializedViewsIfNeeded(): Promise<void> {
    if (this.shouldRefreshTokenPriceView()) {
      const shared = await getSharedIfConfigured();
      const logger = shared?.logger ?? console;
      logger.debug?.("refreshMaterializedViewsIfNeeded", `start refreshing materialized view 'token_price_24h_ago_view'`);
      try {
        if (!shared) {
          logger.debug?.("refreshMaterializedViewsIfNeeded", "no DB connection; skipping refresh");
          return;
        }
        await shared.db.refreshMaterializedView(shared.tokenPrice24hAgoView).concurrently();
        logger.debug?.("refreshMaterializedViewsIfNeeded", `materialized view 'token_price_24h_ago_view' refreshed`);
        this.lastRefreshDate = new Date(); // Record the time of this refresh
      } catch (refreshError) {
        logger.error?.(
          "refreshMaterializedViewsIfNeeded",
          "error refreshing materialized view 'token_price_24h_ago_view'",
          refreshError,
        );
      }
    } else {
      // Optional: Log why refresh was skipped, e.g., not in window or already refreshed today
      // console.log(
      //   `[TokenPriceService][${new Date().toISOString()}] Materialized view 'token_price_24h_ago_view' refresh skipped.`
      // );
    }
  }
}
