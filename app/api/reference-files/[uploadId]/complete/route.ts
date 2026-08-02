import {
  bearerToken,
  createReferenceFileToken,
  isSameOrigin,
  openAiUploadRequest,
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

  let payload: { partIds?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return referenceUploadError("업로드 정보를 읽지 못했어요.", "INVALID_JSON", 400);
  }
  if (
    !Array.isArray(payload.partIds) ||
    payload.partIds.length < 1 ||
    payload.partIds.length > 5 ||
    payload.partIds.some(
      (partId) => typeof partId !== "string" || !/^part_[a-z0-9_-]+$/i.test(partId),
    )
  ) {
    return referenceUploadError("업로드한 파일 조각을 확인해주세요.", "INVALID_PARTS", 400);
  }

  try {
    const upstream = await openAiUploadRequest(
      `/uploads/${encodeURIComponent(uploadId)}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ part_ids: payload.partIds }),
      },
    );
    const result = (await upstream.json().catch(() => null)) as
      | { file?: { id?: string; bytes?: number } }
      | null;
    const fileId = result?.file?.id ?? "";
    if (
      !upstream.ok ||
      !/^file-[a-z0-9_-]+$/i.test(fileId) ||
      result?.file?.bytes !== upload.size
    ) {
      return referenceUploadError(
        "파일 업로드를 마치지 못했어요. 다시 시도해주세요.",
        "UPLOAD_COMPLETE_FAILED",
        upstream.status === 429 ? 429 : 503,
      );
    }

    return Response.json(
      {
        fileToken: await createReferenceFileToken(fileId, upload),
        name: upload.name,
        mimeType: upload.mimeType,
        size: upload.size,
      },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch {
    return referenceUploadError(
      "파일 업로드를 마치지 못했어요. 다시 시도해주세요.",
      "UPLOAD_COMPLETE_FAILED",
      503,
    );
  }
}
