export type ReferencePeriodQuestion = {
  title: string;
  explicitTimeframe?: string | null;
  measuredVariable?: string;
  measuredConstruct?: string;
  questionPurpose?: string;
};

export type ReferencePeriodResolution = {
  userExplicitTimeframe?: string | null;
  modelReferencePeriod?: string | null;
  existingExplicitTimeframe?: string | null;
  recommendedTimeframe?: string | null;
};

export const DEFAULT_RECURRING_REFERENCE_PERIOD = "최근 한 달";

const referencePeriodSource = [
  "평소",
  "오늘",
  "어제",
  "(?:이번|지난)\\s*(?:주|달|월|학기|학년도|연도)",
  "(?:최근|지난)\\s*(?:\\d+\\s*(?:일|주|개월|달|년)|한\\s*(?:주|달|해)|일주일|한달)",
  "가장\\s*최근\\s*[가-힣A-Za-z0-9·_-]+?(?=(?:에서|의|을|를|에|와|과|으로|로|\\s|$))",
  "하루\\s*동안",
  "일주일\\s*동안",
  "(?:월|주)\\s*평균",
].join("|");

const visibleReferencePeriodPattern = new RegExp(
  `(?:${referencePeriodSource})(?:\\s*(?:간|동안))?`,
);
const leadingReferencePeriodPattern = new RegExp(
  `^\\s*(?:${referencePeriodSource})(?:\\s*(?:간|동안))?\\s*`,
);
const placeholderReferencePeriodPattern =
  /^(?:사용자\s*지정\s*없음|지정\s*없음|없음|해당\s*없음|null|undefined)$/i;
const oneTimeEventPattern =
  /(?:축제|공연|행사|세미나|특강|설명회|워크숍|대회|시험|면접)/;

function cleanReferencePeriod(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!cleaned || placeholderReferencePeriodPattern.test(cleaned)) return null;
  return cleaned.replace(/\s*(?:간|동안)$/, "").trim();
}

function normalizedReferencePeriod(value: string | null | undefined) {
  return (cleanReferencePeriod(value) ?? "")
    .replace(/한달|1개월/g, "한 달")
    .replace(/한주|1주/g, "한 주")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
}

export function extractVisibleReferencePeriod(title: string) {
  const match = title.match(visibleReferencePeriodPattern)?.[0] ?? null;
  return cleanReferencePeriod(match);
}

export function hasVisibleReferencePeriod(
  question: Pick<ReferencePeriodQuestion, "title">,
) {
  return visibleReferencePeriodPattern.test(question.title);
}

export function isRecurringFrequencyQuestion(
  question: ReferencePeriodQuestion,
) {
  const corpus = question.title;
  return /(?:얼마나\s*자주|(?:이용|사용|방문|참여|구매|이동|통학|등하교|출퇴근)(?:하(?:는|던|였던)|한|했던)?\s*(?:빈도|횟수)|(?:빈도|횟수)(?:는|가|를|을)?\s*(?:어느|얼마나|측정|파악|비교))/.test(
    corpus,
  );
}

function hasConcreteRecurringTarget(question: ReferencePeriodQuestion) {
  const corpus = `${question.title} ${question.measuredVariable ?? ""}`.trim();
  if (oneTimeEventPattern.test(corpus)) return false;
  return (
    /\S{2,}(?:을|를|에|으로|에서)\s*얼마나\s*자주/.test(question.title) ||
    /\S{2,}\s*(?:이용|사용|방문|참여|구매|이동|통학|등하교|출퇴근)(?:하(?:는|던|였던)|한|했던)?\s*(?:빈도|횟수)/.test(
      corpus,
    )
  );
}

export function isSafeDefaultReferencePeriod(
  value: string | null | undefined,
) {
  return (
    normalizedReferencePeriod(value) ===
    normalizedReferencePeriod(DEFAULT_RECURRING_REFERENCE_PERIOD)
  );
}

export function referencePeriodsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizedReferencePeriod(left);
  const normalizedRight = normalizedReferencePeriod(right);
  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

export function resolveQuestionReferencePeriod(
  question: ReferencePeriodQuestion,
  resolution: ReferencePeriodResolution = {},
) {
  if (!isRecurringFrequencyQuestion(question)) return null;
  const visiblePeriod = extractVisibleReferencePeriod(question.title);
  const candidates = [
    resolution.userExplicitTimeframe,
    resolution.modelReferencePeriod,
    resolution.existingExplicitTimeframe ?? question.explicitTimeframe,
    visiblePeriod,
    resolution.recommendedTimeframe,
  ];
  for (const candidate of candidates) {
    const cleaned = cleanReferencePeriod(candidate);
    if (cleaned) return cleaned;
  }
  return hasConcreteRecurringTarget(question)
    ? DEFAULT_RECURRING_REFERENCE_PERIOD
    : null;
}

function referencePeriodPrefix(referencePeriod: string) {
  if (/^(?:평소|오늘|어제|(?:월|주)\s*평균)$/.test(referencePeriod)) {
    return `${referencePeriod} `;
  }
  if (/^가장\s*최근\s+/.test(referencePeriod)) {
    return `${referencePeriod}에서 `;
  }
  return `${referencePeriod} 동안 `;
}

export function ensureVisibleReferencePeriod<
  TQuestion extends ReferencePeriodQuestion,
>(
  question: TQuestion,
  resolution: ReferencePeriodResolution = {},
): TQuestion {
  if (!isRecurringFrequencyQuestion(question)) return question;
  const referencePeriod = resolveQuestionReferencePeriod(question, resolution);
  if (!referencePeriod) return question;

  const visiblePeriod = extractVisibleReferencePeriod(question.title);
  if (visiblePeriod && referencePeriodsMatch(visiblePeriod, referencePeriod)) {
    return {
      ...question,
      explicitTimeframe: referencePeriod,
    };
  }

  const titleWithoutPeriod = question.title
    .replace(leadingReferencePeriodPattern, "")
    .trimStart();
  return {
    ...question,
    title: `${referencePeriodPrefix(referencePeriod)}${titleWithoutPeriod}`,
    explicitTimeframe: referencePeriod,
  };
}

export function ensureVisibleReferencePeriods<
  TQuestion extends ReferencePeriodQuestion,
>(
  questions: TQuestion[],
  resolution: ReferencePeriodResolution = {},
) {
  return questions.map((question) =>
    ensureVisibleReferencePeriod(question, resolution),
  );
}

export function questionReferencePeriodConflicts(
  question: ReferencePeriodQuestion,
) {
  if (!question.explicitTimeframe || !hasVisibleReferencePeriod(question)) {
    return false;
  }
  return !referencePeriodsMatch(
    question.explicitTimeframe,
    extractVisibleReferencePeriod(question.title),
  );
}
