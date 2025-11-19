import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import BigNumber from "bignumber.js";
import { z } from "zod";

import {
  connectToDatabase,
  tokenPricesTable,
  tokensTable,
  usersTable,
  type TokenSelect,
  type UserSelect,
} from "@gr2/shared";

// 価格変動率を計算する関数
function calculatePriceChange(currentPrice: string, oldPrice: string): string {
  const current = parseFloat(currentPrice);
  const old = parseFloat(oldPrice);

  if (old === 0 || isNaN(old) || isNaN(current)) {
    return "0";
  }

  const changePercent = ((current - old) / old) * 100;
  return changePercent.toFixed(2);
}

export const portfolioRouter = createTRPCRouter({
  /**
   * Get user portfolio data
   * GET /api/portfolio/:wallet_address
   */
  getUserPortfolio: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        forceRefresh: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!(ctx.useMockDb && ctx.mock)) {
        await connectToDatabase();
      }

      // Get user by wallet address
      let user: UserSelect | null | undefined =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress)
          : (await usersTable.findOne({ walletAddress: input.walletAddress }).lean()) ?? null;

      if (!user && ctx.useMockDb && ctx.mock) {
        user = await ctx.mock.ensureUser(input.walletAddress);
      }

      if (!user) {
        throw new Error("User not found");
      }

      // Get user's token balances
      const balances =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserBalances(user.id)
          : user.balances ?? [];

      // Get token prices
      const tokenAddresses = balances.map((balance) => balance.tokenAddress);

      // TODO: If forceRefresh is true, update token prices from external API

      // Fetch current and 24h-ago prices in parallel
      let priceMap: Record<string, string> = {};
      const oldPrices = new Map<string, string>(); // Placeholder until we implement historical prices
      if (tokenAddresses.length > 0) {
        if (ctx.useMockDb && ctx.mock) {
          const rows = await ctx.mock.getTokenPrices(tokenAddresses);
          for (const r of rows) priceMap[r.tokenAddress] = r.priceUsd;
        } else {
          await connectToDatabase();
          const currentPrices = await tokenPricesTable
            .find({ tokenAddress: { $in: tokenAddresses } })
            .lean();
          for (const price of currentPrices) {
            priceMap[price.tokenAddress] = price.priceUsd;
          }
        }
      }

      // fetch token metadata for balances
      const tokens =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getAllTokens()
          : tokenAddresses.length > 0
            ? await tokensTable.find({ address: { $in: tokenAddresses } }).lean()
            : [];

      const tokenMetaMap = new Map<string, TokenSelect | undefined>();
      for (const token of tokens) {
        tokenMetaMap.set(token.address, token as unknown as TokenSelect);
      }

      // Calculate total value and build portfolio
      let totalValue = new BigNumber(0);
      const portfolio = balances.map((balance) => {
        const countBalance = balance.balance ?? "0";
        const embeddedToken = (balance as { token?: TokenSelect }).token;
        const fallbackToken = embeddedToken ?? tokenMetaMap.get(balance.tokenAddress);
        const tokenPrice = priceMap[balance.tokenAddress] || "0";
        const valueUsd = new BigNumber(countBalance).multipliedBy(tokenPrice).toString();
        const symbol = fallbackToken?.symbol ?? "UNKNOWN";
        const iconUrl = fallbackToken?.iconUrl ?? "";

        // Add to total
        totalValue = totalValue.plus(valueUsd);

        return {
          symbol,
          tokenAddress: balance.tokenAddress,
          balance: countBalance,
          priceUsd: tokenPrice,
          valueUsd: valueUsd,
          priceChange24h: "0", // Will be calculated next
          iconUrl,
        };
      });

      // 24時間の価格変動を計算
      const tokensWithPriceChange = portfolio.map((token) => {
        const oldPrice = oldPrices.get(token.tokenAddress);
        const priceChange = oldPrice ? calculatePriceChange(token.priceUsd, oldPrice) : "0";
        return {
          ...token,
          priceChange24h: priceChange,
        };
      });

      // Get open perp positions
      const perpPositions: Array<{
        id: string;
        tokenAddress: string;
        token?: TokenSelect;
        positionDirection: string;
        leverage: string;
        entryPrice: string;
        positionSize: string;
        collateralAmount: string;
        liquidationPrice: string;
      }> = ctx.useMockDb ? [] : [];

      // Process perp positions and calculate their values
      const perpPositionsData = perpPositions.map((position) => {
        const currentPrice = priceMap[position.tokenAddress] || "0";
        // Basic calculation of position value (simplified)
        const positionValue = new BigNumber(position.positionSize).multipliedBy(currentPrice);

        return {
          id: position.id,
          symbol: position.token.symbol,
          tokenAddress: position.tokenAddress,
          direction: position.positionDirection,
          leverage: position.leverage,
          entryPrice: position.entryPrice,
          currentPrice: currentPrice,
          positionSize: position.positionSize,
          collateralAmount: position.collateralAmount,
          liquidationPrice: position.liquidationPrice,
          valueUsd: positionValue.toString(),
        };
      });

      return {
        wallet_address: input.walletAddress,
        total_value_usd: totalValue.toString(),
        tokens: tokensWithPriceChange.sort((a, b) => new BigNumber(b.valueUsd).minus(a.valueUsd).toNumber()),
        perp_positions: perpPositionsData,
        last_updated: new Date(),
      };
    }),

  /**
   * Get user PnL time series data
   * GET /api/pnl/:wallet_address?period=7d
   */
  getUserPnl: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        period: z.enum(["1d", "7d", "30d", "90d", "1y"]).default("1d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!(ctx.useMockDb && ctx.mock)) {
        await connectToDatabase();
      }

      // Get user by wallet address
      let user: UserSelect | null | undefined =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress)
          : (await usersTable.findOne({ walletAddress: input.walletAddress }).lean()) ?? null;

      if (!user && ctx.useMockDb && ctx.mock) {
        user = await ctx.mock.ensureUser(input.walletAddress);
      }

      if (!user) {
        throw new Error("User not found");
      }

      // Calculate start date based on period
      const now = new Date();
      let startDate = new Date();

      switch (input.period) {
        case "1d":
          startDate.setDate(now.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
        case "1y":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Get snapshots for the period
      const snapshots: Array<{ timestamp: Date; totalValueUsd: BigNumber }> = ctx.useMockDb ? [] : [];

      // If no snapshots, return current portfolio value
      if (snapshots.length === 0) {
        // Get current portfolio value (simplified)
        const currentValue = "0"; // This should be calculated or fetched

        return {
          wallet_address: input.walletAddress,
          period: input.period,
          data_points: 1,
          pnl_data: [
            {
              timestamp: now,
              value: currentValue,
              pnl_absolute: "0",
              pnl_percentage: "0",
            },
          ],
        };
      }

      // Process snapshots to create PnL data
      const initialValue = snapshots[0]?.totalValueUsd || new BigNumber(0);

      const pnlData = snapshots.map((snapshot) => {
        const value = snapshot.totalValueUsd.toString();
        const pnlAbsolute = new BigNumber(value).minus(initialValue.toString()).toString();
        const pnlPercentage =
          initialValue.toString() !== "0"
            ? new BigNumber(pnlAbsolute).dividedBy(initialValue.toString()).multipliedBy(100).toString()
            : "0";

        return {
          timestamp: snapshot.timestamp,
          value,
          pnl_absolute: pnlAbsolute,
          pnl_percentage: pnlPercentage,
        };
      });

      const lastItem = pnlData[pnlData.length - 1];

      return {
        wallet_address: input.walletAddress,
        period: input.period,
        data_points: pnlData.length,
        pnl_data: pnlData,
        summary: {
          initial_value: initialValue.toString(),
          current_value: lastItem ? lastItem.value : "0",
          pnl_absolute: lastItem ? lastItem.pnl_absolute : "0",
          pnl_percentage: lastItem ? lastItem.pnl_percentage : "0",
        },
      };
    }),

  getUserNfts: publicProcedure.input(z.object({ walletAddress: z.string() })).query(async ({ ctx, input }) => {
    if (!(ctx.useMockDb && ctx.mock)) {
      await connectToDatabase();
    }

    let user: UserSelect | null | undefined =
      ctx.useMockDb && ctx.mock
        ? await ctx.mock.getUserByWallet(input.walletAddress)
        : (await usersTable.findOne({ walletAddress: input.walletAddress }).lean()) ?? null;

    if (!user && ctx.useMockDb && ctx.mock) {
      user = await ctx.mock.ensureUser(input.walletAddress);
    }

    if (!user) {
      throw new Error("User not found");
    }

    if (ctx.useMockDb && ctx.mock) {
      return ctx.mock.getNfts(user.id);
    }

    return [] as Array<{
      id: string;
      name: string;
      image_url: string;
      collection: { name: string };
    }>;
  }),
});
