// Import hàm tạo router và publicProcedure từ tRPC → dùng để định nghĩa API endpoint
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Thư viện BigNumber dùng để xử lý số lớn, tránh lỗi số thực (floating-point)
import BigNumber from "bignumber.js";

// Import zod để validate input của API
import { z } from "zod";

// Import các hàm và bảng dữ liệu từ module shared (Mongo hoặc mock DB)
import {
  connectToDatabase,
  tokenPricesTable,
  tokensTable,
  usersTable,
  type TokenSelect,
  type UserSelect,
} from "@gr2/shared";

// Hàm tính % thay đổi giá giữa giá hiện tại và giá cũ
function calculatePriceChange(currentPrice: string, oldPrice: string): string {
  const current = parseFloat(currentPrice); // chuyển chuỗi → số
  const old = parseFloat(oldPrice);        // chuyển chuỗi → số

  // Nếu giá cũ = 0 hoặc lỗi → không tính được % → trả về 0
  if (old === 0 || isNaN(old) || isNaN(current)) {
    return "0";
  }

  // Công thức tính % thay đổi: (current - old) / old * 100
  const changePercent = ((current - old) / old) * 100;

  return changePercent.toFixed(2); // làm tròn đến 2 chữ số
}

// Định nghĩa router chính của portfolio
export const portfolioRouter = createTRPCRouter({
  /**
   * API lấy danh mục đầu tư của user (Portfolio)
   * GET /api/portfolio/:wallet_address
   */
  getUserPortfolio: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(), // ví người dùng
        forceRefresh: z.boolean().optional().default(false), // ép cập nhật giá từ API ngoài
      }),
    )
    .query(async ({ ctx, input }) => {

      // Nếu không dùng mock DB thì connect vào MongoDB
      if (!(ctx.useMockDb && ctx.mock)) {
        await connectToDatabase();
      }

      // Tìm user theo wallet address
      let user: UserSelect | null | undefined =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress) // tìm trong mock DB
          : (await usersTable.findOne({ walletAddress: input.walletAddress }).lean()) ?? null;

      // Nếu user chưa có mà đang mock → tạo mới
      if (!user && ctx.useMockDb && ctx.mock) {
        user = await ctx.mock.ensureUser(input.walletAddress);
      }

      // Không tìm thấy → báo lỗi
      if (!user) {
        throw new Error("User not found");
      }

      // Lấy danh sách token mà user đang giữ (balance)
      const balances =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserBalances(user.id)
          : user.balances ?? [];

      // Lấy danh sách địa chỉ token để fetch giá
      const tokenAddresses = balances.map((balance) => balance.tokenAddress);

      // TODO: forceRefresh → cập nhật giá mới từ API bên ngoài

      // priceMap: tokenAddress → giá hiện tại
      let priceMap: Record<string, string> = {};

      // oldPrices: placeholder để sau này lưu giá 24h trước
      const oldPrices = new Map<string, string>();

      // Nếu user có token thì fetch giá
      if (tokenAddresses.length > 0) {
        if (ctx.useMockDb && ctx.mock) {
          const rows = await ctx.mock.getTokenPrices(tokenAddresses);
          for (const r of rows) priceMap[r.tokenAddress] = r.priceUsd; // Lưu giá vào map
        } else {
          await connectToDatabase();
          const currentPrices = await tokenPricesTable
            .find({ tokenAddress: { $in: tokenAddresses } })
            .lean();

          // Lưu giá hiện tại vào map
          for (const price of currentPrices) {
            priceMap[price.tokenAddress] = price.priceUsd;
          }
        }
      }

      // Lấy thông tin metadata của token: symbol, icon, decimals...
      const tokens =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getAllTokens()
          : tokenAddresses.length > 0
            ? await tokensTable.find({ address: { $in: tokenAddresses } }).lean()
            : [];

      // Map tokenAddress → token metadata
      const tokenMetaMap = new Map<string, TokenSelect | undefined>();
      for (const token of tokens) {
        tokenMetaMap.set(token.address, token as unknown as TokenSelect);
      }

      // Tính tổng giá trị portfolio
      let totalValue = new BigNumber(0);

      const portfolio = balances.map((balance) => {
        const countBalance = balance.balance ?? "0"; // số token
        const embeddedToken = (balance as { token?: TokenSelect }).token; // nếu balance có token metadata sẵn
        const fallbackToken = embeddedToken ?? tokenMetaMap.get(balance.tokenAddress); // nếu không thì lấy từ DB
        const tokenPrice = priceMap[balance.tokenAddress] || "0"; // giá token
        const valueUsd = new BigNumber(countBalance).multipliedBy(tokenPrice).toString(); // số token × giá
        const symbol = fallbackToken?.symbol ?? "UNKNOWN"; // ký hiệu
        const iconUrl = fallbackToken?.iconUrl ?? ""; // icon

        totalValue = totalValue.plus(valueUsd); // Cộng vào tổng danh mục

        return {
          symbol,
          tokenAddress: balance.tokenAddress,
          balance: countBalance,
          priceUsd: tokenPrice,
          valueUsd,
          priceChange24h: "0", // tính sau
          iconUrl,
        };
      });

      // Tính phần trăm thay đổi giá 24 giờ
      const tokensWithPriceChange = portfolio.map((token) => {
        const oldPrice = oldPrices.get(token.tokenAddress);
        const priceChange = oldPrice ? calculatePriceChange(token.priceUsd, oldPrice) : "0";
        return {
          ...token,
          priceChange24h: priceChange,
        };
      });

      // Danh sách vị thế Perp (hiện chưa xử lý nên trả rỗng)
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

      // Tính giá trị các vị thế perp
      const perpPositionsData = perpPositions.map((position) => {
        const currentPrice = priceMap[position.tokenAddress] || "0";
        const positionValue = new BigNumber(position.positionSize).multipliedBy(currentPrice);

        return {
          id: position.id,
          symbol: position.token.symbol,
          tokenAddress: position.tokenAddress,
          direction: position.positionDirection,
          leverage: position.leverage,
          entryPrice: position.entryPrice,
          currentPrice,
          positionSize: position.positionSize,
          collateralAmount: position.collateralAmount,
          liquidationPrice: position.liquidationPrice,
          valueUsd: positionValue.toString(),
        };
      });

      // Trả về kết quả portfolio
      return {
        wallet_address: input.walletAddress,
        total_value_usd: totalValue.toString(),
        tokens: tokensWithPriceChange.sort((a, b) =>
          new BigNumber(b.valueUsd).minus(a.valueUsd).toNumber()
        ), // sắp theo giá trị giảm dần
        perp_positions: perpPositionsData,
        last_updated: new Date(), // timestamp
      };
    }),

  /**
   * API lấy dữ liệu PNL theo thời gian
   * GET /api/pnl/:wallet_address?period=7d
   */
  getUserPnl: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        period: z.enum(["1d", "7d", "30d", "90d", "1y"]).default("1d"), // khoảng thời gian
      }),
    )
    .query(async ({ ctx, input }) => {

      // Connect DB nếu không dùng mock
      if (!(ctx.useMockDb && ctx.mock)) {
        await connectToDatabase();
      }

      // Lấy user
      let user: UserSelect | null | undefined =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress)
          : (await usersTable.findOne({ walletAddress: input.walletAddress }).lean()) ?? null;

      // Nếu mock mà chưa có user → tạo mới
      if (!user && ctx.useMockDb && ctx.mock) {
        user = await ctx.mock.ensureUser(input.walletAddress);
      }

      // Không có user → lỗi
      if (!user) {
        throw new Error("User not found");
      }

      // Tính ngày bắt đầu dựa trên period
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

      // Snapshot PNL (mock)
      const snapshots: Array<{ timestamp: Date; totalValueUsd: BigNumber }> =
        ctx.useMockDb ? [] : [];

      // Nếu không có snapshot → chỉ trả về giá trị hiện tại (placeholder)
      if (snapshots.length === 0) {
        const currentValue = "0";

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

      // Xử lý dữ liệu snapshot để tính PNL
      const initialValue = snapshots[0]?.totalValueUsd || new BigNumber(0);

      const pnlData = snapshots.map((snapshot) => {
        const value = snapshot.totalValueUsd.toString();
        const pnlAbsolute = new BigNumber(value).minus(initialValue.toString()).toString();
        const pnlPercentage =
          initialValue.toString() !== "0"
            ? new BigNumber(pnlAbsolute)
                .dividedBy(initialValue.toString())
                .multipliedBy(100)
                .toString()
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

  /**
   * Lấy danh sách NFT của user
   */
  getUserNfts: publicProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ ctx, input }) => {

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

      // Nếu không mock thì hệ thống chưa hỗ trợ NFT → trả về mảng rỗng
      return [] as Array<{
        id: string;
        name: string;
        image_url: string;
        collection: { name: string };
      }>;
    }),
});
