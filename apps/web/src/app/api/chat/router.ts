import { generateTitleFromUserMessage } from "@/app/actions";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/provider";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { generateUUID } from "@/utils";
import { type UIMessage, createDataStreamResponse, smoothStream, streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Lấy dữ liệu từ request: id của thread và danh sách message client gửi lên
    const { id, messages }: { id: string; messages: Array<UIMessage> } = await request.json();

    // Kiểm tra đăng nhập
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Lấy message cuối cùng (phải là của user)
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user") {
      return new Response("No user message found", { status: 400 });
    }

    // Chuẩn hóa parts của message (đảm bảo part.type === "text" luôn là string)
    const userMessageParts = userMessage.parts?.map((part) => {
      if (part.type === "text") {
        return {
          type: "text",
          text: typeof part.text === "string" ? part.text : "",
        };
      }
      return part;
    }) ?? [{ type: "text", text: userMessage.content || "" }];

    // Lấy thread từ database
    const thread = await api.chat.getThread({ threadId: id });

    if (!thread) {
      return new Response("Thread not found", { status: 404 });
    }

    // Không cho phép người khác truy cập vào thread của user khác
    if (thread.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Tự động tạo tiêu đề thread dựa trên tin nhắn đầu tiên hoặc mới
    const title = await generateTitleFromUserMessage({ message: userMessage });

    // Cập nhật tiêu đề thread trong DB
    await api.chat.updateThread({
      threadId: id,
      title,
    });

    // Lưu message của user vào DB
    await api.chat.createMessage({
      id: generateUUID(),
      threadId: id,
      role: userMessage.role,
      parts: userMessageParts,
      attachments: userMessage.experimental_attachments ?? [],
    });

    // Tạo phản hồi dạng streaming gửi về client
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          // Gọi model AI
          model: myProvider.languageModel(DEFAULT_CHAT_MODEL),

          // System prompt (hướng dẫn AI)
          system: systemPrompt({ selectedChatModel: DEFAULT_CHAT_MODEL }),

          // Gửi toàn bộ message (conversation history)
          messages,

          // Cho phép mô hình reasoning (tối đa 5 bước)
          maxSteps: 5,

          // Làm mượt stream theo từ (đỡ bị giật)
          experimental_transform: smoothStream({ chunking: "word" }),

          // Sinh ID cho message AI
          experimental_generateMessageId: generateUUID,

          // Hàm gọi khi AI trả lời xong
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                // Lấy message cuối của AI
                const assistantMessage = response.messages[response.messages.length - 1] as UIMessage;
                if (!assistantMessage || assistantMessage.role !== "assistant") {
                  throw new Error("No assistant message found!");
                }

                // Chuẩn hóa phần content của AI (chỉ text)
                const assistantMessageParts = [
                  {
                    type: "text",
                    text: assistantMessage.content || "",
                  },
                ];

                // Lưu phản hồi của AI vào DB
                await api.chat.createMessage({
                  id: assistantMessage.id,
                  threadId: id,
                  role: assistantMessage.role,
                  parts: assistantMessageParts,
                  attachments: assistantMessage.experimental_attachments ?? [],
                });
              } catch (error) {
                console.error("Failed to save chat", error);
              }
            }
          },
        });

        // Bắt đầu stream dữ liệu
        result.consumeStream();
        // Merge vào dataStream để gửi về client
        result.mergeIntoDataStream(dataStream);
      },

      // Xử lý lỗi xảy ra trong quá trình streaming
      onError: (error) => {
        console.error(error);
        return "sorry, something went wrong";
      },
    });
  } catch (error) {
    // Lỗi ngoài dự kiến
    console.error("API error:", error);
    return new Response("An error occurred while processing the request", { status: 500 });
  }
}
