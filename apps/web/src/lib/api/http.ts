import { NextResponse } from "next/server";
import type { ApiError } from "@utn/shared";

export function apiError(
  status: number,
  error: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json<ApiError>({ error, message, details }, { status });
}

export function methodNotAllowed(allow: string) {
  return NextResponse.json<ApiError>(
    {
      error: "method_not_allowed",
      message: `Use ${allow} for this endpoint.`,
    },
    { status: 405, headers: { Allow: allow } },
  );
}
