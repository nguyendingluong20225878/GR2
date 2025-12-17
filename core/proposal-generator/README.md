# Proposal Agent

This package generates on-chain proposals using signal data, on-chain prices, and social data.

- Runtime imports that require DB are lazily loaded and will be skipped when `MONGODB_URI` / `DATABASE_URL` is not set.
- LLM models are created via factory functions and return null in offline/test environments (deterministic fallback is used instead).

## Environment

`.env` (optional):

```
MONGODB_URI="mongodb://localhost:27017/daiko"
OPENAI_API_KEY=""
AZURE_OPENAI_KEY=""
```

## Tests

Run `pnpm install` and `pnpm test` in the package directory. Tests mock DB usage to be safe for local development and CI.


**Notes:**
- This package previously depended on `@daiko-ai/shared` via workspace dependency; runtime imports that require DB are now lazily loaded and guarded on `MONGODB_URI` / `DATABASE_URL`.
- To run tests without a DB set `MONGODB_URI`/`DATABASE_URL` unset; functions will become no-op or return mock-friendly values.

## Environment
- Optional: `MONGODB_URI` or `DATABASE_URL` if you want DB persistence
- Optional: `OPENAI_API_KEY` or `AZURE_OPENAI_KEY` for LLM integration

## Tests
- `npm test` runs unit tests; packages with persistence use `mongodb-memory-server` when integration tests are enabled.
