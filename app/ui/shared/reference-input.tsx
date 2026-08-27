"use client";

import { FileText, ImagePlus, Link2, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  maxReferenceFiles,
  maxReferenceFilesTotalBytes,
  referenceFileAccept,
} from "../../reference-files";
import {
  hasSurveyReferences,
  referenceFilesTotalBytes,
  referenceImageDataLength as referenceDataLength,
  type SurveyReferenceFile,
  type SurveyReferenceImage,
  type SurveyReferences,
} from "../../ux/types";
import {
  maxReferenceDataLength,
  maxReferenceImageDataLength,
  maxReferenceImages,
  maxReferenceLinks,
} from "../../ux/reference-limits";
import { uploadReferenceFile as prepareReferenceFile } from "../../ux/data/reference-upload";

export function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("사진을 읽지 못했어요."));
    reader.onerror = () => reject(new Error("사진을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
}

export function loadReferenceImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 열지 못했어요."));
    };
    image.src = objectUrl;
  });
}

export async function prepareReferenceImage(file: File): Promise<SurveyReferenceImage> {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("JPG, PNG, WEBP 사진만 첨부할 수 있어요.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("사진 한 장은 12MB 이하로 올려주세요.");
  }

  const source = await loadReferenceImage(file);
  let scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
  let quality = 0.88;
  let dataUrl = "";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 처리하지 못했어요.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/webp", quality);
    if (dataUrl.length <= maxReferenceImageDataLength) break;
    scale *= 0.8;
    quality = Math.max(0.62, quality - 0.05);
  }

  if (!dataUrl || dataUrl.length > maxReferenceImageDataLength) {
    const originalDataUrl = await readFileAsDataUrl(file);
    if (originalDataUrl.length > maxReferenceImageDataLength) {
      throw new Error("사진 용량을 줄인 뒤 다시 올려주세요.");
    }
    dataUrl = originalDataUrl;
  }

  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 80) || "첨부 사진",
    dataUrl,
  };
}

export function formatReferenceFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export function SurveyReferenceControls({
  references,
  onChange,
  disabled = false,
}: {
  references: SurveyReferences;
  onChange: (references: SurveyReferences) => void;
  disabled?: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [referenceError, setReferenceError] = useState("");

  const addImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const available = maxReferenceImages - references.images.length;
    if (available <= 0) {
      setReferenceError(`사진은 최대 ${maxReferenceImages}장까지 첨부할 수 있어요.`);
      return;
    }

    setProcessingImage(true);
    setReferenceError("");
    try {
      const prepared: SurveyReferenceImage[] = [];
      for (const file of files.slice(0, available)) {
        prepared.push(await prepareReferenceImage(file));
      }
      const nextReferences = {
        ...references,
        images: [...references.images, ...prepared],
      };
      if (referenceDataLength(nextReferences) > maxReferenceDataLength) {
        throw new Error(
          "전체 참고 자료 용량이 커요. 사진이나 파일 일부를 삭제한 뒤 다시 시도해주세요.",
        );
      }
      onChange(nextReferences);
      if (files.length > available) {
        setReferenceError(`사진은 최대 ${maxReferenceImages}장까지 첨부할 수 있어요.`);
      }
    } catch (error) {
      setReferenceError(
        error instanceof Error ? error.message : "사진을 첨부하지 못했어요.",
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const available = maxReferenceFiles - references.files.length;
    if (available <= 0) {
      setReferenceError(`파일은 최대 ${maxReferenceFiles}개까지 첨부할 수 있어요.`);
      return;
    }

    setProcessingFile(true);
    setReferenceError("");
    try {
      const selectedFiles = files.slice(0, available);
      const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
      if (
        referenceFilesTotalBytes(references) + selectedBytes >
        maxReferenceFilesTotalBytes
      ) {
        throw new Error("첨부 파일은 전체 20MB까지 올릴 수 있어요.");
      }
      const prepared: SurveyReferenceFile[] = [];
      for (const file of selectedFiles) {
        prepared.push(await prepareReferenceFile(file));
      }
      const nextReferences = {
        ...references,
        files: [...references.files, ...prepared],
      };
      onChange(nextReferences);
      if (files.length > available) {
        setReferenceError(`파일은 최대 ${maxReferenceFiles}개까지 첨부할 수 있어요.`);
      }
    } catch (error) {
      setReferenceError(
        error instanceof Error ? error.message : "파일을 첨부하지 못했어요.",
      );
    } finally {
      setProcessingFile(false);
    }
  };

  const addLink = () => {
    const rawValue = linkValue.trim();
    if (!rawValue) return;
    if (references.links.length >= maxReferenceLinks) {
      setReferenceError(`링크는 최대 ${maxReferenceLinks}개까지 추가할 수 있어요.`);
      return;
    }

    try {
      const url = new URL(
        /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`,
      );
      const hostname = url.hostname.toLowerCase();
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        hostname === "localhost" ||
        hostname.endsWith(".local") ||
        /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
          hostname,
        )
      ) {
        throw new Error();
      }
      url.hash = "";
      const normalized = url.toString();
      if (normalized.length > 2048) throw new Error();
      if (references.links.includes(normalized)) {
        setReferenceError("이미 추가한 링크예요.");
        return;
      }
      onChange({ ...references, links: [...references.links, normalized] });
      setLinkValue("");
      setLinkOpen(false);
      setReferenceError("");
    } catch {
      setReferenceError("누구나 열 수 있는 웹페이지 링크를 확인해주세요.");
    }
  };

  return (
    <div className="reference-controls">
      {hasSurveyReferences(references) && (
        <div className="reference-list" aria-label="AI 참고 자료">
          {references.images.map((image) => (
            <span className="reference-chip image-reference" key={image.id}>
              <span
                className="reference-thumbnail"
                style={{ backgroundImage: `url(${image.dataUrl})` }}
                aria-hidden="true"
              />
              <span>{image.name}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    images: references.images.filter((item) => item.id !== image.id),
                  })
                }
                disabled={disabled}
                aria-label={`${image.name} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {references.files.map((file) => (
            <span className="reference-chip file-reference" key={file.id}>
              <FileText size={14} aria-hidden="true" />
              <span>
                {file.name}
                <small>{formatReferenceFileSize(file.size)}</small>
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    files: references.files.filter((item) => item.id !== file.id),
                  })
                }
                disabled={disabled}
                aria-label={`${file.name} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {references.links.map((link) => (
            <span className="reference-chip link-reference" key={link}>
              <Link2 size={13} aria-hidden="true" />
              <span>{new URL(link).hostname.replace(/^www\./, "")}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    links: references.links.filter((item) => item !== link),
                  })
                }
                disabled={disabled}
                aria-label={`${link} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {linkOpen && (
        <div className="reference-link-entry">
          <Link2 size={15} aria-hidden="true" />
          <input
            type="url"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
              if (event.key === "Escape") {
                setLinkOpen(false);
                setLinkValue("");
              }
            }}
            placeholder="참고할 공개 링크를 붙여넣으세요"
            autoFocus
            disabled={disabled}
          />
          <button type="button" onClick={addLink} disabled={disabled || !linkValue.trim()}>
            추가
          </button>
        </div>
      )}

      <div className="reference-action-row">
        <div className="reference-actions">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={
              disabled || processingImage || references.images.length >= maxReferenceImages
            }
          >
            <ImagePlus size={15} />
            {processingImage ? "사진 처리 중" : "사진 첨부"}
          </button>
          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={
              disabled || processingFile || references.files.length >= maxReferenceFiles
            }
          >
            <FileText size={15} />
            {processingFile ? "파일 처리 중" : "파일 첨부"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen((current) => !current);
              setReferenceError("");
            }}
            disabled={disabled || references.links.length >= maxReferenceLinks}
          >
            <Link2 size={15} />
            링크 추가
          </button>
        </div>
        <span className="reference-hint">
          사진 10장 · 파일 10MB/개 · 전체 20MB
        </span>
      </div>
      {referenceError && <p className="reference-error">{referenceError}</p>}
      <input
        ref={imageInputRef}
        className="reference-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={addImages}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={documentInputRef}
        className="reference-file-input"
        type="file"
        accept={referenceFileAccept}
        multiple
        onChange={addFiles}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

