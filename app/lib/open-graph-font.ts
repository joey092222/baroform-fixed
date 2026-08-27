import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OpenGraphFont = {
  name: string;
  data: ArrayBuffer;
  weight: 700;
  style: "normal";
};

export const openGraphFontPath = "/fonts/NotoSansKR-Bold-Baroform.ttf";

let fontPromise: Promise<ArrayBuffer> | null = null;

async function readOpenGraphFont() {
  const filePath = join(
    process.cwd(),
    "public",
    "fonts",
    "NotoSansKR-Bold-Baroform.ttf",
  );
  const data = await readFile(filePath);
  if (data.byteLength < 100_000) {
    throw new Error("Open Graph font response was incomplete");
  }

  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

export async function loadOpenGraphKoreanFonts(text: string) {
  void text;
  fontPromise ??= readOpenGraphFont();
  const data = await fontPromise;
  const font: OpenGraphFont = {
    name: "BaroformNotoKR",
    data,
    weight: 700,
    style: "normal",
  };

  return {
    fonts: [font],
    fontFamily: font.name,
  };
}
