import { readFile } from "node:fs/promises";
import { join } from "node:path";
import notoSansKrUnicode from "@fontsource-variable/noto-sans-kr/unicode.json";

type OpenGraphFont = {
  name: string;
  data: ArrayBuffer;
  weight: 700;
  style: "normal";
};

type UnicodeRange = {
  subset: string;
  ranges: Array<[number, number]>;
};

const parsedUnicodeRanges: UnicodeRange[] = Object.entries(
  notoSansKrUnicode as Record<string, string>,
).map(([subset, definition]) => ({
  subset: subset.replace(/^\[|\]$/g, ""),
  ranges: definition.split(",").flatMap((entry) => {
    const match = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(entry.trim());
    if (!match) return [];
    const start = Number.parseInt(match[1], 16);
    const end = Number.parseInt(match[2] ?? match[1], 16);
    return [[start, end] as [number, number]];
  }),
}));

const fontPromises = new Map<string, Promise<OpenGraphFont>>();

function subsetForCharacter(character: string) {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return null;

  for (let index = parsedUnicodeRanges.length - 1; index >= 0; index -= 1) {
    const subset = parsedUnicodeRanges[index];
    if (subset.ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) {
      return subset.subset;
    }
  }
  return null;
}

function fontFileName(subset: string) {
  return `noto-sans-kr-${subset}-wght-normal.woff2`;
}

function loadFont(subset: string) {
  const existing = fontPromises.get(subset);
  if (existing) return existing;

  const promise = readFile(
    join(
      process.cwd(),
      "node_modules",
      "@fontsource-variable",
      "noto-sans-kr",
      "files",
      fontFileName(subset),
    ),
  ).then((data) => ({
    name: `NotoKR${subset.replace(/[^a-z0-9]/gi, "")}`,
    data: Uint8Array.from(data).buffer,
    weight: 700 as const,
    style: "normal" as const,
  }));

  fontPromises.set(subset, promise);
  return promise;
}

export async function loadOpenGraphKoreanFonts(text: string) {
  const subsets = Array.from(
    new Set(Array.from(text).map(subsetForCharacter).filter(Boolean)),
  ) as string[];
  const fonts = await Promise.all(subsets.map(loadFont));

  return {
    fonts,
    fontFamily: fonts.map((font) => font.name).join(", "),
  };
}
