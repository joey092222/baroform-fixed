import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicSurvey } from "@/app/lib/public-survey";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import { cleanShareText, fitOpenGraphTitle } from "@/app/survey-share";
import {
  imageHeaders,
  imageSize,
  surveyImageResponse,
} from "@/app/lib/og-survey-card";

export const runtime = "nodejs";
export const revalidate = 300;

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
          background: "#f6f3eb",
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

export async function GET(
  _request: Request,
  { params }: OpenGraphImageRouteContext,
) {
  const { shareToken } = await params;

  try {
    const survey = await getPublicSurvey(shareToken);
    if (!survey) return fallbackImageResponse();

    // 대상 칩도 어절 단위로 줄인다. 글자 수로 자르면 "재학생 및 대학원생"이 "재학"이 된다.
    // fitOpenGraphTitle은 빈 입력에 기본 제목을 채우므로 값이 있을 때만 태운다.
    const rawAudience = cleanShareText(survey.targetAudience, 64);
    const audience = rawAudience
      ? fitOpenGraphTitle(rawAudience, { maximumPerLine: 9, maximumLines: 1 })[0]
      : "대학생";
    const duration = Math.max(1, Math.round(survey.durationMinutes));
    const questionCount = Math.max(1, Math.round(survey.questionCount));
    const fontText = [survey.title, audience, "바로폼 약 분 문항"].join(" ");
    const fonts = await loadOpenGraphKoreanFonts(fontText);

    return surveyImageResponse({
      title: survey.title,
      audience,
      duration,
      questionCount,
      ...fonts,
    });
  } catch {
    return fallbackImageResponse();
  }
}
