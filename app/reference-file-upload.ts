import {
  normalizedReferenceFile,
  referenceFileLifetimeSeconds,
} from "./reference-files";

export {
  maxReferenceFileBytes,
  maxReferenceFiles,
  maxReferenceFilesTotalBytes,
  normalizedReferenceFile,
  referenceFileAccept,
  referenceFileChunkBytes,
  referenceFileLifetimeSeconds,
  referenceFileMimeTypes,
} from "./reference-files";

type UploadTokenPayload = {
  kind: "upload";
  uploadId: string;
  name: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type ReferenceFileTokenPayload = {
  kind: "file";
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

type ReferenceTokenPayload = UploadTokenPayload | ReferenceFileTokenPayload;

function tokenSecret() {
  const secret =
    process.env.BAROFORM_REFERENCE_SECRET?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!secret) throw new Error("Reference upload secret is not configured");
  return secret;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(tokenSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: ReferenceTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${Buffer.from(signature).toString("base64url")}`;
}

async function verifyPayload(token: string): Promise<ReferenceTokenPayload | null> {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      Buffer.from(encodedSignature, "base64url"),
      new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<ReferenceTokenPayload>;
    if (
      (payload.kind !== "upload" && payload.kind !== "file") ||
      typeof payload.name !== "string" ||
      typeof payload.mimeType !== "string" ||
      typeof payload.size !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    const normalized = normalizedReferenceFile(
      payload.name,
      payload.mimeType,
      payload.size,
    );
    if (!normalized) return null;
    if (payload.kind === "upload") {
      return typeof payload.uploadId === "string" &&
        /^upload_[a-z0-9_-]+$/i.test(payload.uploadId)
        ? { ...normalized, kind: "upload", uploadId: payload.uploadId, expiresAt: payload.expiresAt }
        : null;
    }
    const fileId = "fileId" in payload ? payload.fileId : undefined;
    return typeof fileId === "string" && /^file-[a-z0-9_-]+$/i.test(fileId)
      ? { ...normalized, kind: "file", fileId, expiresAt: payload.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export function createReferenceUploadToken(
  uploadId: string,
  file: { name: string; mimeType: string; size: number },
) {
  return signPayload({
    kind: "upload",
    uploadId,
    ...file,
    expiresAt: Date.now() + referenceFileLifetimeSeconds * 1000,
  });
}

export function createReferenceFileToken(
  fileId: string,
  file: { name: string; mimeType: string; size: number },
) {
  return signPayload({
    kind: "file",
    fileId,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    expiresAt: Date.now() + referenceFileLifetimeSeconds * 1000,
  });
}

export async function verifyReferenceUploadToken(token: string, uploadId: string) {
  const payload = await verifyPayload(token);
  return payload?.kind === "upload" && payload.uploadId === uploadId
    ? payload
    : null;
}

export async function verifyReferenceFileToken(token: string) {
  const payload = await verifyPayload(token);
  return payload?.kind === "file" ? payload : null;
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function referenceUploadError(message: string, code: string, status: number) {
  return Response.json(
    { error: message, code },
    {
      status,
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export async function openAiUploadRequest(
  path: string,
  init: RequestInit,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${apiKey}`);
  return fetch(`https://api.openai.com/v1${path}`, { ...init, headers });
}
