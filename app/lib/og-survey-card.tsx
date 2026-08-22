import { ImageResponse } from "next/og";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import { fitOpenGraphTitle } from "@/app/survey-share";

// 시안 파일과 같은 화폭(1236x686)이다. 아래 치수는 전부 그 시안에서 그대로 잰 값이라
// 임의로 키우거나 줄이지 않는다. 라우트가 아니라 여기 두어야 스크립트에서도 그대로
// 렌더해 볼 수 있다.
export const imageSize = { width: 1236, height: 686 };
export const imageHeaders = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
  "content-type": "image/png",
};

const horizontalPadding = 65;
// 브랜드 패널이 없어져서 제목이 카드 폭을 통째로 쓴다. 1236 - 65*2 = 1106px.
export const contentWidth = imageSize.width - horizontalPadding * 2;

/**
 * 제목 길이에 따라 줄 폭과 글자 크기를 함께 내린다.
 * Pretendard 한글은 letter-spacing -0.03em에서 글자 폭이 글자 크기의 약 0.67배다.
 * (렌더해서 실측한 값이다. 1em으로 잡으면 지나치게 좁게 쓰게 된다.)
 *
 * 첫 단계 95px / 한 줄이 시안 그대로이고, 제목이 길어질 때만 아래로 내려간다.
 */
const titleTiers = [
  { maximumPerLine: 17, maximumLines: 1, fontSize: 95 },
  { maximumPerLine: 20, maximumLines: 2, fontSize: 82 },
  { maximumPerLine: 25, maximumLines: 3, fontSize: 66 },
  { maximumPerLine: 30, maximumLines: 3, fontSize: 55 },
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

const inkNavy = "#10233a";
const titleNavy = "#10387c";
const hairline = "#c4c7cc";
const labelInk = "#000000";
const valueInk = "#1a1a1a";
const mutedInk = "#333333";

function brandLockup() {
  const size = 53;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          borderRadius: 6,
          background: inkNavy,
        }}
      >
        <span style={{ width: 24, height: 6, borderRadius: 99, background: "#ffffff" }} />
        <span style={{ width: 15, height: 6, borderRadius: 99, background: "#ffffff" }} />
      </div>
      <span
        style={{
          fontSize: 31,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: labelInk,
        }}
      >
        바로폼
      </span>
    </div>
  );
}

/**
 * satori는 인라인 SVG 지원이 얕아서 화살표를 div 세 개로 조립한다.
 * 지름 54 원의 중심은 (27, 27), 촉은 오른쪽 (39, 27)에 둔다.
 */
function arrowBadge() {
  const stroke = 1.8;
  const armStyle = {
    position: "absolute" as const,
    left: 27.9,
    width: 13,
    height: stroke,
    borderRadius: 99,
    background: mutedInk,
  };

  return (
    <div
      style={{
        position: "relative",
        width: 54,
        height: 54,
        display: "flex",
        borderRadius: 99,
        border: `1.5px solid ${hairline}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 27 - stroke / 2,
          width: 24,
          height: stroke,
          borderRadius: 99,
          background: mutedInk,
        }}
      />
      <div style={{ ...armStyle, top: 22.4 - stroke / 2, transform: "rotate(45deg)" }} />
      <div style={{ ...armStyle, top: 31.6 - stroke / 2, transform: "rotate(-45deg)" }} />
    </div>
  );
}

function signatureColumn(label: string, value: string, width: number) {
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: labelInk,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 23,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          color: valueInk,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function surveyImageResponse({
  title,
  ownerName,
  websiteLabel,
  sharedDate,
  fonts,
  fontFamily,
}: {
  title: string;
  ownerName: string;
  websiteLabel: string;
  sharedDate: string;
  fonts: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>["fonts"];
  fontFamily: string;
}) {
  const { lines: titleLines, fontSize: titleFontSize } = fitSurveyCardTitle(title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: `58px ${horizontalPadding}px 48px`,
          color: labelInk,
          background: "#fbfbfb",
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {brandLockup()}
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div
              style={{
                display: "flex",
                padding: "14px 40px",
                borderRadius: 999,
                border: `1.5px solid ${hairline}`,
                color: mutedInk,
                fontSize: 20,
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              {sharedDate}
            </div>
            {arrowBadge()}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {titleLines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                display: "flex",
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.22,
                letterSpacing: "-0.03em",
                color: titleNavy,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", height: 1.5, background: hairline }} />

        <div style={{ display: "flex", paddingTop: 25 }}>
          {signatureColumn("Presented by :", ownerName, Math.round(contentWidth * 0.53))}
          {signatureColumn("Website :", websiteLabel, Math.round(contentWidth * 0.47))}
        </div>
      </div>
    ),
    { ...imageSize, fonts, headers: imageHeaders },
  );
}
