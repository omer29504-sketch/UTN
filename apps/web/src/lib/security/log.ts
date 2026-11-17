/**
 * Structured security event log.
 *
 * Emits one JSON line per event so a log drain (Vercel, Supabase, Datadog,
 * Better Stack…) can alert on it. Never pass tokens, cookies, passwords, or
 * document contents: the redaction list below is a backstop, not a licence to
 * log secrets.
 */

type FieldValue = string | number | boolean | null | undefined;

const REDACTED_FIELDS = new Set([
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "service_role_key",
]);

function redact(fields: Record<string, FieldValue>): Record<string, FieldValue> {
  const output: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    output[key] = REDACTED_FIELDS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return output;
}

export function securityLog(event: string, fields: Record<string, FieldValue> = {}): void {
  const payload = {
    level: "security",
    event,
    at: new Date().toISOString(),
    ...redact(fields),
  };

  try {
    console.warn(JSON.stringify(payload));
  } catch {
    console.warn(`[security] ${event}`);
  }
}

/** Extracts a pathname without throwing on unusual request URLs. */
export function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}
