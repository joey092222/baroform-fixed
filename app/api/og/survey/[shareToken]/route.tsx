import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicSurvey } from "@/app/lib/public-survey";
import { loadOpenGraphKoreanFonts } from "@/app/lib/open-graph-font";
import {
  cleanShareText,
  fitOpenGraphTitle,
  getSiteUrl,
} from "@/app/survey-share";
import {
  imageHeaders,
  imageSize,
  surveyImageResponse,
} from "@/app/lib/og-survey-card";

export const runtime = "nodejs";
export const revalidate = 300;

// 카드 하단 서명줄은 시안대로 한 줄이라 넘치면 잘라야 한다. 왼쪽 칸 폭 586px에
// Pretendard Regular 23px가 들어가는 글자 수가 약 31자다.
const signatureLineLength = 30;
const fallbackOwnerName = "바로폼 이용자";

/**
 * 공유 시점 기준 "오늘"을 시안과 같은 영문 표기로 만든다.
 * Vercel 런타임은 UTC라 그대로 두면 한국 시간 오전 9시 이전에 전날로 찍힌다.
 */
function shareDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function siteHostLabel() {
  try {
    return getSiteUrl().host;
  } catch {
    // 배포 환경 변수가 비어 있어도 카드까지 같이 죽지는 않게 한다.
    return "바로폼";
  }
}

function signatureText(value: string, fallback: string) {
  const cleaned = cleanShareText(value, 80);
  if (!cleaned) return fallback;
  return fitOpenGraphTitle(cleaned, {
    maximumPerLine: signatureLineLength,
    maximumLines: 1,
  })[0];
}

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
          padding: "59px 68px",
          color: "#071426",
          background: "#f6f3eb",
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 71,
              height: 71,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              borderRadius: 20,
              background: "#071426",
            }}
          >
            <span style={{ width: 36, height: 8, borderRadius: 99, background: "#ffffff" }} />
            <span style={{ width: 23, height: 8, borderRadius: 99, background: "#ffffff" }} />
          </div>
          <span style={{ fontSize: 34, fontWeight: 700 }}>바로폼</span>
          <span
            style={{
              display: "flex",
              marginLeft: 9,
              padding: "11px 19px",
              borderRadius: 999,
              background: "#e7edf7",
              color: "#25456f",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            바로폼 설문
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <strong style={{ fontSize: 74, lineHeight: 1.16, letterSpacing: "-0.04em" }}>
            설문을 쉽고 빠르게
          </strong>
          <span style={{ color: "#53657c", fontSize: 31 }}>
            문항 설계부터 응답 수집과 결과 확인까지, 바로폼에서 간편하게 진행하세요.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#53657c", fontSize: 23 }}>BAROFORM</span>
          <span
            style={{
              display: "flex",
              padding: "15px 25px",
              borderRadius: 15,
              background: "#071426",
              color: "#ffffff",
              fontSize: 23,
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
              fontSize: 96,
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

    // 게시자 이름은 배포 모달의 "게시자 표시 이름"에서 온다. 어절 단위로 줄여야
    // "경영대 학생 프로젝트팀"이 "경영대 학생 프로"로 잘리지 않는다.
    const ownerName = signatureText(survey.ownerName, fallbackOwnerName);
    const websiteLabel = siteHostLabel();
    const sharedDate = shareDateLabel();
    const fontText = [survey.title, ownerName, websiteLabel, sharedDate].join(" ");
    const fonts = await loadOpenGraphKoreanFonts(fontText);

    return surveyImageResponse({
      title: survey.title,
      ownerName,
      websiteLabel,
      sharedDate,
      ...fonts,
    });
  } catch {
    return fallbackImageResponse();
  }
}
