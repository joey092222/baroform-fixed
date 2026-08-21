import type { Metadata } from "next";

const localSiteUrl = "http://localhost:3000";
const maximumShareDescriptionLength = 110;

export const defaultOpenGraphImagePath = "/og/baroform-default.png";
export const defaultSiteTitle = "바로폼 | 설문을 쉽고 빠르게";
export const defaultSiteDescription =
  "문항 설계부터 응답 수집과 결과 확인까지, 바로폼에서 간편하게 진행하세요.";

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

export function cleanShareText(
  value: string | null | undefined,
  maximum: number,
) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function truncateShareText(value: string, maximum: number) {
  const characters = Array.from(value);
  if (characters.length <= maximum) return value;
  return `${characters.slice(0, Math.max(1, maximum - 1)).join("").trimEnd()}…`;
}

function sentence(value: string) {
  if (!value) return "";
  return /[.!?。！？]$/.test(value) ? value : `${value}.`;
}

export function getSiteUrl() {
  const vercelHostname =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    vercelHostname
      ? /^https?:\/\//i.test(vercelHostname)
        ? vercelHostname
        : `https://${vercelHostname}`
      : undefined,
  ];
  const isHosted =
    process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (
        isHosted &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      ) {
        continue;
      }
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return url;
    } catch {
      // Try the next deploy-provided URL before using the local fallback.
    }
  }

  if (isHosted) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be a public HTTP(S) URL in hosted environments.",
    );
  }

  return new URL(localSiteUrl);
}

export function surveySharePath(shareToken: string) {
  return `/s/${encodeURIComponent(shareToken)}`;
}

export function surveyCanonicalUrl(shareToken: string) {
  return new URL(surveySharePath(shareToken), getSiteUrl()).toString();
}

export function surveyOpenGraphImagePath(shareToken: string) {
  return `/api/og/survey/${encodeURIComponent(shareToken)}`;
}

export function surveyOpenGraphImageUrl(
  survey: Pick<SurveyShareMetadataSource, "slug" | "updatedAt" | "createdAt">,
) {
  const url = new URL(
    surveyOpenGraphImagePath(survey.slug),
    getSiteUrl(),
  );
  const version = survey.updatedAt || survey.createdAt;
  if (version) url.searchParams.set("v", version);
  return url.toString();
}

export function defaultOpenGraphImageUrl() {
  return new URL(defaultOpenGraphImagePath, getSiteUrl()).toString();
}

export function buildSurveyShareSummary(
  survey: SurveyShareMetadataSource,
) {
  const suppliedDescription = cleanShareText(survey.description, 320);
  const title = cleanShareText(survey.title, 160) || "공개 설문";

  return suppliedDescription
    ? sentence(suppliedDescription)
    : sentence(`${title}에 관한 의견을 모으는 설문입니다`);
}

export function buildSurveyShareDescription(
  survey: SurveyShareMetadataSource,
) {
  const audience = cleanShareText(survey.targetAudience, 64);
  const duration = Math.max(1, Math.round(survey.durationMinutes || 1));
  const questionCount = Math.max(1, Math.round(survey.questionCount || 1));
  const details = [
    audience ? `${audience} 대상` : "",
    `약 ${duration}분`,
    `${questionCount}문항`,
  ].filter(Boolean);
  const suffix = ` · ${details.join(" · ")}`;
  const summaryBudget = Math.max(
    36,
    maximumShareDescriptionLength - Array.from(suffix).length,
  );
  const summary = truncateShareText(
    buildSurveyShareSummary(survey),
    summaryBudget,
  );

  return truncateShareText(
    `${summary}${suffix}`,
    maximumShareDescriptionLength,
  );
}

export function buildSurveyMetadata(
  survey: SurveyShareMetadataSource,
): Metadata {
  const surveyTitle = cleanShareText(survey.title, 160) || "공개 설문";
  const title = `${surveyTitle} | 바로폼`;
  const description = buildSurveyShareDescription(survey);
  const canonical = surveyCanonicalUrl(survey.slug);
  const image = surveyOpenGraphImageUrl(survey);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: surveyTitle,
      description,
      type: "website",
      siteName: "바로폼",
      locale: "ko_KR",
      url: canonical,
      images: [
        {
          url: image,
          width: 800,
          height: 400,
          alt: `${surveyTitle} 설문 미리보기`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: surveyTitle,
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
  void shareToken;
  const siteUrl = getSiteUrl().toString();
  const image = defaultOpenGraphImageUrl();
  return {
    title: defaultSiteTitle,
    description: defaultSiteDescription,
    alternates: { canonical: siteUrl },
    openGraph: {
      title: defaultSiteTitle,
      description: defaultSiteDescription,
      type: "website",
      siteName: "바로폼",
      locale: "ko_KR",
      url: siteUrl,
      images: [
        {
          url: image,
          width: 800,
          height: 400,
          alt: "바로폼 설문 플랫폼",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultSiteTitle,
      description: defaultSiteDescription,
      images: [image],
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * 어절 단위로 줄을 나눈다. 한 어절이 한 줄보다 길면 그 어절만 잘라 넘긴다.
 *
 * satori는 word-break: keep-all을 따르지 않아서 공유 카드 텍스트는 여기서 미리
 * 줄을 확정한다. 이전 구현은 글자 수로 그냥 잘라서 "북한에 대 / 해 어떤 인식을"처럼
 * 단어 중간이 갈렸다.
 */
function wrapByWord(text: string, maximumPerLine: number, maximumLines: number) {
  const lines: string[] = [];
  let current = "";

  const push = () => {
    if (current) lines.push(current);
    current = "";
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (lines.length >= maximumLines) break;

    const candidate = current ? `${current} ${word}` : word;
    if (Array.from(candidate).length <= maximumPerLine) {
      current = candidate;
      continue;
    }

    push();
    if (lines.length >= maximumLines) break;

    // 한 어절이 줄보다 길면 어쩔 수 없이 쪼갠다(URL, 긴 영문 등).
    let rest = Array.from(word);
    while (rest.length > maximumPerLine && lines.length < maximumLines) {
      lines.push(rest.slice(0, maximumPerLine).join(""));
      rest = rest.slice(maximumPerLine);
    }
    current = rest.join("");
  }

  push();
  return lines.slice(0, maximumLines);
}

export function fitOpenGraphTitle(
  title: string,
  { maximumPerLine = 20, maximumLines = 2 }: {
    maximumPerLine?: number;
    maximumLines?: number;
  } = {},
) {
  const clean = cleanShareText(title, 80) || "학생들의 의견을 모으는 설문";
  const lines = wrapByWord(clean, maximumPerLine, maximumLines);
  if (!lines.length) return [clean];

  // 넣지 못한 글자가 남았으면 마지막 줄을 말줄임으로 닫는다.
  // 긴 어절을 쪼개면 줄 사이에 없던 공백이 생기므로 공백을 뺀 글자 수로 센다.
  const withoutSpaces = (value: string) => Array.from(value.replace(/\s/g, "")).length;
  if (withoutSpaces(lines.join("")) < withoutSpaces(clean)) {
    const last = Array.from(lines[lines.length - 1]);
    const room = Math.max(1, maximumPerLine - 1);
    lines[lines.length - 1] = `${last.slice(0, room).join("")}…`;
  }

  return lines;
}

export function fitOpenGraphDescription(description: string) {
  const clean = cleanShareText(description, 160);
  if (!clean) return [];

  const characters = Array.from(clean);
  const maximumPerLine = 35;
  const maximumCharacters = maximumPerLine * 2;
  const visible = characters.slice(0, maximumCharacters);
  const first = visible.slice(0, maximumPerLine).join("");
  let second = visible.slice(maximumPerLine).join("");

  if (characters.length > maximumCharacters) {
    second = `${Array.from(second).slice(0, maximumPerLine - 1).join("")}…`;
  }

  return second ? [first, second] : [first];
}
