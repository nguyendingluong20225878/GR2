import { beforeAll, afterAll, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { saveSignalToDb } from "../../src/persistence";
import type { LlmSignalResponse } from "../../src/types";

let mongod: MongoMemoryServer | null = null;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  // Connect mongoose directly for test verification (avoid importing shared index)
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: "test" });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
describe("Signal persistence (integration)", () => {
  it("should persist a detected signal to MongoDB", async () => {
    const resp: LlmSignalResponse = {
      signalDetected: true,
      tokenAddress: "0xINTEGRATION_TEST",
      sources: [{ url: "https://x.com/test/1", label: "tweet" }],
      sentimentScore: 0.4,
      suggestionType: "buy",
      strength: 50,
      confidence: 0.8,
      reasoning: "Integration test reasoning",
      relatedTweetIds: ["t1"],
      impactScore: 5,
    } as any;

    const created = await saveSignalToDb(resp);
    expect(created).toBeDefined();

    const found = await mongoose.connection.db
      .collection("signals")
      .findOne({ tokenAddress: resp.tokenAddress });

    expect(found).toBeTruthy();
    expect(found.tokenAddress).toBe(resp.tokenAddress);
    expect(found.rationaleSummary).toContain("Integration test reasoning");
  });
});
