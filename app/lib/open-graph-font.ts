import { getSiteUrl } from "@/app/survey-share";

type OpenGraphFont = {
  name: string;
  data: ArrayBuffer;
  weight: 700;
  style: "normal";
};

export const openGraphFontPath = "/fonts/NotoSansKR-Bold-Baroform.ttf";

let fontPromise: Promise<ArrayBuffer> | null = null;

async function fetchOpenGraphFont() {
  const fontUrl = new URL(openGraphFontPath, getSiteUrl());
  const response = await fetch(fontUrl, {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    throw new Error(`Open Graph font request failed (${response.status})`);
  }

  const data = await response.arrayBuffer();
  if (data.byteLength < 100_000) {
    throw new Error("Open Graph font response was incomplete");
  }

  return data;
}

export async function loadOpenGraphKoreanFonts(text: string) {
  void text;
  fontPromise ??= fetchOpenGraphFont();
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
