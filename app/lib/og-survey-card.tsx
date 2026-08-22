import { ImageResponse } from "next/og";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import { fitOpenGraphTitle, surveyOpenGraphImageSize } from "@/app/survey-share";

// 시안 파일과 같은 화폭(1236x686)이다. 아래 치수는 전부 그 시안에서 그대로 잰 값이라
// 임의로 키우거나 줄이지 않는다. 라우트가 아니라 여기 두어야 스크립트에서도 그대로
// 렌더해 볼 수 있다.
//
// 크기는 여기서 새로 적지 않고 survey-share에서 가져온다. 같은 숫자를 두 곳에 적으면
// 한쪽만 바뀌어 metadata가 실제 이미지와 어긋나고, 카카오톡이 미리보기를 포기한다.
export const imageSize = surveyOpenGraphImageSize;
export const imageHeaders = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
  "content-type": "image/png",
};

const horizontalPadding = 65;
// 브랜드 패널이 없어져서 제목이 카드 폭을 통째로 쓴다. 1236 - 65*2 = 1106px.
export const contentWidth = imageSize.width - horizontalPadding * 2;

/**
 * 제목 길이에 따라 줄 폭과 글자 크기를 함께 내린다.
 * 첫 단계 95px / 한 줄이 시안 그대로이고, 제목이 길어질 때만 아래로 내려간다.
 *
 * 줄당 글자 수는 한글과 공백이 섞인 평균 폭을 글자 크기의 0.82배로 잡고 계산했다.
 * 렌더해서 실측한 값이다(82px에서 17글자가 1090px, 본문 칸은 1106px).
 * 처음에 0.67로 잡았더니 한 줄에 안 들어가는 길이를 통과시켜 satori가 제 나름대로
 * 줄을 바꿨고, "…수요 조 / 사"처럼 낱말 가운데가 끊겼다.
 */
const koreanGlyphWidthRatio = 0.82;

// 글자 수를 손으로 적지 않고 글자 크기에서 뽑는다. 크기를 바꿔도 줄당 글자 수가
// 따라오므로 둘이 어긋날 일이 없다.
function charactersPerLine(fontSize: number) {
  return Math.floor(contentWidth / (fontSize * koreanGlyphWidthRatio));
}

const titleTiers = [95, 82, 66, 55].map((fontSize, index) => ({
  maximumPerLine: charactersPerLine(fontSize),
  maximumLines: index === 0 ? 1 : index === 1 ? 2 : 3,
  fontSize,
}));

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
                // 위 계산이 빗나가도 낱말 가운데는 끊기지 않게 하는 안전판이다.
                // 한국어는 글자 사이 어디서나 줄을 바꿀 수 있어 이것이 없으면
                // "조사"가 "조 / 사"로 갈린다.
                wordBreak: "keep-all",
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
