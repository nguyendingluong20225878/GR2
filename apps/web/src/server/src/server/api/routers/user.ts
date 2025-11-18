import { revalidateProfile } from "@/app/actions";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import type { UserSelect } from "@gr2/shared";
import { usersTable } from "@gr2/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Router xử lý các API liên quan đến Users
export const usersRouter = createTRPCRouter({

  /**
   * Lấy thông tin user qua địa chỉ ví (wallet address)
   * GET /api/users/:wallet_address
   */
  getUserByWallet: publicProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ ctx, input }) => {
      // Nếu dùng mock DB (cho môi trường dev/test) thì lấy từ mock
      const user: UserSelect | null =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress)
          : (
              (await ctx.db.query.usersTable.findFirst({
                where: eq(usersTable.walletAddress, input.walletAddress),
              })) ?? null
            );

      return user;
    }),

  /**
   * Tạo mới một user
   * POST /api/users
   */
  createUser: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        username: z.string().optional(),
        email: z.string().email().optional(),
        tradeStyle: z.string().optional().default("default"),
        totalAssetUsd: z.number().optional().default(0),
        cryptoInvestmentUsd: z.number().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Kiểm tra user đã tồn tại chưa
      const existingUser: UserSelect | null =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(input.walletAddress)
          : (
              (await ctx.db.query.usersTable.findFirst({
                where: eq(usersTable.walletAddress, input.walletAddress),
              })) ?? null
            );

      if (existingUser) {
        // Nếu user đã tồn tại → trả về user đó
        return existingUser;
      }

      // Nếu dùng mock DB thì tạo user trong mock
      if (ctx.useMockDb && ctx.mock) {
        const ensured = await ctx.mock.ensureUser(input.walletAddress);
        return ensured;
      }

      // Tạo user mới trong DB thật
      const [newUser] = await ctx.db
        .insert(usersTable)
        .values({
          walletAddress: input.walletAddress,
          name: input.username || `User-${input.walletAddress.slice(0, 8)}`,
          email: input.email || `${input.walletAddress.slice(0, 8)}@example.com`,
          age: 0,
          tradeStyle: input.tradeStyle,
          totalAssetUsd: input.totalAssetUsd,
          cryptoInvestmentUsd: input.cryptoInvestmentUsd,
        })
        .returning();

      return newUser;
    }),

  /**
   * Lấy user settings của user đang đăng nhập
   * GET /api/users/settings
   */
  getUserSettings: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user?.walletAddress) {
      throw new Error("Người dùng chưa đăng nhập hoặc không tìm thấy địa chỉ ví");
    }

    // Lấy thông tin user theo wallet address
    const user: UserSelect | null =
      ctx.useMockDb && ctx.mock
        ? await ctx.mock.getUserByWallet(ctx.session.user.walletAddress)
        : (
            (await ctx.db.query.usersTable.findFirst({
              where: eq(usersTable.walletAddress, ctx.session.user.walletAddress),
            })) ?? null
          );

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Trả về settings của user
    // Trả về cài đặt của người dùng
    return {
      tradeStyle: user.tradeStyle || "swing",
      totalAssetUsd: user.totalAssetUsd?.toString() || "0",
      cryptoInvestmentUsd: user.cryptoInvestmentUsd?.toString() || "0",
      age: user.age?.toString() || "0",
    };
  }),

  /**
   * Cập nhật user settings của user đang đăng nhập
   * PUT /api/users/settings
   */
  updateUserSettings: protectedProcedure
    .input(
      z.object({
        riskTolerance: z.enum(["low", "medium", "high"]).optional(),
        tradeStyle: z.enum(["day", "swing", "long"]).optional(),
        totalAssetUsd: z.string().optional(),
        cryptoInvestmentUsd: z.string().optional(),
        age: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.walletAddress) {
        throw new Error("Người dùng chưa đăng nhập hoặc không tìm thấy địa chỉ ví");
      }

      // Xác nhận sự tồn tại của user
      const user: UserSelect | null =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(ctx.session.user.walletAddress)
          : (
              (await ctx.db.query.usersTable.findFirst({
                where: eq(usersTable.walletAddress, ctx.session.user.walletAddress),
              })) ?? null
            );

      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Nếu dùng mock database
      if (ctx.useMockDb && ctx.mock) {
        const updated = await ctx.mock.updateUserPartial(user.id, {
          riskTolerance: (input.riskTolerance ?? user.riskTolerance) as string,
          tradeStyle: (input.tradeStyle ?? user.tradeStyle) as string,
          totalAssetUsd: input.totalAssetUsd ? parseInt(input.totalAssetUsd, 10) : user.totalAssetUsd,
          cryptoInvestmentUsd: input.cryptoInvestmentUsd
            ? parseInt(input.cryptoInvestmentUsd, 10)
            : user.cryptoInvestmentUsd,
          age: input.age ? parseInt(input.age, 10) : user.age,
        });
        revalidateProfile();
        return updated;
      }

      // Cập nhật dữ liệu user trong DB thật
      const [updatedUser] = await ctx.db
        .update(usersTable)
        .set({
          riskTolerance: input.riskTolerance,
          tradeStyle: input.tradeStyle,
          totalAssetUsd: input.totalAssetUsd ? parseInt(input.totalAssetUsd, 10) : user.totalAssetUsd,
          cryptoInvestmentUsd: input.cryptoInvestmentUsd
            ? parseInt(input.cryptoInvestmentUsd, 10)
            : user.cryptoInvestmentUsd,
          age: input.age ? parseInt(input.age, 10) : user.age,
        })
        .where(eq(usersTable.id, user.id))
        .returning();

      // Revalidate để cập nhật cache UI
      revalidateProfile();

      return updatedUser;
    }),

  /**
   * Kết nối tài khoản Twitter
   * POST /api/users/twitter/connect
   */
  connectTwitter: protectedProcedure
    .input(z.object({ twitterUsername: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.walletAddress) {
        throw new Error("Người dùng chưa đăng nhập hoặc không tìm thấy địa chỉ ví");
      }

      // Xác nhận sự tồn tại của user+3-
      const user: UserSelect | null =
        ctx.useMockDb && ctx.mock
          ? await ctx.mock.getUserByWallet(ctx.session.user.walletAddress)
          : (
              (await ctx.db.query.usersTable.findFirst({
                where: eq(usersTable.walletAddress, ctx.session.user.walletAddress),
              })) ?? null
            );

      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Với mock DB → chỉ trả user
      if (ctx.useMockDb && ctx.mock) {
        return user;
      }

      // Update DB thật
      const [updatedUser] = await ctx.db
        .update(usersTable)
        .set({})
        .where(eq(usersTable.id, user.id))
        .returning();

      return updatedUser;
    }),
});
