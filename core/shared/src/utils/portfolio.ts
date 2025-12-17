import { Types, Model } from "mongoose";
import { connectToDatabase } from "../db";
import { tokenPricesTable as _tokenPricesTable } from "../db/schema/token_prices";
import { tokensTable as _tokensTable, TokenSchema } from "../db/schema/tokens";
import { usersTable } from "../db/schema/users";
import { logger } from "./logger";

/* ✅ CAST MODEL 1 LẦN DUY NHẤT */
const tokensTable = _tokensTable as Model<TokenSchema>;
const tokenPricesTable = _tokenPricesTable as Model<{
  tokenAddress: string;
  priceUsd: string;
}>;

export async function setupInitialPortfolio(
  userId: string,
  options?: {
    customBalances?: Record<string, number>;
    specificSymbols?: string[];
  },
): Promise<void> {
  try {
    await connectToDatabase();

    /* ===============================
       1. QUERY TOKENS
    =============================== */

    const tokenQuery =
      options?.specificSymbols?.length
        ? { symbol: { $in: options.specificSymbols } }
        : {};

    const tokens = await tokensTable.find(tokenQuery).lean();

    if (!tokens.length) {
      logger.error(
        "setupInitialPortfolio",
        "Không tìm thấy token để setup portfolio",
      );
      return;
    }

    /* ===============================
       2. QUERY PRICES (HẾT TS2349)
    =============================== */

    const tokenPrices = await tokenPricesTable
      .find({
        tokenAddress: { $in: tokens.map((t) => t.address) },
      })
      .lean();

    /* ===============================
       3. BUILD PRICE MAP
    =============================== */

    const priceMap = new Map<string, number>();
    for (const tp of tokenPrices) {
      const price = Number(tp.priceUsd);
      priceMap.set(tp.tokenAddress, Number.isFinite(price) ? price : 0);
    }

    /* ===============================
       4. DEFAULT BALANCES
    =============================== */

    const defaultUsdBalances: Record<string, number> = {
      SOL: 2000,
      JUP: 1000,
      JTO: 1000,
      RAY: 1000,
      HNT: 1000,
      PYTH: 1000,
      TRUMP: 1000,
      WIF: 1000,
      W: 1000,
      MEW: 1000,
      POPCAT: 1000,
      ORCA: 1000,
      ZEUS: 1000,
      KMNO: 1000,
      WBTC: 2000,
      USDC: 2000,
      BONK: 1000,
      WSUI: 1000,
      BIO: 1000,
      LAYER: 1000,
      AIXBT: 1000,
      ACT: 1000,
      Fartcoin: 1000,
      MELANIA: 1000,
    };

    /* ===============================
       5. CALCULATE BALANCES
    =============================== */

    const balancesToInsert = tokens
      .map((token) => {
        const usdAmount =
          options?.customBalances?.[token.symbol] ??
          defaultUsdBalances[token.symbol] ??
          0;

        const price = priceMap.get(token.address) ?? 0;
        const tokenAmount = price > 0 ? usdAmount / price : 0;

        return {
          tokenAddress: token.address,
          balance: tokenAmount.toString(),
          updatedAt: new Date(),
        };
      })
      .filter((b) => Number(b.balance) > 0);

    /* ===============================
       6. UPDATE USER
    =============================== */

    const normalizedUserId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;

    if (balancesToInsert.length) {
      await usersTable.updateOne(
        { _id: normalizedUserId },
        { $set: { balances: balancesToInsert } },
      );
    }

    logger.info(
      "setupInitialPortfolio",
      `Completed portfolio setup for user ${userId}`,
    );
  } catch (error) {
    logger.error(
      "setupInitialPortfolio",
      "Failed to setup initial portfolio",
      error,
    );
    throw error;
  }
}
