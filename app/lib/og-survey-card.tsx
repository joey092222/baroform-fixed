import { ImageResponse } from "next/og";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import { fitOpenGraphTitle } from "@/app/survey-share";

// 카카오톡 권장 규격(2:1). 라우트가 아니라 여기 두어야 스크립트에서도 그대로 렌더해 볼 수 있다.
export const imageSize = { width: 800, height: 400 };
export const imageHeaders = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
  "content-type": "image/png",
};
const brandPanelWidth = 242;

/**
 * 제목 길이에 따라 줄 폭과 글자 크기를 함께 내린다.
 * 왼쪽 본문 칸은 800 - 242(브랜드 패널) - 92(좌우 여백) = 466px다.
 * 한글 글자 폭은 대략 글자 크기의 0.95배라 아래 조합이 그 안에 들어간다.
 */
const titleTiers = [
  { maximumPerLine: 9, maximumLines: 2, fontSize: 52 },
  { maximumPerLine: 11, maximumLines: 3, fontSize: 44 },
  { maximumPerLine: 12, maximumLines: 3, fontSize: 38 },
] as const;

function fitSurveyCardTitle(title: string) {
  for (const tier of titleTiers) {
    const lines = fitOpenGraphTitle(title, tier);
    // 말줄임이 붙었다면 다 못 담은 것이니 다음 단계로 내려간다.
    if (!lines[lines.length - 1]?.endsWith("…")) {
      return { lines, fontSize: tier.fontSize };
    }
  }

  const last = titleTiers[titleTiers.length - 1];
  return { lines: fitOpenGraphTitle(title, last), fontSize: last.fontSize };
}

function brandLockup(size: number, gap: number, fontSize: number) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(size * 0.14),
          borderRadius: Math.round(size * 0.3),
          background: "#ffffff",
        }}
      >
        <span
          style={{
            width: Math.round(size * 0.46),
            height: Math.round(size * 0.11),
            borderRadius: 99,
            background: "#071426",
          }}
        />
        <span
          style={{
            width: Math.round(size * 0.28),
            height: Math.round(size * 0.11),
            borderRadius: 99,
            background: "#071426",
          }}
        />
      </div>
      <span style={{ fontSize, fontWeight: 700, color: "#ffffff" }}>바로폼</span>
    </div>
  );
}

export function surveyImageResponse({
  title,
  audience,
  duration,
  questionCount,
  fonts,
  fontFamily,
}: {
  title: string;
  audience: string;
  duration: number;
  questionCount: number;
  fonts: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>["fonts"];
  fontFamily: string;
}) {
  const { lines: titleLines, fontSize: titleFontSize } = fitSurveyCardTitle(title);
  const chips = [audience, `약 ${duration}분`, `${questionCount}문항`];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          color: "#071426",
          background: "#f6f3eb",
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "46px 40px 46px 52px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {titleLines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                style={{
                  display: "flex",
                  fontSize: titleFontSize,
                  fontWeight: 700,
                  lineHeight: 1.22,
                  letterSpacing: "-0.05em",
                }}
              >
                {line}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {chips.map((label) => (
              <span
                key={label}
                style={{
                  display: "flex",
                  padding: "9px 16px",
                  border: "1px solid #d8d5cc",
                  borderRadius: 999,
                  background: "#fcfbf7",
                  color: "#626873",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            width: brandPanelWidth,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#071426",
          }}
        >
          {brandLockup(36, 10, 22)}
        </div>
      </div>
    ),
    { ...imageSize, fonts, headers: imageHeaders },
  );
}
