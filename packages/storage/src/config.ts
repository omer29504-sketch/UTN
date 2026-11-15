import { S3Client } from "@aws-sdk/client-s3";
import {
  PRESIGN_TTL_SECONDS,
  STORAGE_BUCKETS,
  type StorageBucket,
} from "@utn/shared";

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export interface R2BucketNames {
  privateCredentials: string;
  pitchVideos: string;
  companyLogos: string;
}

export interface R2Config {
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: R2BucketNames;
  publicLogosBaseUrl: string | null;
  uploadTtlSeconds: number;
  downloadTtlSeconds: number;
}

type EnvLike = Record<string, string | undefined>;

function required(env: EnvLike, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new StorageConfigError(`Missing required environment variable: ${key}`);
  return value;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads and validates Cloudflare R2 configuration lazily so importing this
 * module never breaks `next build` on a machine without secrets.
 */
export function readR2Config(env: EnvLike = process.env): R2Config {
  const accountId = required(env, "R2_ACCOUNT_ID");
  const accessKeyId = required(env, "R2_ACCESS_KEY_ID");
  const secretAccessKey = required(env, "R2_SECRET_ACCESS_KEY");

  return {
    accountId,
    endpoint:
      env.R2_ENDPOINT?.trim().replace(/\/+$/, "") ??
      `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
    buckets: {
      privateCredentials:
        env.R2_BUCKET_PRIVATE_CREDENTIALS?.trim() || STORAGE_BUCKETS.privateCredentials,
      pitchVideos: env.R2_BUCKET_PITCH_VIDEOS?.trim() || STORAGE_BUCKETS.pitchVideos,
      companyLogos: env.R2_BUCKET_COMPANY_LOGOS?.trim() || STORAGE_BUCKETS.companyLogos,
    },
    publicLogosBaseUrl: env.R2_PUBLIC_LOGOS_BASE_URL?.trim().replace(/\/+$/, "") || null,
    uploadTtlSeconds: positiveInt(env.R2_PRESIGN_UPLOAD_TTL_SECONDS, PRESIGN_TTL_SECONDS.upload),
    downloadTtlSeconds: positiveInt(
      env.R2_PRESIGN_DOWNLOAD_TTL_SECONDS,
      PRESIGN_TTL_SECONDS.privateDownload,
    ),
  };
}

export function isR2Configured(env: EnvLike = process.env): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim(),
  );
}

export function bucketNameFor(config: R2Config, bucket: StorageBucket): string {
  switch (bucket) {
    case "private-credentials":
      return config.buckets.privateCredentials;
    case "pitch-videos":
      return config.buckets.pitchVideos;
    case "company-logos":
      return config.buckets.companyLogos;
  }
}

let cachedClient: { fingerprint: string; client: S3Client } | null = null;

export function createR2Client(config: R2Config = readR2Config()): S3Client {
  const fingerprint = `${config.endpoint}:${config.accessKeyId}`;
  if (cachedClient?.fingerprint === fingerprint) return cachedClient.client;

  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2 supports path-style addressing and it avoids bucket-subdomain DNS issues.
    forcePathStyle: true,
    // SDK v3.729+ adds default CRC32 checksums which can invalidate browser
    // presigned PUTs. R2 does not require them for these operations.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  cachedClient = { fingerprint, client };
  return client;
}

/** Test/development helper. */
export function resetR2ClientCache(): void {
  cachedClient = null;
}
