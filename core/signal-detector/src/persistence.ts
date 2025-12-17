import type { LlmSignalResponse } from "./types";

// NOTE: We avoid importing `../../shared/src` at module top-level because the
// shared DB connection module throws if MONGODB_URI is not set. Instead,
// persistence functions dynamically import shared exports at runtime only when
// persistence is actually required (and MONGODB_URI exists).


/**
 * Map an LLM response to the SignalInsert shape used by the shared Signals collection.
 * Keeps mapping logic isolated and unit-testable.
 */
export function mapLlmResponseToSignalInsert(resp: LlmSignalResponse) {
  const detectedAt = new Date();

  // Map numeric sentiment (-1..1) to the project's sentiment buckets
  let sentimentType: "positive" | "negative" | "neutral" = "neutral";
  if (resp.sentimentScore > 0.1) sentimentType = "positive";
  else if (resp.sentimentScore < -0.1) sentimentType = "negative";

  // Use confidence if available, otherwise default to 0
  const confidence = resp.confidence ?? 0;

  // Short rationale summary (truncate to 2000 chars to be safe)
  const rationaleSummary = (resp.reasoning || "").slice(0, 2000);

  // Signals expire after a reasonable TTL (7 days) by default
  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const insert = {
    tokenAddress: resp.tokenAddress,
    detectedAt,
    sources: resp.sources.map((s) => ({ label: s.label, url: s.url })),
    sentimentType,
    suggestionType: resp.suggestionType,
    confidence,
    rationaleSummary,
    expiresAt,
  };

  return insert;
}

/**
 * Persist a detected signal into MongoDB using the shared `signals` model.
 * If the environment is not configured for DB (no MONGODB_URI), this becomes a no-op and logs a warning.
 */
export async function saveSignalToDb(resp: LlmSignalResponse) {
  if (!resp.signalDetected) {
    // Skip storing non-signals
    return null;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    // Not configured to persist — caller may be in a lightweight/test environment
    // We intentionally avoid throwing here to keep test/dev flows simple.
    // In production we expect MONGODB_URI to be set; consider enabling strict mode.
    // Comment: persistence is disabled due to missing MONGODB_URI
    // TODO: Consider adding an opt-in strict flag to enforce persistence.
    // eslint-disable-next-line no-console
    console.warn("saveSignalToDb: MONGODB_URI not set; skipping persistence");
    return null;
  }

  // Dynamically import shared DB helpers to avoid loading DB connection code
  // when MONGODB_URI is not set (which would otherwise throw on import).
  const shared = await import("../../shared/src");
  const { connectToDatabase, signalsTable } = shared as any;

  await connectToDatabase();

  const insert = mapLlmResponseToSignalInsert(resp);
  const created = await signalsTable.create(insert as any);
  return created;
}
