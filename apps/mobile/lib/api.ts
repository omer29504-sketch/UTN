import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";
import { env } from "./env";

export function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/$/, "")}${path}`;
}

/**
 * Same-origin API calls stay in sync with the Supabase session by attaching the
 * access token. The Next.js routes verify the bearer token server-side.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(apiUrl(path), { ...init, headers });
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function fileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || typeof info.size !== "number") {
    throw new Error("Could not read the selected file.");
  }
  return info.size;
}

export function contentTypeForUri(uri: string): string {
  const clean = uri.split("?")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".pdf")) return "application/pdf";
  return "video/mp4";
}

/**
 * Streams a local file straight to R2 using the signed PUT URL. Content-Type is
 * signed alongside Content-Length, so both must match the presign request.
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `The secure upload failed (${result.status}). Check your connection and try again.`,
    );
  }
}
