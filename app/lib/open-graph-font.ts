import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OpenGraphFont = {
  name: string;
  data: ArrayBuffer;
  weight: 700;
  style: "normal";
};

// 공유 카드는 satori로 그려지므로 사이트가 쓰는 woff2 다이내믹 서브셋을 쓸 수 없다.
// satori는 TTF/OTF만 읽는다. 제품 본문 글꼴(Pretendard)과 같은 서체의 정적 TTF를
// public/fonts에 두고 파일로 읽는다. 네트워크 요청은 하지 않는다.
export const openGraphFontPath = "/fonts/Pretendard-Bold-Baroform.ttf";

let fontPromise: Promise<ArrayBuffer> | null = null;

async function readOpenGraphFont() {
  const filePath = join(
    process.cwd(),
    "public",
    "fonts",
    "Pretendard-Bold-Baroform.ttf",
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
    name: "BaroformPretendard",
    data,
    weight: 700,
    style: "normal",
  };

  return {
    fonts: [font],
    fontFamily: font.name,
  };
}
