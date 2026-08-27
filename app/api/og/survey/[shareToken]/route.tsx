import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicSurvey } from "@/app/lib/public-survey";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import {
  buildSurveyShareSummary,
  fitOpenGraphDescription,
  fitOpenGraphTitle,
} from "@/app/survey-share";

export const runtime = "nodejs";
export const revalidate = 300;

const imageSize = { width: 800, height: 400 };
const imageHeaders = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
  "content-type": "image/png",
};
const fallbackImagePath = join(
  process.cwd(),
  "public",
  "og",
  "baroform-default.png",
);

type OpenGraphImageRouteContext = {
  params: Promise<{ shareToken: string }>;
};

function defaultBrandImageResponse({
  fonts,
  fontFamily,
}: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "38px 44px",
          color: "#071426",
          background: "#f5f7fb",
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              width: 46,
              height: 46,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 13,
              background: "#071426",
            }}
          >
            <span style={{ width: 23, height: 5, borderRadius: 99, background: "#ffffff" }} />
            <span style={{ width: 15, height: 5, borderRadius: 99, background: "#ffffff" }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>바로폼</span>
          <span
            style={{
              display: "flex",
              marginLeft: 6,
              padding: "7px 12px",
              borderRadius: 999,
              background: "#e7edf7",
              color: "#25456f",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            바로폼 설문
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <strong style={{ fontSize: 48, lineHeight: 1.16, letterSpacing: "-0.04em" }}>
            설문을 쉽고 빠르게
          </strong>
          <span style={{ color: "#53657c", fontSize: 20 }}>
            문항 설계부터 응답 수집과 결과 확인까지, 바로폼에서 간편하게 진행하세요.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#53657c", fontSize: 15 }}>BAROFORM</span>
          <span
            style={{
              display: "flex",
              padding: "10px 16px",
              borderRadius: 10,
              background: "#071426",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            바로 시작하기
          </span>
        </div>
      </div>
    ),
    { ...imageSize, fonts, headers: imageHeaders },
  );
}

async function fallbackImageResponse() {
  try {
    const image = await readFile(fallbackImagePath);
    return new Response(new Uint8Array(image), { headers: imageHeaders });
  } catch {
    try {
      const fonts = await loadOpenGraphKoreanFonts(
        "바로폼 설문을 쉽고 빠르게 문항 설계부터 응답 수집과 결과 확인까지",
      );
      return defaultBrandImageResponse(fonts);
    } catch {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#071426",
              color: "#ffffff",
              fontSize: 62,
              fontWeight: 700,
            }}
          >
            BAROFORM
          </div>
        ),
        { ...imageSize, headers: imageHeaders },
      );
    }
  }
}

function surveyImageResponse({
  titleLines,
  descriptionLines,
  audience,
  duration,
  questionCount,
  fonts,
  fontFamily,
}: {
  titleLines: string[];
  descriptionLines: string[];
  audience: string;
  duration: number;
  questionCount: number;
  fonts: Awaited<ReturnType<typeof loadOpenGraphKoreanFonts>>["fonts"];
  fontFamily: string;
}) {
  const titleFontSize = titleLines.some((line) => Array.from(line).length > 17)
    ? 37
    : 42;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "30px 38px 32px",
          color: "#071426",
          background: "#f5f7fb",
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 12,
                background: "#071426",
              }}
            >
              <span style={{ width: 21, height: 5, borderRadius: 99, background: "#ffffff" }} />
              <span style={{ width: 14, height: 5, borderRadius: 99, background: "#ffffff" }} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 700 }}>바로폼</span>
          </div>
          <span
            style={{
              display: "flex",
              padding: "7px 12px",
              borderRadius: 999,
              background: "#e7edf7",
              color: "#25456f",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            바로폼 설문
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {titleLines.map((line) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.13,
                letterSpacing: "-0.04em",
              }}
            >
              {line}
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 5 }}>
            {descriptionLines.map((line) => (
              <span key={line} style={{ color: "#53657c", fontSize: 16, lineHeight: 1.3 }}>
                {line}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[audience, `약 ${duration}분`, `${questionCount}문항`].map((label) => (
              <span
                key={label}
                style={{
                  display: "flex",
                  padding: "8px 11px",
                  border: "1px solid #d8e0ec",
                  borderRadius: 999,
                  background: "#ffffff",
                  color: "#334a67",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <span
            style={{
              display: "flex",
              padding: "10px 15px",
              borderRadius: 10,
              background: "#071426",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            지금 설문 참여하기
          </span>
        </div>
      </div>
    ),
    { ...imageSize, fonts, headers: imageHeaders },
  );
}

export async function GET(
  _request: Request,
  { params }: OpenGraphImageRouteContext,
) {
  const { shareToken } = await params;

  try {
    const survey = await getPublicSurvey(shareToken);
    if (!survey) return fallbackImageResponse();

    const titleLines = fitOpenGraphTitle(survey.title);
    const descriptionLines = fitOpenGraphDescription(
      buildSurveyShareSummary(survey),
    );
    const audience = survey.targetAudience || "대학생";
    const duration = Math.max(1, Math.round(survey.durationMinutes));
    const questionCount = Math.max(1, Math.round(survey.questionCount));
    const fontText = [
      survey.title,
      descriptionLines.join(" "),
      audience,
      "바로폼 설문 약 분 문항 지금 참여하기",
    ].join(" ");
    const fonts = await loadOpenGraphKoreanFonts(fontText);

    return surveyImageResponse({
      titleLines,
      descriptionLines,
      audience,
      duration,
      questionCount,
      ...fonts,
    });
  } catch {
    return fallbackImageResponse();
  }
}
