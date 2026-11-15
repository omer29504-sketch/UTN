import { randomUUID } from "node:crypto";
import { extensionForMimeType, type StorageBucket } from "@utn/shared";
import type { R2Config } from "./config";

export interface BuildObjectKeyInput {
  bucket: StorageBucket;
  /**
   * Candidate user id for credentials/pitch videos, or company id for logos.
   * The server derives this from the authenticated session — never trust a key
   * supplied by the browser.
   */
  ownerId: string;
  contentType: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertOwnerId(ownerId: string): void {
  if (!UUID_PATTERN.test(ownerId)) {
    throw new Error("Storage owner id must be a UUID.");
  }
}

/**
 * Builds an unguessable, ownership-prefixed key:
 *   private-credentials/<candidate-uuid>/<uuid>.pdf
 *   pitch-videos/<candidate-uuid>/<uuid>.webm
 *   company-logos/<company-uuid>/<uuid>.png
 */
export function buildObjectKey(input: BuildObjectKeyInput): string {
  assertOwnerId(input.ownerId);
  const extension = extensionForMimeType(input.contentType);
  return `${input.bucket}/${input.ownerId}/${randomUUID()}.${extension}`;
}

export function keyBelongsToBucket(key: string, bucket: StorageBucket): boolean {
  return key.startsWith(`${bucket}/`) && !key.includes("..") && !key.startsWith("/");
}

/**
 * Public URL for the company-logos bucket only. Requires an R2 custom domain or
 * r2.dev public URL configured on that bucket.
 */
export function getPublicLogoUrl(config: R2Config, key: string): string {
  if (!config.publicLogosBaseUrl) {
    throw new Error(
      "R2_PUBLIC_LOGOS_BASE_URL is not configured. Company logos must stay private until a public bucket domain is attached.",
    );
  }
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${config.publicLogosBaseUrl}/${encodedKey}`;
}
