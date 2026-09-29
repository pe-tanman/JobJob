import { TypeSafeClient } from "@typesafe-ai/sdk";
import pLimit from "p-limit";
import { env } from "@/lib/env";

let client: TypeSafeClient | undefined;

/** Server-side only. The SDK refuses browser use unless explicitly allowed, and we never allow it. */
export function jev(): TypeSafeClient {
  client ??= new TypeSafeClient({
    apiKey: env.typesafeApiKey,
    defaultModel: process.env.TYPESAFE_DEFAULT_MODEL || "jev-latest",
    timeout: 15_000,
    retry: { maxRetries: 4 },
  });
  return client;
}

/**
 * Account limits are 1,200 requests/minute. 16 concurrent requests at 70-500 ms each
 * lands around 30-200 req/s peak, so we also cap starts per second below the limit.
 */
const concurrency = pLimit(16);
const MAX_PER_SECOND = 18;
let windowStart = 0;
let inWindow = 0;

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      inWindow = 0;
    }
    if (inWindow < MAX_PER_SECOND) {
      inWindow++;
      return fn();
    }
    await new Promise((r) => setTimeout(r, 1000 - (now - windowStart)));
  }
}

export function limited<T>(fn: () => Promise<T>): Promise<T> {
  return concurrency(() => paced(fn));
}

/** $42 per billion input tokens; output is free. */
export const USD_PER_INPUT_TOKEN = 42 / 1_000_000_000;
