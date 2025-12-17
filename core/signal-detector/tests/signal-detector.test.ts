/// <reference path="../src/types/vitest-globals.d.ts" />
import { detectSignalWithLlm } from "../src/detector";
import { mockKnownTokens, mockTweetsForDetector } from "./mockdata";
import { mapLlmResponseToSignalInsert, saveSignalToDb } from "../src/persistence";

describe("Signal Detector Tests", () => {
  it("should detect signals from tweets and known tokens", async () => {
    const result = await detectSignalWithLlm({
      formattedTweets: mockTweetsForDetector,
      knownTokens: mockKnownTokens,
    });

    console.log("%o", result);

    expect(result).toBeDefined();
    expect(result.signalDetected).toBe(true);
    expect(result.sources).toBeDefined();
  }, 60000);

  it("should not detect any signals from empty tweets", async () => {
    const result = await detectSignalWithLlm({
      formattedTweets: [],
      knownTokens: mockKnownTokens,
    });

    console.log("%o", result);

    expect(result).toBeDefined();
    expect(result.signalDetected).toBe(false);
  }, 60000);

  it("mapLlmResponseToSignalInsert should map sentiment and fields correctly", () => {
    const response = {
      signalDetected: true,
      tokenAddress: "0xABC",
      sources: [{ url: "https://x.com/1", label: "tweet" }],
      sentimentScore: 0.5,
      suggestionType: "buy",
      strength: 80,
      confidence: 0.9,
      reasoning: "This is a test reasoning",
      relatedTweetIds: ["t1"],
      impactScore: 7,
    } as any;

    const mapped = mapLlmResponseToSignalInsert(response);
    expect(mapped.tokenAddress).toBe("0xABC");
    expect(mapped.sentimentType).toBe("positive");
    expect(mapped.suggestionType).toBe("buy");
    expect(mapped.sources.length).toBe(1);
  });

  it("saveSignalToDb should be a no-op when MONGODB_URI not set", async () => {
    // Ensure env not set for the test
    delete process.env.MONGODB_URI;
    const response = {
      signalDetected: true,
      tokenAddress: "0xABC",
      sources: [{ url: "https://x.com/1", label: "tweet" }],
      sentimentScore: 0.5,
      suggestionType: "buy",
      strength: 80,
      confidence: 0.9,
      reasoning: "This is a test reasoning",
      relatedTweetIds: ["t1"],
      impactScore: 7,
    } as any;

    const res = await saveSignalToDb(response);
    expect(res).toBeNull();
  });
});
