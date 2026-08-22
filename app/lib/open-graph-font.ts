import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OpenGraphFontWeight = 400 | 700;

type OpenGraphFont = {
  name: string;
  data: ArrayBuffer;
  weight: OpenGraphFontWeight;
  style: "normal";
};

// 공유 카드는 satori로 그려지므로 사이트가 쓰는 woff2 다이내믹 서브셋을 쓸 수 없다.
// satori는 TTF/OTF만 읽는다. 제품 본문 글꼴(Pretendard)과 같은 서체의 정적 TTF를
// public/fonts에 두고 파일로 읽는다. 네트워크 요청은 하지 않는다.
//
// 카드 시안이 라벨은 볼드, 값은 레귤러로 위계를 잡기 때문에 두 굵기를 모두 싣는다.
// satori는 제공하지 않은 굵기를 합성하지 못하고 가진 것 중 하나로 대체해 버린다.
// 두 파일 모두 pretendard 패키지 v1.3.9(Version 1.309)의 static TTF다.
export const openGraphFontPath = "/fonts/Pretendard-Bold-Baroform.ttf";
export const openGraphRegularFontPath =
  "/fonts/Pretendard-Regular-Baroform.ttf";

const openGraphFontFamily = "BaroformPretendard";

const fontFiles: { weight: OpenGraphFontWeight; fileName: string }[] = [
  { weight: 400, fileName: "Pretendard-Regular-Baroform.ttf" },
  { weight: 700, fileName: "Pretendard-Bold-Baroform.ttf" },
];

let fontPromise: Promise<ArrayBuffer[]> | null = null;

async function readOpenGraphFont(fileName: string) {
  const filePath = join(process.cwd(), "public", "fonts", fileName);
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
  fontPromise ??= Promise.all(
    fontFiles.map((entry) => readOpenGraphFont(entry.fileName)),
  );
  const buffers = await fontPromise;
  const fonts: OpenGraphFont[] = fontFiles.map((entry, index) => ({
    name: openGraphFontFamily,
    data: buffers[index],
    weight: entry.weight,
    style: "normal",
  }));

  return {
    fonts,
    fontFamily: openGraphFontFamily,
  };
}
