import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { env } from "@/lib/env";

/**
 * Rate limiting for API routes.
 *
 * Two backends:
 *   * Upstash Redis REST (distributed) when UPSTASH_REDIS_REST_URL/TOKEN are
 *     set. Required for correctness across serverless instances.
 *   * An in-process sliding window otherwise. This is a best-effort fallback:
 *     each instance keeps its own bucket, so the effective limit is
 *     `limit × instance count`. Good enough for local dev and single-instance
 *     deployments, not for a global guarantee.
 *
 * Availability is preferred over strictness: if Redis is configured but
 * unreachable we log and fall back to the local bucket rather than taking the
 * API down.
 */

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  backend: "redis" | "memory";
}

/** Route budgets. Keys are per authenticated user unless noted otherwise. */
export const RATE_LIMITS = {
  /** Pre-auth budget keyed by client IP. Runs before token verification. */
  apiByIp: { name: "api-ip", limit: 300, windowSeconds: 60 },
  apiDefault: { name: "api-default", limit: 120, windowSeconds: 60 },
  authProvision: { name: "auth-provision", limit: 10, windowSeconds: 60 },
  /** Tesseract is CPU-heavy: six reads per candidate every five minutes. */
  ocr: { name: "verification-ocr", limit: 6, windowSeconds: 300 },
  generateQuestions: { name: "verification-generate-questions", limit: 6, windowSeconds: 300 },
  finalize: { name: "verification-finalize", limit: 8, windowSeconds: 300 },
  presign: { name: "storage-presign", limit: 60, windowSeconds: 60 },
  unlock: { name: "employer-unlock", limit: 30, windowSeconds: 60 },
  checkout: { name: "stripe-checkout", limit: 10, windowSeconds: 60 },
  adminDecision: { name: "admin-verification", limit: 60, windowSeconds: 60 },
  certificateStream: { name: "certificate-stream", limit: 60, windowSeconds: 60 },
  certificateEvent: { name: "certificate-event", limit: 30, windowSeconds: 60 },
  webhook: { name: "stripe-webhook", limit: 600, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memory = new Map<string, MemoryEntry>();
const MEMORY_MAX_KEYS = 20_000;

function pruneMemory(now: number): void {
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
  if (memory.size <= MEMORY_MAX_KEYS) return;

  // A flood of unique keys filled the map: drop the oldest half.
  let remaining = Math.ceil(memory.size / 2);
  for (const key of memory.keys()) {
    memory.delete(key);
    remaining -= 1;
    if (remaining <= 0) break;
  }
}

function buildResult(
  count: number,
  ttlMs: number,
  policy: RateLimitPolicy,
  backend: RateLimitResult["backend"],
): RateLimitResult {
  const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  return {
    ok: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds,
    backend,
  };
}

function memoryConsume(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const windowMs = policy.windowSeconds * 1000;
  const entry = memory.get(key);

  if (!entry || entry.resetAt <= now) {
    if (memory.size >= MEMORY_MAX_KEYS) pruneMemory(now);
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return buildResult(1, windowMs, policy, "memory");
  }

  entry.count += 1;
  return buildResult(entry.count, entry.resetAt - now, policy, "memory");
}

interface UpstashReply {
  result?: unknown;
  error?: string;
}

async function upstash(commands: Array<Array<string | number>>): Promise<UpstashReply[] | null> {
  const url = env.upstashRedisRestUrl;
  const token = env.upstashRedisRestToken;
  if (!url || !token) return null;

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const replies = (await response.json()) as unknown;
    if (!Array.isArray(replies)) throw new Error("unexpected response shape");
    return replies as UpstashReply[];
  } catch (error) {
    console.error(
      "[rate-limit] redis unavailable, using in-process bucket",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function consumeRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const windowMs = policy.windowSeconds * 1000;

  const replies = await upstash([
    ["INCR", key],
    ["PTTL", key],
  ]);

  if (replies) {
    const count = Number(replies[0]?.result ?? 0);
    let ttlMs = Number(replies[1]?.result ?? -1);

    if (!Number.isFinite(count) || count <= 0) return memoryConsume(key, policy);

    // A key created by INCR has no TTL; set it once, without resetting an
    // existing window.
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      await upstash([["PEXPIRE", key, windowMs]]);
      ttlMs = windowMs;
    }

    return buildResult(count, ttlMs, policy, "redis");
  }

  return memoryConsume(key, policy);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.retryAfterSeconds),
  };
}

/**
 * Consumes one unit of the budget and returns a ready-to-send 429 when the
 * caller is over it. Returns null when the request may proceed.
 */
export async function enforceRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
  message = "Too many requests. Please wait a moment and try again.",
): Promise<NextResponse | null> {
  const result = await consumeRateLimit(`rl:${policy.name}:${identifier}`, policy);
  if (result.ok) return null;

  return apiError(429, "rate_limited", message, undefined, {
    ...rateLimitHeaders(result),
    "Retry-After": String(result.retryAfterSeconds),
  });
}
