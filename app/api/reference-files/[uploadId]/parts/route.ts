import {
  bearerToken,
  isSameOrigin,
  openAiUploadRequest,
  referenceFileChunkBytes,
  referenceUploadError,
  verifyReferenceUploadToken,
} from "../../../../reference-file-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  if (!isSameOrigin(request)) {
    return referenceUploadError("이 사이트에서 다시 시도해주세요.", "INVALID_ORIGIN", 403);
  }
  const { uploadId } = await context.params;
  const upload = await verifyReferenceUploadToken(bearerToken(request), uploadId);
  if (!upload) {
    return referenceUploadError("파일 업로드가 만료됐어요.", "INVALID_UPLOAD", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength > referenceFileChunkBytes
  ) {
    return referenceUploadError("파일 조각의 크기를 확인해주세요.", "INVALID_PART", 413);
  }

  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > referenceFileChunkBytes) {
      return referenceUploadError("파일 조각의 크기를 확인해주세요.", "INVALID_PART", 413);
    }
    const form = new FormData();
    form.append("data", new Blob([bytes]), "reference-part");
    const upstream = await openAiUploadRequest(
      `/uploads/${encodeURIComponent(uploadId)}/parts`,
      { method: "POST", body: form },
    );
    const result = (await upstream.json().catch(() => null)) as
      | { id?: string }
      | null;
    if (!upstream.ok || !result?.id || !/^part_[a-z0-9_-]+$/i.test(result.id)) {
      return referenceUploadError(
        "파일 일부를 올리지 못했어요. 다시 시도해주세요.",
        "UPLOAD_PART_FAILED",
        upstream.status === 429 ? 429 : 503,
      );
    }
    return Response.json(
      { partId: result.id },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch {
    return referenceUploadError(
      "파일 일부를 올리지 못했어요. 다시 시도해주세요.",
      "UPLOAD_PART_FAILED",
      503,
    );
  }
}
