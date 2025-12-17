import { ChatOpenAI } from "@langchain/openai";

export function getProposalChatModel(modelName: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini") {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY);
  if (!hasOpenAiKey) return null;

  if (modelName === "gpt-4o") {
    return new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.7 });
  }

  return new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });
}

