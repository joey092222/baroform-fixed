import type { Metadata } from "next";

export const defaultSiteUrl = "https://baroform-fixed.vercel.app";
export const defaultSiteTitle = "바로폼 | 우리 학교 설문 플랫폼";
export const defaultSiteDescription =
  "학교 안의 설문을 발견하고, 한 문장으로 설문을 만들고, 결과까지 바로 분석하세요.";

export type SurveyShareMetadataSource = {
  slug: string;
  title: string;
  description: string;
  targetAudience?: string | null;
  durationMinutes: number;
  questionCount: number;
  rewardCash: number;
  updatedAt?: string | null;
  createdAt?: string | null;
};

function cleanShareText(value: string | null | undefined, maximum: number) {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function sentence(value: string) {
  if (!value) return "";
  return /[.!?。！？]$/.test(value) ? value : `${value}.`;
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return new URL(defaultSiteUrl);

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return new URL(defaultSiteUrl);
    }
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL(defaultSiteUrl);
  }
}

export function surveySharePath(shareToken: string) {
  return `/s/${encodeURIComponent(shareToken)}`;
}

export function surveyCanonicalUrl(shareToken: string) {
  return new URL(surveySharePath(shareToken), getSiteUrl()).toString();
}

export function surveyOpenGraphImageUrl(
  survey: Pick<SurveyShareMetadataSource, "slug" | "updatedAt" | "createdAt">,
) {
  const url = new URL(`${surveySharePath(survey.slug)}/opengraph-image`, getSiteUrl());
  const version = survey.updatedAt || survey.createdAt;
  if (version) url.searchParams.set("v", version);
  return url.toString();
}

export function buildSurveyShareDescription(
  survey: SurveyShareMetadataSource,
) {
  const suppliedDescription = cleanShareText(survey.description, 132);
  const audience = cleanShareText(survey.targetAudience, 64);
  const title = cleanShareText(survey.title, 92);
  const base = suppliedDescription
    ? sentence(suppliedDescription)
    : audience
      ? `${audience} 대상 설문입니다. ${sentence(`${title}에 관한 의견을 모아요`)}`
      : sentence(`${title}에 관한 의견을 모으는 설문입니다`);
  const duration = Math.max(1, Math.round(survey.durationMinutes || 1));
  const questionCount = Math.max(1, Math.round(survey.questionCount || 1));

  return `${base} 약 ${duration}분 · ${questionCount}문항`;
}

export function buildSurveyMetadata(
  survey: SurveyShareMetadataSource,
): Metadata {
  const surveyTitle = cleanShareText(survey.title, 100) || "공개 설문";
  const title = `${surveyTitle} | 바로폼`;
  const description = buildSurveyShareDescription(survey);
  const canonical = surveyCanonicalUrl(survey.slug);
  const image = surveyOpenGraphImageUrl(survey);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "바로폼",
      url: canonical,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${surveyTitle} 설문 미리보기`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildUnavailableSurveyMetadata(shareToken?: string): Metadata {
  const siteUrl = getSiteUrl().toString();
  const image = shareToken
    ? new URL(`${surveySharePath(shareToken)}/opengraph-image`, getSiteUrl()).toString()
    : undefined;
  return {
    title: defaultSiteTitle,
    description: defaultSiteDescription,
    alternates: { canonical: siteUrl },
    openGraph: {
      title: defaultSiteTitle,
      description: defaultSiteDescription,
      type: "website",
      siteName: "바로폼",
      url: siteUrl,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: "바로폼 설문 플랫폼" }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: defaultSiteTitle,
      description: defaultSiteDescription,
      images: image ? [image] : undefined,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export function fitOpenGraphTitle(title: string) {
  const clean = cleanShareText(title, 80) || "학생들의 의견을 모으는 설문";
  const characters = Array.from(clean);
  const maximumPerLine = 22;
  const maximumCharacters = maximumPerLine * 2;
  const visible = characters.slice(0, maximumCharacters);
  const truncated = characters.length > maximumCharacters;
  const first = visible.slice(0, maximumPerLine).join("");
  let second = visible.slice(maximumPerLine).join("");

  if (truncated) {
    second = `${Array.from(second).slice(0, maximumPerLine - 1).join("")}…`;
  }

  return second ? [first, second] : [first];
}
