import { env } from "@/lib/env";

/**
 * CSRF / cross-origin defence in depth.
 *
 * The API authenticates with bearer tokens, which are not attached to
 * cross-site requests, so it is already largely CSRF-resistant. This check
 * additionally rejects state-changing browser requests whose Origin does not
 * match the host the request arrived on. Native clients (Expo) and
 * server-to-server callers omit Origin and carry no ambient cookies, so they
 * are allowed to proceed.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function normalizeHost(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/:(?:80|443)$/, "");
}

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedOrigin(request: Request): boolean {
  if (!isStateChanging(request.method)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const allowed = new Set<string>();

  const requestHost =
    normalizeHost(request.headers.get("x-forwarded-host")) ??
    normalizeHost(request.headers.get("host"));
  if (requestHost) allowed.add(requestHost);

  for (const entry of env.securityAllowedOrigins) {
    const host = hostFromUrl(entry);
    if (host) allowed.add(host);
  }

  return allowed.has(parsed.host.toLowerCase());
}
