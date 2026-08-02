import {
  createReferenceUploadToken,
  isSameOrigin,
  normalizedReferenceFile,
  openAiUploadRequest,
  referenceFileLifetimeSeconds,
  referenceUploadError,
} from "../../reference-file-upload";
import { consumePersistentAiRateLimit } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uploadFingerprint(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 90) ?? "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`reference-upload|${ip}|${agent}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return referenceUploadError("이 사이트에서 다시 시도해주세요.", "INVALID_ORIGIN", 403);
  }

  let payload: { name?: unknown; mimeType?: unknown; size?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return referenceUploadError("파일 정보를 읽지 못했어요.", "INVALID_JSON", 400);
  }

  const file = normalizedReferenceFile(
    typeof payload.name === "string" ? payload.name : "",
    typeof payload.mimeType === "string" ? payload.mimeType : "",
    typeof payload.size === "number" ? payload.size : -1,
  );
  if (!file) {
    return referenceUploadError(
      "지원하는 형식의 10MB 이하 파일을 선택해주세요.",
      "INVALID_FILE",
      400,
    );
  }

  try {
    const allowed = await consumePersistentAiRateLimit(
      await uploadFingerprint(request),
      24,
    );
    if (allowed === false) {
      return referenceUploadError(
        "짧은 시간에 파일을 많이 올렸어요. 잠시 후 다시 시도해주세요.",
        "UPLOAD_RATE_LIMITED",
        429,
      );
    }
  } catch {
    // If the optional database is unavailable, the AI endpoint still applies its own limit.
  }

  try {
    const upstream = await openAiUploadRequest("/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: "assistants",
        filename: file.name,
        bytes: file.size,
        mime_type: file.mimeType,
        expires_after: {
          anchor: "created_at",
          seconds: referenceFileLifetimeSeconds,
        },
      }),
    });
    const result = (await upstream.json().catch(() => null)) as
      | { id?: string }
      | null;
    if (!upstream.ok || !result?.id || !/^upload_[a-z0-9_-]+$/i.test(result.id)) {
      return referenceUploadError(
        "파일 업로드를 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
        "UPLOAD_START_FAILED",
        upstream.status === 429 ? 429 : 503,
      );
    }

    return Response.json(
      {
        uploadId: result.id,
        uploadToken: await createReferenceUploadToken(result.id, file),
      },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch {
    return referenceUploadError(
      "파일 업로드 연결을 확인하는 중이에요. 잠시 후 다시 시도해주세요.",
      "UPLOAD_UNAVAILABLE",
      503,
    );
  }
}
