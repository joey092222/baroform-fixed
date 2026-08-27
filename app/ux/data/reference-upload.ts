import {
  maxReferenceFileBytes,
  referenceFileChunkBytes,
  referenceFileMimeTypes,
} from "../../reference-files";
import type { SurveyReferenceFile } from "../types";

/**
 * Chunked upload for a reference document: start -> parts -> complete.
 * Only the returned `fileToken` is ever attached to a draft, never the bytes.
 */

export function referenceFileMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return referenceFileMimeTypes[extension] ?? null;
}

export async function uploadReferenceFile(
  file: File,
): Promise<SurveyReferenceFile> {
  const mimeType = referenceFileMimeType(file);
  if (!mimeType) {
    throw new Error(
      "PDF, Word, PowerPoint, Excel, CSV, TXT, Markdown 파일만 첨부할 수 있어요.",
    );
  }
  if (file.size > maxReferenceFileBytes) {
    throw new Error("파일 한 개는 10MB 이하로 올려주세요.");
  }
  if (file.size <= 0) throw new Error("내용이 있는 파일을 선택해주세요.");

  const startResponse = await fetch("/api/reference-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, mimeType, size: file.size }),
  });
  const startResult = (await startResponse.json().catch(() => ({}))) as {
    uploadId?: string;
    uploadToken?: string;
    error?: string;
  };
  if (!startResponse.ok || !startResult.uploadId || !startResult.uploadToken) {
    throw new Error(startResult.error || "파일 업로드를 시작하지 못했어요.");
  }

  const partIds: string[] = [];
  for (let offset = 0; offset < file.size; offset += referenceFileChunkBytes) {
    const partResponse = await fetch(
      `/api/reference-files/${encodeURIComponent(startResult.uploadId)}/parts`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${startResult.uploadToken}`,
          "content-type": "application/octet-stream",
        },
        body: file.slice(
          offset,
          Math.min(file.size, offset + referenceFileChunkBytes),
          "application/octet-stream",
        ),
      },
    );
    const partResult = (await partResponse.json().catch(() => ({}))) as {
      partId?: string;
      error?: string;
    };
    if (!partResponse.ok || !partResult.partId) {
      throw new Error(partResult.error || "파일 일부를 올리지 못했어요.");
    }
    partIds.push(partResult.partId);
  }

  const completeResponse = await fetch(
    `/api/reference-files/${encodeURIComponent(startResult.uploadId)}/complete`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${startResult.uploadToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ partIds }),
    },
  );
  const completeResult = (await completeResponse.json().catch(() => ({}))) as {
    fileToken?: string;
    error?: string;
  };
  if (!completeResponse.ok || !completeResult.fileToken) {
    throw new Error(completeResult.error || "파일 업로드를 마치지 못했어요.");
  }

  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120) || "첨부 파일",
    fileToken: completeResult.fileToken,
    mimeType,
    size: file.size,
  };
}
