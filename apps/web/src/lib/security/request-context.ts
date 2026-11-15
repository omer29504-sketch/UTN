/**
 * Server-only request fingerprint helpers for the credential-security audit
 * trail. Never import this module from a Client Component.
 */

const MAX_IP_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 512;

function cleanIp(value: string | null): string | null {
  if (!value) return null;
  // x-forwarded-for is a comma separated chain: client, proxy1, proxy2…
  const first = value.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  return first.slice(0, MAX_IP_LENGTH);
}

/** Best-effort client IP from the edge/proxy headers. */
export function requestIp(request: Request): string | null {
  return (
    cleanIp(request.headers.get("x-forwarded-for")) ??
    cleanIp(request.headers.get("cf-connecting-ip")) ??
    cleanIp(request.headers.get("x-real-ip"))
  );
}

/** Truncated user agent, kept short enough for the audit column. */
export function requestUserAgent(request: Request): string | null {
  const value = request.headers.get("user-agent")?.trim();
  if (!value) return null;
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

export interface RequestFingerprint {
  ip: string | null;
  userAgent: string | null;
}

export function requestFingerprint(request: Request): RequestFingerprint {
  return { ip: requestIp(request), userAgent: requestUserAgent(request) };
}
