const megabyte = 1024 * 1024;

export const maxReferenceFileBytes = 10 * megabyte;
export const maxReferenceFiles = 3;
export const maxReferenceFilesTotalBytes = 20 * megabyte;
export const referenceFileChunkBytes = 2 * megabyte;
export const referenceFileLifetimeSeconds = 60 * 60;

export const referenceFileMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  tsv: "text/tsv",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  xml: "text/xml",
};

export const referenceFileAccept = Object.entries(referenceFileMimeTypes)
  .flatMap(([extension, mimeType]) => [`.${extension}`, mimeType])
  .join(",");

export function normalizedReferenceFile(
  rawName: string,
  rawMimeType: string,
  rawSize: number,
) {
  const name = rawName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120);
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = referenceFileMimeTypes[extension] ?? "";
  const size = Number.isInteger(rawSize) ? rawSize : -1;

  if (
    !name ||
    !mimeType ||
    rawMimeType.trim().toLowerCase() !== mimeType ||
    size <= 0 ||
    size > maxReferenceFileBytes
  ) {
    return null;
  }

  return { name, mimeType, size };
}
