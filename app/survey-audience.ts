export type SurveyAudienceGrade =
  | "1학년"
  | "2학년"
  | "3학년"
  | "4학년"
  | "1-2학년"
  | "3-4학년"
  | "전학년";

const academicUnitRoot =
  /(?:경영|공과|문과|이과|의과|치과|간호|법과|사범|신과|약학|예술|음악|교육|사회과학|상경|국제|생활과학|생명과학|보건|융합)$/;

const audienceGroupTokens = new Set([
  "학생",
  "재학생",
  "대학생",
  "학부생",
  "대학원생",
  "중학생",
  "고등학생",
  "수강생",
  "직장인",
  "직원",
  "주민",
  "거주자",
  "청년",
  "일반인",
  "응답자",
  "사람",
  "이용자",
  "사용자",
  "참가자",
  "참여자",
  "참석자",
  "방문객",
  "고객",
  "소비자",
  "회원",
  "학부모",
  "교사",
  "교직원",
  "교수",
]);

const ignoredQualifierTokens = new Set([
  ...audienceGroupTokens,
  "현재",
  "재학",
  "중인",
  "전체",
  "모든",
  "전학년",
  "서비스",
  "프로그램",
  "행사",
  "이용",
  "사용",
  "비이용",
  "비사용",
  "참가",
  "참여",
  "경험",
  "있는",
  "없는",
  "하는",
  "않는",
]);

const specificGradePattern =
  /(?:1\s*학년|2\s*학년|3\s*학년|4\s*학년|1\s*[-·~]\s*2\s*학년|3\s*[-·~]\s*4\s*학년|1\s*학년\s*(?:또는|혹은|및|·)\s*2\s*학년|3\s*학년\s*(?:또는|혹은|및|·)\s*4\s*학년)/;

const anyGradePattern = new RegExp(
  `${specificGradePattern.source}|전\s*학년`,
  "g",
);

function normalizedSpaces(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function academicAudienceToken(root: string) {
  return academicUnitRoot.test(root)
    ? `${root}대학 재학생`
    : `${root}대학교 재학생`;
}

export function normalizeAudienceDisplay(value: string | null | undefined) {
  let normalized = normalizedSpaces(value)
    .replace(/(학생|재학생|대학생|학부생|이용자|사용자|참가자|참여자)들(?=\s|$)/g, "$1")
    .replace(/현재\s*재학\s*중인\s*학생/g, "재학생")
    .replace(/([가-힣A-Za-z0-9·-]+)대학교\s+([가-힣A-Za-z0-9·-]+)대생/g, "$1대학교 $2대학 재학생")
    .replace(/([가-힣A-Za-z0-9·-]+)대\s+([가-힣A-Za-z0-9·-]+)대생/g, "$1대학교 $2대학 재학생")
    .replace(/([가-힣A-Za-z0-9·-]+)학과생/g, "$1학과 재학생")
    .replace(/([가-힣A-Za-z0-9·-]+)전공생/g, "$1전공 재학생");

  normalized = normalized.replace(
    /(^|\s)([가-힣A-Za-z0-9·-]+)대생(?=\s|$)/g,
    (_match, leading: string, root: string) =>
      `${leading}${academicAudienceToken(root)}`,
  );
  normalized = normalized.replace(
    /(^|\s)([가-힣A-Za-z0-9·-]+)대(?=\s+(?:전체\s+)?(?:학생|재학생|대학생|학부생))/g,
    (_match, leading: string, root: string) =>
      `${leading}${academicUnitRoot.test(root) ? `${root}대학` : `${root}대학교`}`,
  );
  return normalized
    .replace(/(대학교|대학|학과|전공)\s+학생(?=\s|$)/g, "$1 재학생")
    .replace(/재학생\s+재학생/g, "재학생")
    .replace(/\s+/g, " ")
    .trim();
}

function comparisonText(value: string | null | undefined) {
  return normalizeAudienceDisplay(value)
    .replace(/[()\[\]{},.]/g, " ")
    .replace(/([가-힣A-Za-z0-9·-]+)(?:을|를)\s*(?:이용|사용)하지\s*않는/g, "$1 비이용")
    .replace(/([가-힣A-Za-z0-9·-]+)(?:을|를)\s*(?:이용|사용)한\s*적이\s*없는/g, "$1 비이용")
    .replace(/([가-힣A-Za-z0-9·-]+)(?:을|를)\s*(?:이용|사용)하는/g, "$1 이용")
    .replace(/([가-힣A-Za-z0-9·-]+)(?:을|를)\s*(?:이용|사용)한\s*적이\s*있는/g, "$1 이용")
    .replace(/비사용/g, "비이용")
    .replace(/사용자/g, "이용자")
    .replace(/사용/g, "이용")
    .replace(/학부생/g, "재학생")
    .replace(/대학교\s+대학생/g, "대학교 재학생")
    .replace(/대학교\s+학생/g, "대학교 재학생")
    .replace(/대학\s+학생/g, "대학 재학생")
    .replace(/(?:들)(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAudienceForComparison(
  value: string | null | undefined,
) {
  return comparisonText(value).replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function audienceGroup(value: string | null | undefined) {
  const normalized = normalizeAudienceForComparison(value);
  if (/대학원생/.test(normalized)) return "graduate_student";
  if (/학생|재학생|대학생|학부생|수강생/.test(normalized)) return "student";
  if (/직장인|직원/.test(normalized)) return "worker";
  if (/주민|거주자/.test(normalized)) return "resident";
  if (/학부모/.test(normalized)) return "parent";
  if (/교사|교직원|교수/.test(normalized)) return "educator";
  if (/일반인|사람|응답자/.test(normalized)) return "general";
  return null;
}

export function audienceGroupMentionedInText(
  audience: string | null | undefined,
  text: string | null | undefined,
) {
  const requiredGroup = audienceGroup(audience);
  return Boolean(requiredGroup && requiredGroup === audienceGroup(text));
}

function audiencePolarity(value: string | null | undefined) {
  const normalized = normalizeAudienceForComparison(value);
  if (/비이용|이용하지않|이용한적이없/.test(normalized)) return "non_user";
  if (/이용|이용자/.test(normalized)) return "user";
  return null;
}

function participationRequirement(value: string | null | undefined) {
  const normalized = normalizeAudienceForComparison(value);
  return /참가|참여|참석/.test(normalized);
}

function specificGrade(value: string | null | undefined) {
  return normalizeAudienceDisplay(value).match(specificGradePattern)?.[0]
    .replace(/\s+/g, "")
    .replace(/[·~]/g, "-") ?? null;
}

function audienceQualifierTokens(value: string | null | undefined) {
  return comparisonText(value)
    .split(/\s+/)
    .map((token) => token.replace(/(?:을|를|은|는|이|가|의)$/g, ""))
    .filter(
      (token) =>
        token.length >= 2 &&
        !ignoredQualifierTokens.has(token) &&
        !specificGradePattern.test(token),
    );
}

export function audienceIncludesRequiredQualifiers(
  required: string | null | undefined,
  candidate: string | null | undefined,
) {
  const normalizedRequired = normalizeAudienceForComparison(required);
  const normalizedCandidate = normalizeAudienceForComparison(candidate);
  if (!normalizedRequired || !normalizedCandidate) return false;
  if (normalizedRequired === normalizedCandidate) return true;

  const requiredGroup = audienceGroup(required);
  const candidateGroup = audienceGroup(candidate);
  if (requiredGroup && requiredGroup !== candidateGroup) return false;

  const requiredPolarity = audiencePolarity(required);
  const candidatePolarity = audiencePolarity(candidate);
  if (requiredPolarity && requiredPolarity !== candidatePolarity) return false;
  if (
    participationRequirement(required) &&
    !participationRequirement(candidate)
  ) {
    return false;
  }

  const requiredGrade = specificGrade(required);
  const candidateGrade = specificGrade(candidate);
  if (requiredGrade && requiredGrade !== candidateGrade) return false;

  return audienceQualifierTokens(required).every((token) =>
    normalizedCandidate.includes(normalizeAudienceForComparison(token)),
  );
}

export function audiencesAreEquivalent(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (
    audienceIncludesRequiredQualifiers(left, right) &&
    audienceIncludesRequiredQualifiers(right, left)
  );
}

function naturalGradeRange(targetGrade: SurveyAudienceGrade) {
  if (targetGrade === "1-2학년") return "1학년 또는 2학년";
  if (targetGrade === "3-4학년") return "3학년 또는 4학년";
  return targetGrade;
}

function applyGradeConstraint(
  audience: string,
  targetGrade: SurveyAudienceGrade,
) {
  const withoutExistingGrade = audience
    .replace(anyGradePattern, "")
    .replace(/\s+/g, " ")
    .trim();
  if (targetGrade === "전학년") return withoutExistingGrade;
  const grade = naturalGradeRange(targetGrade);
  if (/(?:재학생|대학생|학생)(?=\s|$)/.test(withoutExistingGrade)) {
    return withoutExistingGrade.replace(
      /(?:재학생|대학생|학생)(?=\s|$)/,
      (group) => `${grade} ${group}`,
    );
  }
  return withoutExistingGrade;
}

export function resolveFinalRespondentGroup({
  explicitTarget,
  explicitTargetEvidence,
  modelTarget,
  targetGrade,
}: {
  explicitTarget?: string | null;
  explicitTargetEvidence?: string[];
  modelTarget?: string | null;
  targetGrade: SurveyAudienceGrade;
}) {
  const hasExplicitTarget = Boolean(normalizedSpaces(explicitTarget));
  const evidenceSupportsTarget =
    explicitTargetEvidence === undefined || explicitTargetEvidence.length > 0;
  const base =
    hasExplicitTarget && evidenceSupportsTarget
      ? normalizeAudienceDisplay(explicitTarget)
      : normalizeAudienceDisplay(modelTarget);
  if (!base) {
    return targetGrade === "전학년"
      ? "연세대학교 재학생"
      : `연세대학교 ${naturalGradeRange(targetGrade)} 재학생`;
  }
  return applyGradeConstraint(base, targetGrade).slice(0, 120);
}

function withObjectParticle(value: string) {
  const last = value.at(-1);
  if (!last) return value;
  const code = last.charCodeAt(0) - 0xac00;
  const hasFinalConsonant = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${value}${hasFinalConsonant ? "을" : "를"}`;
}

export function audienceMentionedInText(
  audience: string | null | undefined,
  text: string | null | undefined,
) {
  return audienceIncludesRequiredQualifiers(audience, text);
}

export function ensureAudienceInDescription(
  description: string | null | undefined,
  audience: string,
) {
  const cleanDescription = normalizedSpaces(description);
  if (audienceMentionedInText(audience, cleanDescription)) {
    return cleanDescription;
  }
  const detail = cleanDescription
    .replace(/^본\s*조사는\s*/, "")
    .replace(/^.{1,100}?(?:을|를)\s*대상으로(?:\s*한)?\s*,?\s*/, "")
    .trim();
  return detail
    ? `${withObjectParticle(audience)} 대상으로, ${detail}`.slice(0, 500)
    : `${withObjectParticle(audience)} 대상으로 한 설문입니다.`;
}
