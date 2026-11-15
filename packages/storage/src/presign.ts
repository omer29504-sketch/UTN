import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageBucket } from "@utn/shared";
import {
  bucketNameFor,
  createR2Client,
  readR2Config,
  type R2Config,
} from "./config";
import { keyBelongsToBucket } from "./keys";

const MAX_PRESIGN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface PresignedUrl {
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
}

function normalizeTtl(seconds: number): number {
  return Math.min(MAX_PRESIGN_TTL_SECONDS, Math.max(30, Math.floor(seconds)));
}

function expiryFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

export interface CreatePresignedPutInput {
  bucket: StorageBucket;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
  config?: R2Config;
}

/**
 * Generates a direct-to-R2 PUT URL. Content-Type and Content-Length are signed,
 * so a browser cannot silently swap file types or inflate the upload size.
 */
export async function createPresignedPutUrl(
  input: CreatePresignedPutInput,
): Promise<PresignedUrl> {
  if (!keyBelongsToBucket(input.key, input.bucket)) {
    throw new Error("Storage key does not belong to the requested bucket.");
  }
  if (!Number.isInteger(input.contentLength) || input.contentLength <= 0) {
    throw new Error("A positive content length is required.");
  }

  const config = input.config ?? readR2Config();
  const client = createR2Client(config);
  const expiresInSeconds = normalizeTtl(
    input.expiresInSeconds ?? config.uploadTtlSeconds,
  );

  const command = new PutObjectCommand({
    Bucket: bucketNameFor(config, input.bucket),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(["content-type", "content-length"]),
  });

  return { url, expiresAt: expiryFromNow(expiresInSeconds), expiresInSeconds };
}

export interface CreatePresignedGetInput {
  bucket: StorageBucket;
  key: string;
  expiresInSeconds?: number;
  responseContentDisposition?: string;
  responseContentType?: string;
  config?: R2Config;
}

/**
 * Generates a short-lived GET URL. The caller is responsible for authorization
 * (admin, owning candidate, or an employer with an unlock/entitlement).
 */
export async function createPresignedGetUrl(
  input: CreatePresignedGetInput,
): Promise<PresignedUrl> {
  if (!keyBelongsToBucket(input.key, input.bucket)) {
    throw new Error("Storage key does not belong to the requested bucket.");
  }

  const config = input.config ?? readR2Config();
  const client = createR2Client(config);
  const expiresInSeconds = normalizeTtl(
    input.expiresInSeconds ?? config.downloadTtlSeconds,
  );

  const command = new GetObjectCommand({
    Bucket: bucketNameFor(config, input.bucket),
    Key: input.key,
    ResponseContentDisposition: input.responseContentDisposition,
    ResponseContentType: input.responseContentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { url, expiresAt: expiryFromNow(expiresInSeconds), expiresInSeconds };
}

export async function deleteStorageObject(input: {
  bucket: StorageBucket;
  key: string;
  config?: R2Config;
}): Promise<void> {
  const config = input.config ?? readR2Config();
  await createR2Client(config).send(
    new DeleteObjectCommand({
      Bucket: bucketNameFor(config, input.bucket),
      Key: input.key,
    }),
  );
}

export async function storageObjectExists(input: {
  bucket: StorageBucket;
  key: string;
  config?: R2Config;
}): Promise<boolean> {
  const metadata = await headStorageObject(input);
  return metadata !== null;
}

export interface StorageObjectMetadata {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}

/**
 * Returns object metadata, or null when the key does not exist. Used to confirm
 * that a browser really uploaded the file it is about to submit for review.
 */
export async function headStorageObject(input: {
  bucket: StorageBucket;
  key: string;
  config?: R2Config;
}): Promise<StorageObjectMetadata | null> {
  const config = input.config ?? readR2Config();
  try {
    const response = await createR2Client(config).send(
      new HeadObjectCommand({
        Bucket: bucketNameFor(config, input.bucket),
        Key: input.key,
      }),
    );

    return {
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? null,
      etag: response.ETag ?? null,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

export interface StorageObjectBytes extends StorageObjectMetadata {
  bytes: Uint8Array;
}

/** Downloads a private object server-side (for OCR, never for public URLs). */
export async function readStorageObject(input: {
  bucket: StorageBucket;
  key: string;
  config?: R2Config;
}): Promise<StorageObjectBytes> {
  if (!keyBelongsToBucket(input.key, input.bucket)) {
    throw new Error("Storage key does not belong to the requested bucket.");
  }

  const config = input.config ?? readR2Config();
  const response = await createR2Client(config).send(
    new GetObjectCommand({
      Bucket: bucketNameFor(config, input.bucket),
      Key: input.key,
    }),
  );

  if (!response.Body) {
    throw new Error("Storage object has no body.");
  }

  const bytes = await response.Body.transformToByteArray();
  return {
    bytes,
    contentType: response.ContentType ?? null,
    contentLength: response.ContentLength ?? null,
    etag: response.ETag ?? null,
  };
}
