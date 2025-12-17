import { describe, it, expect } from "vitest";
import { TokenPriceService } from "../src/services/token-price-service";

describe("TokenPriceService", () => {
  it("should no-op when no DB configured", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.MONGODB_URI;

    const svc = new TokenPriceService();
    // Should not throw
    await expect(svc.updateAllTokenPrices()).resolves.not.toThrow();
  });
});
