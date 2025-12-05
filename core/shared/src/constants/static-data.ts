import type { ProposalInsert, TokenInsert } from "../db/schema";

export const initialTokens: TokenInsert[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
    type: "normal",
    iconUrl: "/tokens/SOL.png",
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    type: "normal",
    iconUrl: "/tokens/USDC.png",
  },
];

const STATIC_EXPIRATION_DATE = 1000 * 60 * 60 * 24;

export const staticProposals = [
  {
    title: "Test Proposal: Reduce SOL Exposure",
    summary: "Test summary",
    reason: ["Reason 1", "Reason 2"],
    sources: [{ name: "Test Source", url: "#" }],
    type: "risk",
    proposedBy: "GR2 AI",
    expiresAt: new Date(Date.now() + STATIC_EXPIRATION_DATE),
    financialImpact: {
      currentValue: 100,
      projectedValue: 80,
      percentChange: -20,
      timeFrame: "immediate",
      riskLevel: "high",
    },
    status: "active",
    contractCall: {
      type: "swap",
      description: "Sell SOL for USDC",
      params: {
        fromToken: {
          symbol: "SOL",
          address: "So11111111111111111111111111111111111111112",
        },
        toToken: {
          symbol: "USDC",
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
        fromAmount: 1,
      },
    },
  },
] as any as Omit<ProposalInsert, "userId">[]; // FIX: Sử dụng type assertion kép