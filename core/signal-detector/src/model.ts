import { ChatOpenAI } from "@langchain/openai";

export function getDefaultSignalChatModel() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY);
  if (!hasOpenAiKey) return null;

  return new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.1,
    maxTokens: 1500,
  });
}
