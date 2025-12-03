import { z } from "zod";
import { Types } from "mongoose";

import { revalidateChatList, revalidateThread } from "@/app/actions";
import { env } from "@/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { ChatMessage } from "@gr2/shared";
import { connectToDatabase, chatThreadsTable } from "@gr2/shared";
import { TRPCError } from "@trpc/server";

export const chatRouter = createTRPCRouter({
  /**
   * 
   * GET /api/chat/threads
   *
   * - Có hỗ trợ tìm kiếm theo tiêu đề
   * - Giới hạn số lượng kết quả trả về
   * 
   * Logic MongoDB:
   * - Kết nối database trước khi query
   * - Tìm threads theo userId và title (nếu có search query)
   * - Sắp xếp theo updatedAt giảm dần
   * - Lấy message cuối cùng từ array messages trong mỗi thread
   */
  getUserThreads: protectedProcedure//Lấy danh sách các thread (cuộc trò chuyện) của người dùng
    .input(
      z.object({
        limit: z.number().min(1).max(50).nullish(),
        query: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const userId = ctx.session.user.id;
      const searchQuery = input.query;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const threads = await ctx.mock.listThreads(userId);
        const threadsWithLastMessage = await Promise.all(
          threads.map(async (thread) => {
            const messages = await ctx.mock.listMessages(thread.id, 1);
            return {
              ...thread,
              lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
            };
          }),
        );
        return threadsWithLastMessage;
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa userId thành ObjectId nếu cần
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Xây dựng query filter
      const filter: Record<string, unknown> = { userId: normalizedUserId };
      if (searchQuery) {
        // Tìm kiếm tiêu đề theo regex (không phân biệt hoa thường)
        filter.title = { $regex: searchQuery, $options: "i" };
      }

      // 1. Lấy danh sách thread với projection để chỉ lấy các field cần thiết
      const threadsData = await chatThreadsTable
        .find(filter)
        .select("_id title createdAt updatedAt messages")
        .sort({ updatedAt: -1 }) // Sắp xếp giảm dần theo updatedAt
        .limit(limit)
        .lean();

      // 2. Lấy message cuối cùng từ array messages trong mỗi thread
      // Vì messages là embedded array, không cần query riêng
      const threadsWithLastMessage = threadsData.map((thread) => {
        // Lấy message cuối cùng từ array messages (đã được sắp xếp theo createdAt)
        const messages = thread.messages || [];
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        return {
          id: thread._id.toString(),
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          lastMessage: lastMessage
            ? {
                id: lastMessage._id?.toString() || "",
                role: lastMessage.role,
                parts: lastMessage.parts,
                attachments: lastMessage.attachments,
                createdAt: lastMessage.createdAt,
              }
            : null,
        };
      });

      return threadsWithLastMessage;
    }),

  /**
   * Lấy thông tin chi tiết 1 thread
   * GET /api/chat/thread/:id
   * 
   * Logic MongoDB:
   * - Tìm thread theo _id và userId để đảm bảo quyền truy cập
   * - Trả về toàn bộ thông tin thread bao gồm cả messages array
   */
  getThread: protectedProcedure
    .input(z.object({ threadId: env.USE_MOCK_DB ? z.string() : z.string() }))
    .query(async ({ ctx, input }) => {
      const { threadId } = input;
      const userId = ctx.session.user.id;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const thread = await ctx.mock.getThread(userId, threadId);
        if (!thread) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Thread không tồn tại.",
          });
        }
        return thread;
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa IDs
      const normalizedThreadId = Types.ObjectId.isValid(threadId) ? new Types.ObjectId(threadId) : threadId;
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Tìm thread theo _id và userId để đảm bảo quyền truy cập
      const thread = await chatThreadsTable
        .findOne({
          _id: normalizedThreadId,
          userId: normalizedUserId,
        })
        .lean();

      if (!thread) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread không tồn tại.",
        });
      }

      // Chuyển đổi _id thành string để tương thích với frontend
      return {
        ...thread,
        id: thread._id.toString(),
      };
    }),

  /**
   * Tạo mới 1 thread
   * POST /api/chat/thread
   * 
   * Logic MongoDB:
   * - Tạo document mới với userId, title và messages array rỗng
   * - Mongoose tự động tạo _id và timestamps (createdAt, updatedAt)
   */
  createThread: protectedProcedure
    .input(z.object({ title: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const newThread = await ctx.mock.createThread(userId, input.title ?? "New Chat");
        revalidateChatList();
        revalidateThread(newThread.id);
        return newThread;
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa userId
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Tạo thread mới
      const newThread = await chatThreadsTable.create({
        userId: normalizedUserId,
        title: input.title ?? "New Chat",
        messages: [], // Khởi tạo messages array rỗng
      });

      if (!newThread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Không thể tạo thread.",
        });
      }

      revalidateChatList();
      revalidateThread(newThread._id.toString());

      // Chuyển đổi _id thành string
      return {
        ...newThread.toObject(),
        id: newThread._id.toString(),
      };
    }),

  /**
   * Cập nhật tiêu đề thread
   * PUT /api/chat/thread
   * 
   * Logic MongoDB:
   * - Tìm và cập nhật thread theo _id và userId
   * - Mongoose tự động cập nhật updatedAt timestamp
   */
  updateThread: protectedProcedure
    .input(z.object({ threadId: env.USE_MOCK_DB ? z.string() : z.string(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { threadId, title } = input;
      const userId = ctx.session.user.id;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const updatedThread = await ctx.mock.updateThread(userId, threadId, title);
        revalidateThread(threadId);
        return updatedThread;
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa IDs
      const normalizedThreadId = Types.ObjectId.isValid(threadId) ? new Types.ObjectId(threadId) : threadId;
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Cập nhật thread (findOneAndUpdate tự động cập nhật updatedAt)
      const updatedThread = await chatThreadsTable
        .findOneAndUpdate(
          {
            _id: normalizedThreadId,
            userId: normalizedUserId,
          },
          { title },
          { new: true } // Trả về document sau khi update
        )
        .lean();

      if (!updatedThread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Không thể cập nhật thread.",
        });
      }

      revalidateThread(threadId);

      // Chuyển đổi _id thành string
      return {
        ...updatedThread,
        id: updatedThread._id.toString(),
      };
    }),

  /**
   * Lấy danh sách message thuộc 1 thread
   * GET /api/chat/messages
   * 
   * Logic MongoDB:
   * - Kiểm tra quyền truy cập thread trước
   * - Lấy messages từ array embedded trong thread document
   * - Sắp xếp theo createdAt tăng dần (từ cũ đến mới)
   * - Giới hạn số lượng messages trả về
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        threadId: env.USE_MOCK_DB ? z.string() : z.string(),
        limit: z.number().min(1).max(100).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const { threadId } = input;
      const userId = ctx.session.user.id;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const thread = await ctx.mock.getThread(userId, threadId);
        if (!thread) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Không tìm thấy thread hoặc bạn không có quyền truy cập.",
          });
        }
        return await ctx.mock.listMessages(threadId, limit);
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa IDs
      const normalizedThreadId = Types.ObjectId.isValid(threadId) ? new Types.ObjectId(threadId) : threadId;
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Kiểm tra quyền truy cập thread
      const thread = await chatThreadsTable
        .findOne({
          _id: normalizedThreadId,
          userId: normalizedUserId,
        })
        .select("messages")
        .lean();

      if (!thread) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Không tìm thấy thread hoặc bạn không có quyền truy cập.",
        });
      }

      // Lấy messages từ array, sắp xếp theo createdAt tăng dần và giới hạn số lượng
      const messages = (thread.messages || [])
        .sort((a, b) => {
          // Sắp xếp theo createdAt tăng dần (cũ nhất trước)
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeA - timeB;
        })
        .slice(0, limit)
        .map((msg) => ({
          id: msg._id?.toString() || "",
          role: msg.role,
          parts: msg.parts,
          attachments: msg.attachments,
          createdAt: msg.createdAt,
        }));

      return messages;
    }),

  /**
   * Tạo message mới trong thread
   * POST /api/chat/message
   * 
   * Logic MongoDB:
   * - Kiểm tra quyền truy cập thread trước
   * - Thêm message mới vào array messages trong thread document
   * - Sử dụng $push để thêm message vào array
   * - Mongoose tự động cập nhật updatedAt của thread
   */
  createMessage: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(), // MongoDB sẽ tự tạo _id cho message nếu không có
        threadId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.any(), // Schema.Types.Mixed
        attachments: z.any(), // Schema.Types.Mixed
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { threadId, role, parts, attachments } = input;
      const userId = ctx.session.user.id;

      // Nếu dùng mock DB
      if (ctx.useMockDb && ctx.mock) {
        const thread = await ctx.mock.getThread(userId, threadId);
        if (!thread) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Không có quyền gửi tin nhắn vào thread này.",
          });
        }

        const insertedMessage = await ctx.mock.createMessage({
          id: input.id || "",
          threadId,
          role,
          parts,
          attachments,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as ChatMessage);

        revalidateThread(threadId);
        return insertedMessage;
      }

      // Kết nối MongoDB
      await connectToDatabase();

      // Chuẩn hóa IDs
      const normalizedThreadId = Types.ObjectId.isValid(threadId) ? new Types.ObjectId(threadId) : threadId;
      const normalizedUserId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

      // Kiểm tra quyền truy cập thread
      const thread = await chatThreadsTable.findOne({
        _id: normalizedThreadId,
        userId: normalizedUserId,
      });

      if (!thread) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Không có quyền gửi tin nhắn vào thread này.",
        });
      }

      // Tạo message object mới
      const newMessage = {
        role,
        parts,
        attachments,
        createdAt: new Date(),
      };

      // Thêm message vào array messages và cập nhật updatedAt của thread
      // findOneAndUpdate tự động cập nhật updatedAt nhờ timestamps option trong schema
      const updatedThread = await chatThreadsTable.findOneAndUpdate(
        {
          _id: normalizedThreadId,
          userId: normalizedUserId,
        },
        {
          $push: { messages: newMessage },
        },
        { new: true } // Trả về document sau khi update
      );

      if (!updatedThread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Không thể gửi tin nhắn.",
        });
      }

      // Lấy message vừa thêm (message cuối cùng trong array)
      const insertedMessage = updatedThread.messages[updatedThread.messages.length - 1];

      revalidateThread(threadId);

      // Trả về message với format tương thích
      return {
        id: insertedMessage._id?.toString() || "",
        threadId,
        role: insertedMessage.role,
        parts: insertedMessage.parts,
        attachments: insertedMessage.attachments,
        createdAt: insertedMessage.createdAt,
      };
    }),
});

export type ChatRouter = typeof chatRouter;
