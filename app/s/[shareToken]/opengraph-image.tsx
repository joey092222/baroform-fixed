import { ImageResponse } from "next/og";
import { getPublicSurvey } from "@/app/lib/public-survey";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import { fitOpenGraphTitle } from "@/app/survey-share";

export const alt = "바로폼 설문 미리보기";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 300;

type OpenGraphImageProps = {
  params: Promise<{ shareToken: string }>;
};

function brandFallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 84px",
          color: "#ffffff",
          background: "#071426",
          fontFamily: "geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "#ffffff",
              color: "#071426",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            B
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.08em" }}>
            BAROFORM SURVEY
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <strong style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
            CAMPUS QUESTIONS,
          </strong>
          <strong style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
            ANSWERED TOGETHER.
          </strong>
        </div>
        <span style={{ fontSize: 22, color: "#b8cff4" }}>baroform-fixed.vercel.app</span>
      </div>
    ),
    size,
  );
}

function surveyImageResponse({
  titleLines,
  audience,
  duration,
  questionCount,
  rewardCash,
  fonts,
  fontFamily,
}: {
  titleLines: string[];
  audience: string;
  duration: number;
  questionCount: number;
  rewardCash: number;
  fonts: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>["fonts"];
  fontFamily: string;
}) {
  const titleFontSize = titleLines.some((line) => Array.from(line).length > 19)
    ? 62
    : 68;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 82px 72px",
          color: "#ffffff",
          background: "#071426",
          fontFamily: fontFamily || "geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 58,
                height: 58,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 15,
                background: "#ffffff",
              }}
            >
              <span style={{ width: 28, height: 6, borderRadius: 99, background: "#071426" }} />
              <span style={{ width: 19, height: 6, borderRadius: 99, background: "#071426" }} />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.06em" }}>
              BAROFORM SURVEY
            </span>
          </div>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              padding: "11px 17px",
              border: "1px solid #39506e",
              borderRadius: 999,
              color: "#b8cff4",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            바로폼 설문
          </span>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {titleLines.map((line) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.14,
                letterSpacing: "-0.045em",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {[audience, `약 ${duration}분`, `${questionCount}문항`].map((label) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 18px",
                border: "1px solid #39506e",
                borderRadius: 999,
                background: "#0b1f3a",
                color: "#e9eef5",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {label}
            </span>
          ))}
          {rewardCash > 0 ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 18px",
                borderRadius: 999,
                background: "#ffffff",
                color: "#071426",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              +{rewardCash.toLocaleString("ko-KR")}C 보상
            </span>
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { shareToken } = await params;
  let survey: Awaited<ReturnType<typeof getPublicSurvey>> = null;

  try {
    survey = await getPublicSurvey(shareToken);
  } catch {
    return brandFallbackImage();
  }

  const title = survey?.title ?? "학생들의 의견을 한곳에서";
  const titleLines = fitOpenGraphTitle(title);
  const audience = survey?.targetAudience ?? "우리 학교 학생";
  const duration = Math.max(1, Math.round(survey?.durationMinutes ?? 3));
  const questionCount = Math.max(1, Math.round(survey?.questionCount ?? 7));
  const rewardCash = Math.max(0, Math.round(survey?.rewardCash ?? 0));
  const fontText = [
    title,
    audience,
    "약 분 문항 보상 바로폼 설문",
  ].join(" ");

  let fontSet: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>;
  try {
    fontSet = await loadOpenGraphKoreanFonts(fontText);
  } catch {
    return brandFallbackImage();
  }

  try {
    return surveyImageResponse({
      titleLines,
      audience,
      duration,
      questionCount,
      rewardCash,
      ...fontSet,
    });
  } catch {
    return brandFallbackImage();
  }
}
