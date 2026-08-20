import type {
  GenerationPath,
  SurveyRegressionCase,
  SurveyRegressionIssue,
  SurveyRegressionResult,
} from "./schema";

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/([가-힣]+)대학\s*재학생/gu, "$1대생")
    .replace(/([가-힣]{2,})대학교/gu, "$1대")
    .replace(/팀\s*프로젝트/gu, "팀플")
    .replace(/경험이\s*있는\s*응답자/gu, "경험자")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();

const conceptPatterns: Record<string, RegExp[]> = {
  "generic filler": [/요소\s*\d+/, /첫\s*번째\s*핵심\s*경험/, /두\s*번째\s*핵심\s*경험/],
  "무관한 인구통계": [/성별.*학년.*전공/, /나이.*성별.*거주/],
  "이용 만족도 강제": [/이용하지\s*않.*만족/, /비이용.*만족도/],
  "방문 만족도 강제": [/가지\s*않.*만족/, /방문하지\s*않.*만족/],
  "현재 이용 만족도": [/현재.*이용.*만족/, /현재.*사용.*만족/],
  "이동 빈도": [/얼마나\s*자주.*(?:오가|이동|방문)/, /이동\s*(?:빈도|횟수)/, /방문\s*(?:빈도|횟수)/],
  "이동 수단": [/이동\s*수단/, /교통수단/, /어떤\s*방법으로.*(?:오가|이동)/],
  "소요 시간": [/소요\s*시간/, /걸리는\s*시간/, /얼마나\s*걸/, /몇\s*분/],
  혼잡: [/혼잡/, /붐비/],
  안전: [/안전/, /위험/],
  접근성: [
    /접근성/,
    /접근.*(?:어려|편리|쉬)/,
    /찾아가는\s*과정.*쉬/,
    /위치.*찾기\s*쉬/,
    /도달.*(?:어렵지\s*않|쉬)/,
    /출입.*편리/,
    /이동\s*경로.*(?:명확|편리)/,
    /오가는\s*과정.*편리/,
  ],
  불편: [/불편/, /어려(?:운|웠던)\s*점/, /어려움/, /장벽/],
  "개선 요구": [/개선/, /바라는\s*점/, /보완/, /바뀌었으면/, /달라졌으면/],
  만족도: [/만족/, /평가/],
  인식: [/인식/, /이미지/, /인상/, /어떻게\s*생각/],
  이미지: [/이미지/, /인식/],
  인지: [/인지/, /알고\s*있/],
  "이용 경험": [
    /(?:이용|사용)한\s*적/,
    /(?:이용|사용)해\s*본\s*적/,
    /(?:써|쓰|썼)\s*본\s*적/,
    /(?:이용|사용)\s*경험/,
  ],
  "방문 경험": [/방문한\s*적/, /방문\s*경험/],
  "참여 경험": [/참여한\s*적/, /참가한\s*적/, /참여\s*경험/, /어떤\s*프로그램에\s*참여/],
  "수강 경험": [/수강한\s*적/, /수강\s*경험/],
  "이용 빈도": [/이용\s*(?:빈도|횟수)/, /사용\s*(?:빈도|횟수)/, /얼마나\s*자주.*(?:이용|사용|방문|찾)/],
  "구매 빈도": [/구매\s*(?:빈도|횟수)/, /주문\s*(?:빈도|횟수)/, /얼마나\s*자주.*(?:구매|주문|외식)/],
  "이용 시간": [/이용\s*시간/, /사용\s*시간/, /시청\s*시간/],
  "시간 사용": [/시간\s*사용/, /얼마나\s*시간/, /하루.*시간/],
  "수면 시간": [/수면\s*시간/, /몇\s*시간.*(?:자|수면)/],
  "대기 시간": [/대기\s*시간/, /얼마나\s*기다/],
  빈도: [/빈도/, /횟수/, /얼마나\s*자주/],
  비용: [/비용/, /가격/, /요금/, /지출/, /부담/],
  "비이용 이유": [
    /(?:이용|사용|참여|구매|가입|방문|시청)하지\s*않(?:는|은|았던)\s*(?:가장\s*큰\s*)?이유/,
    /(?:사|먹|보|쓰)지\s*않(?:는|은|았던).*이유/,
    /(?:탈퇴|해지).*(?:이유|원인|요인)/,
    /비이용\s*이유/,
    /미구매\s*이유/,
    /불참\s*이유/,
    /장벽/,
  ],
  "비참여 이유": [
    /참여하지\s*않(?:는|은|았던)\s*(?:가장\s*큰\s*)?이유/,
    /참가하지\s*않(?:는|은|았던)\s*(?:가장\s*큰\s*)?이유/,
    /불참\s*이유/,
    /비참여\s*이유/,
    /참여\s*장벽/,
  ],
  "미구매 이유": [
    /미구매\s*(?:이유|요인)/,
    /구매하지\s*않는\s*이유/,
    /사지\s*않는\s*이유/,
    /구매.*(?:장벽|방해\s*요인)/,
  ],
  "가격 수용도": [/가격\s*수용도/, /얼마나\s*더\s*(?:내|지불)/, /추가\s*비용/, /지불\s*의향/],
  "이용 의향": [
    /이용\s*의향/,
    /사용\s*의향/,
    /다시\s*(?:이용|사용|방문|가입|등록|구매)/,
    /재(?:이용|방문|가입|등록|구매)/,
    /(?:이용|사용|방문|가입|등록|구매)할\s*(?:가능성|생각|의향)/,
    /(?:써|사용해|이용해|방문해|가입해|구매해)\s*볼\s*(?:가능성|생각|의향)/,
    /(?:쓸|써볼)\s*(?:가능성|생각|의향)/,
  ],
  "참여 의향": [
    /참여\s*의향/,
    /가입\s*의향/,
    /재참여/,
    /(?:참여|참가|가입)할\s*(?:가능성|생각|의향)/,
    /계속\s*참여할\s*가능성/,
  ],
  "서비스 필요성": [/필요/, /도입\s*수요/, /수요/],
  "원하는 기능": [/원하는\s*기능/, /필요한\s*기능/, /기능\s*수요/],
  사용성: [/사용성/, /편의성/, /사용하기\s*쉬/, /찾고\s*사용.*편리/, /사용\s*과정.*편리/],
  신뢰: [/신뢰/],
  공정성: [/공정/],
  의사소통: [/의사소통/, /소통/],
  피로: [/피로/],
  소속감: [/소속감/],
  스트레스: [/스트레스/],
  집중도: [/집중/],
  갈등: [/갈등/],
  "해결 방식": [/해결/, /대처/],
  "학습 효과": [/학습\s*효과/, /도움\s*정도/, /얼마나\s*도움/, /도움이\s*되/, /자신감/],
  "학교 적응": [/학교\s*적응/, /적응/],
  "선택 이유": [
    /선택한\s*이유/,
    /선택\s*이유/,
    /선택\s*요인/,
    /선택\s*기준/,
    /고를\s*때.*중요/,
  ],
  "이용 목적": [
    /이용\s*목적/,
    /사용\s*목적/,
    /어떤\s*목적으로\s*(?:방문|이용|사용|찾)/,
    /(?:방문|이용|사용)하는\s*(?:주된\s*)?이유/,
    /가장\s*주로\s*(?:가|찾|방문)하는\s*이유/,
    /가장\s*주로\s*가는\s*이유/,
    /(?:찾는|방문하는)\s*(?:가장\s*)?(?:주된|주요한?)\s*이유/,
    /찾는\s*가장\s*(?:큰|주된)\s*이유/,
  ],
  맛: [/맛/],
  선호: [/선호/, /관심\s*(?:활동|주제)/],
  충동구매: [/충동\s*구매/],
  저축: [/저축/],
  "대상 비교": [/비교/, /차이/, /어떤\s*프로그램에\s*참여/, /어느\s*(?:쪽|대상|서비스).*더/],
};

const negationPattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|클릭|운동|먹|보)(?:하지\s*않|하지\s*못|한\s*적\s*없|지\s*않)|비이용|미구매|불참|미가입|비방문|비시청|비주문|탈퇴|해지|안\s*(?:쓰|가|하|먹|보)|못\s*(?:쓰|가|하)/;

const genericFillerPatterns = conceptPatterns["generic filler"];

function questionSemanticCorpus(
  question: SurveyRegressionResult["questions"][number],
) {
  return [
    question.title,
    ...question.options,
    question.reason,
    question.role,
    question.measuredRole,
    question.planBlockId,
    question.purposeBlockId,
    question.measuredVariable,
    question.measuredConstruct,
    question.questionPurpose,
    ...(question.measuredEntityIds ?? []),
    question.scaleMinLabel,
    question.scaleMaxLabel,
  ]
    .filter(Boolean)
    .join("\n");
}

function meaningfulTokens(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .split(/\s+/)
    .map((item) => item.replace(/(?:을|를|이|가|은|는|의|에게|에서|으로|와|과|들)$/u, ""))
    .filter((item) => item.length >= 2 && !/^(?:학생|사람|대상|구성원|이용자)$/.test(item));
}

export function semanticTextMatch(actual: string, candidates: string[]) {
  const normalizedActual = normalize(actual);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalize(candidate);
    if (normalizedActual.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedActual)) {
      return true;
    }
    const tokens = meaningfulTokens(candidate);
    if (tokens.length === 0) return false;
    const matched = tokens.filter((token) => normalizedActual.includes(normalize(token))).length;
    return matched / tokens.length >= 0.6;
  });
}

const nonUserScopePattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|클릭|먹|보)(?:하지\s*않|한\s*적\s*없|지\s*않)|비이용|미구매|불참|미가입|비방문|비시청|비주문|안\s*(?:쓰|가|먹|보)/;
const positiveUserScopePattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|수강|먹|듣)(?:한|하는|했던|해\s*본|중인|\s*(?=(?:대학생|학생|사람|주민|직장인|고객|이용자)))|다니는/;

function populationScopeCompatible(actual: string, expected: string) {
  const actualNonUser = nonUserScopePattern.test(actual);
  const expectedNonUser = nonUserScopePattern.test(expected);
  if (actualNonUser !== expectedNonUser) return false;
  const actualPositiveUser = positiveUserScopePattern.test(actual) && !actualNonUser;
  const expectedPositiveUser = positiveUserScopePattern.test(expected) && !expectedNonUser;
  return actualPositiveUser === expectedPositiveUser;
}

function eligibilityConditionPresent(actual: string, expected: string) {
  if (semanticTextMatch(actual, [expected])) return true;
  const expectedKind = /비이용|미사용/u.test(expected)
    ? /(?:이용|사용)하지\s*않|안\s*쓰|비이용|미사용/u
    : /미구매/u.test(expected)
      ? /구매하지\s*않|사지\s*않|미구매/u
      : /비참여|불참/u.test(expected)
        ? /참여하지\s*않|참가하지\s*않|비참여|불참/u
        : /해지/u.test(expected)
          ? /해지/u
          : /탈퇴/u.test(expected)
            ? /탈퇴/u
            : null;
  if (!expectedKind || !expectedKind.test(actual)) return false;
  const expectedEntity = expected.replace(
    /\s*(?:비이용|미사용|미구매|비참여|불참|해지|탈퇴)\s*$/u,
    "",
  );
  const entityTokens = meaningfulTokens(expectedEntity);
  return (
    entityTokens.length > 0 &&
    entityTokens.every((token) => normalize(actual).includes(normalize(token)))
  );
}

const strictPopulationQualifierPattern =
  /(?:[1-6]\s*학년|신입생|졸업생|휴학생|대학원생|학부생|[가-힣A-Za-z0-9]+학과|[가-힣A-Za-z0-9]+학부|[가-힣A-Za-z0-9]+전공)/gu;

function populationQualifiersCompatible(actual: string, expected: string) {
  const actualNormalized = normalize(actual);
  const expectedQualifiers = expected.match(strictPopulationQualifierPattern) ?? [];
  return expectedQualifiers.every((qualifier) =>
    actualNormalized.includes(normalize(qualifier)),
  );
}

function populationHeadCompatible(actual: string, expected: string) {
  const headPattern = /(?:구독자|이용자|사용자|참여자|경험자|학생|대학생|주민|직장인|학부모|소비자|고령층|청년|성인)/gu;
  const actualHeads = new Set(actual.match(headPattern) ?? []);
  return (expected.match(headPattern) ?? []).some((head) => actualHeads.has(head));
}

export function targetPopulationMatch(
  actual: string,
  candidates: string[],
  expectedSurveyObjects: string[] = [],
) {
  return candidates.some(
    (candidate) => {
      if (!populationScopeCompatible(actual, candidate)) return false;
      if (!populationQualifiersCompatible(actual, candidate)) return false;
      if (semanticTextMatch(actual, [candidate])) return true;
      return (
        populationHeadCompatible(actual, candidate) &&
        expectedSurveyObjects.length > 1 &&
        expectedSurveyObjects.every((object) =>
          semanticTextMatch(actual, [object]),
        )
      );
    },
  );
}

export function conceptPresent(concept: string, corpus: string) {
  const mapped = conceptPatterns[concept];
  if (mapped) return mapped.some((pattern) => pattern.test(corpus));
  const tokens = meaningfulTokens(concept);
  return tokens.length > 0 && tokens.every((token) => normalize(corpus).includes(normalize(token)));
}

const surveyPurposePollutionPattern =
  /(?:만족도|인지도|인식|이미지|수요|필요성|의향|이유|원인|장벽|개선(?:점|의견|요구)?|평가|비교|미치는\s*영향)/u;
const respondentFrameInSurveyObjectPattern =
  /(?:학생|재학생|주민|직장인|학부모|소비자|신입생|사람|응답자)(?:들)?(?:이|가|의|에게|한테)/u;

function surveyObjectRoleCompatible(
  actual: string,
  candidates: string[],
  semanticCorpus: string,
) {
  if (!actual.trim()) return false;
  const normalizedActual = normalize(actual);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalize(candidate);
    const actualHasPurposeSuffix = surveyPurposePollutionPattern.test(actual.trim());
    const candidateHasPurposeSuffix = surveyPurposePollutionPattern.test(candidate.trim());
    if (actualHasPurposeSuffix && !candidateHasPurposeSuffix) return false;
    if (
      respondentFrameInSurveyObjectPattern.test(actual) &&
      !respondentFrameInSurveyObjectPattern.test(candidate)
    ) return false;
    if (!semanticTextMatch(semanticCorpus, [candidate])) return false;
    if (semanticTextMatch(actual, [candidate])) return true;

    const candidateTokens = meaningfulTokens(candidate);
    const actualTokens = meaningfulTokens(actual);
    const candidateHead = candidateTokens.at(-1);
    if (!candidateHead || actualTokens.length === 0) return false;
    return (
      normalizedActual.includes(normalize(candidateHead)) &&
      actualTokens.every((token) => normalizedCandidate.includes(normalize(token)))
    );
  });
}

const comparisonSignalPatterns = [
  ...conceptPatterns["대상 비교"],
  /더\s*(?:만족|선호|좋|편|도움|적합)/,
  /(?:둘|두\s*대상|두\s*메뉴|두\s*서비스).*(?:중|비교|차이)/,
  /각각.*(?:만족|평가|점수|정도)/,
];

type ComparisonQuestion = SurveyRegressionResult["questions"][number];

const comparableConcepts = [
  "만족도",
  "인식",
  "빈도",
  "이용 시간",
  "비용",
  "선호",
  "사용성",
  "신뢰",
  "공정성",
  "의사소통",
  "피로",
  "소속감",
  "스트레스",
  "집중도",
  "학습 효과",
] as const;

function comparisonQuestionCorpus(question: ComparisonQuestion) {
  return questionSemanticCorpus(question);
}

function targetAliases(target: string) {
  const tokens = target
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const aliases = new Set([target]);
  for (const token of tokens) {
    if (
      token.length >= 2 &&
      !/^(?:이용|사용|경험|출퇴근|통근|서비스|프로그램|식당|강의|멘토링)$/u.test(token)
    ) aliases.add(token);
  }
  if (tokens.length >= 2) aliases.add(tokens.slice(-2).join(" "));
  if (tokens.length >= 3) aliases.add(tokens.slice(-3).join(" "));
  return [...aliases].filter((alias) => normalize(alias).length >= 2);
}

function comparisonTargetAliases(target: string, expectedTargets: string[]) {
  const normalizedTarget = normalize(target);
  return targetAliases(target).filter((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedAlias === normalizedTarget) return true;
    return expectedTargets.every(
      (candidate) =>
        normalize(candidate) === normalizedTarget ||
        !targetAliases(candidate).some(
          (candidateAlias) => normalize(candidateAlias) === normalizedAlias,
        ),
    );
  });
}

function questionMeasuresTarget(
  question: ComparisonQuestion,
  target: string,
  expectedTargets: string[],
) {
  const corpus = comparisonQuestionCorpus(question);
  return comparisonTargetAliases(target, expectedTargets).some((alias) =>
    normalize(corpus).includes(normalize(alias)),
  );
}

function comparableResponseFormat(
  left: ComparisonQuestion,
  right: ComparisonQuestion,
) {
  if (left.type !== right.type) return false;
  if (left.type === "scale") {
    if (
      left.scaleMin != null &&
      right.scaleMin != null &&
      left.scaleMin !== right.scaleMin
    ) return false;
    if (
      left.scaleMax != null &&
      right.scaleMax != null &&
      left.scaleMax !== right.scaleMax
    ) return false;
    return true;
  }
  if (left.type !== "single") return false;
  if (left.options.length < 2 || right.options.length < 2) return false;
  return (
    left.options.length === right.options.length &&
    left.options.every(
      (option, index) => normalize(option) === normalize(right.options[index] ?? ""),
    )
  );
}

function measuredConcepts(question: ComparisonQuestion) {
  const corpus = comparisonQuestionCorpus(question);
  return comparableConcepts.filter((concept) => conceptPresent(concept, corpus));
}

function comparisonConceptPresent(
  concept: string,
  question: ComparisonQuestion,
) {
  const corpus = comparisonQuestionCorpus(question);
  if (concept === "만족도") {
    return /만족|overall[_\s-]*satisfaction/u.test(corpus);
  }
  return conceptPresent(concept, corpus);
}

function parallelComparableMeasurementPresent(
  questions: SurveyRegressionResult["questions"],
  expectedTargets: string[],
  requiredConcept?: string,
) {
  if (expectedTargets.length < 2) return false;
  const baseConcept = requiredConcept?.replace(/\s*비교\s*/gu, " ").trim();
  const candidatesByTarget = expectedTargets.map((target) =>
    questions.filter((question) => {
      if (!questionMeasuresTarget(question, target, expectedTargets)) return false;
      if (baseConcept) {
        return comparisonConceptPresent(baseConcept, question);
      }
      return measuredConcepts(question).length > 0;
    }),
  );
  if (candidatesByTarget.some((candidates) => candidates.length === 0)) {
    return false;
  }

  const firstTargetCandidates = candidatesByTarget[0] ?? [];
  return firstTargetCandidates.some((first) => {
    const firstConcepts = baseConcept ? [baseConcept] : measuredConcepts(first);
    return candidatesByTarget.slice(1).every((candidates) =>
      candidates.some((candidate) =>
        comparableResponseFormat(first, candidate) &&
        firstConcepts.some((concept) =>
          comparisonConceptPresent(concept, candidate),
        ),
      ),
    );
  });
}

function directComparisonPresent(
  questions: SurveyRegressionResult["questions"],
  expectedTargets: string[],
  requiredConcept?: string,
) {
  return questions.some((question) => {
    const corpus = comparisonQuestionCorpus(question);
    if (!comparisonSignalPatterns.some((pattern) => pattern.test(corpus))) {
      return false;
    }
    const baseConcept = requiredConcept?.replace(/\s*비교\s*/gu, " ").trim();
    if (baseConcept && !comparisonConceptPresent(baseConcept, question)) return false;
    if (expectedTargets.length < 2) return true;
    return expectedTargets.every((target) =>
      comparisonTargetAliases(target, expectedTargets).some((alias) =>
        normalize(corpus).includes(normalize(alias)),
      ),
    );
  });
}

function groupedComparisonMeasurementPresent(
  questions: SurveyRegressionResult["questions"],
  expectedTargets: string[],
  requiredConcept?: string,
) {
  if (expectedTargets.length < 2) return false;
  const groupQuestion = questions.find((question) => {
    const corpus = comparisonQuestionCorpus(question);
    const identifiesGroup =
      /(?:주로|가장\s*자주).*어떤\s*(?:수단|서비스|대상|앱|프로그램|식당)|주\s*(?:이용|사용|통근)\s*(?:수단|대상|서비스|앱|프로그램)/u.test(
        corpus,
      );
    return (
      identifiesGroup &&
      expectedTargets.every((target) =>
        comparisonTargetAliases(target, expectedTargets).some((alias) =>
          normalize(corpus).includes(normalize(alias)),
        ),
      )
    );
  });
  if (!groupQuestion) return false;
  const baseConcept = requiredConcept?.replace(/\s*비교\s*/gu, " ").trim();
  return questions.some((question) => {
    if (question === groupQuestion) return false;
    const corpus = comparisonQuestionCorpus(question);
    if (baseConcept && !comparisonConceptPresent(baseConcept, question)) return false;
    return /(?:집단|수단|대상|서비스|앱|프로그램|식당).*비교|비교.*(?:집단|수단|대상|서비스|앱|프로그램|식당)/u.test(
      corpus,
    );
  });
}

function comparisonCoveragePresent(
  questions: SurveyRegressionResult["questions"],
  expectedTargets: string[],
  requiredConcept?: string,
) {
  return (
    directComparisonPresent(questions, expectedTargets, requiredConcept) ||
    parallelComparableMeasurementPresent(
      questions,
      expectedTargets,
      requiredConcept,
    ) ||
    groupedComparisonMeasurementPresent(
      questions,
      expectedTargets,
      requiredConcept,
    )
  );
}

function purposeConceptPresent(
  concept: string,
  semanticCorpus: string,
  questions: SurveyRegressionResult["questions"],
  expectedTargets: string[],
) {
  if (concept === "이용 패턴") {
    const behaviorDimensions = [
      /(?:얼마나\s*자주|이용\s*빈도|방문\s*빈도)/u,
      /(?:주로\s*무엇|이용\s*목적|주요\s*활동)/u,
      /(?:주로\s*언제|이용\s*시간대)/u,
      /(?:주로\s*어떤\s*상황|이용\s*상황)/u,
    ];
    return behaviorDimensions.filter((pattern) =>
      questions.some((question) => pattern.test(questionSemanticCorpus(question))),
    ).length >= 2;
  }
  const relationship = concept.match(
    /^(.+?)(?:과|와)\s+(.+?)(?:의)?\s*(?:관계|상관관계|연관성|영향)$/u,
  );
  if (relationship) {
    return [relationship[1], relationship[2]].every((variable) =>
      conceptPresent(variable, semanticCorpus),
    );
  }
  if (!/비교/u.test(concept)) return conceptPresent(concept, semanticCorpus);
  const baseConcept = concept.replace(/\s*비교\s*/gu, " ").trim();
  return (
    (!baseConcept || conceptPresent(baseConcept, semanticCorpus)) &&
    comparisonCoveragePresent(questions, expectedTargets, concept)
  );
}

function directSatisfactionMeasurementPresent(
  questions: SurveyRegressionResult["questions"],
) {
  return questions.some((question) => {
    const corpus = questionSemanticCorpus(question);
    if (
      !/(?:전반적으로\s*)?얼마나\s*만족|전반적인\s*만족|전반.*(?:어땠|평가)|종합.*(?:평가|어느\s*정도)|overall[_\s-]*satisfaction/u.test(
        corpus,
      )
    ) {
      return false;
    }
    if (question.type === "scale") return true;
    if (question.type !== "single") return false;
    const satisfactionChoices = question.options.filter((option) =>
      /만족|보통/u.test(option),
    );
    return satisfactionChoices.length >= 3;
  });
}

type EvaluatedQuestion = SurveyRegressionResult["questions"][number];

export type EvaluatedQuestionRole =
  | "eligibility_screening"
  | "non_disqualifying_routing"
  | "core_purpose"
  | "substantive_behavior"
  | "other";

const corePurposeRolePattern =
  /^(?:awareness|evaluation|driver|barrier|priority|outcome|open|preference|construct|unmet_need|demand|satisfaction)$/u;
const behaviorRolePattern = /^(?:behavior|experience|frequency|usage)$/u;
const corePurposeTitlePattern =
  /(?:가장\s*(?:큰|주된)?\s*(?:이유|장벽)|이용하지\s*않는\s*이유|사용하지\s*않는\s*이유|비이용\s*이유|비사용\s*이유|불편|만족|개선|인지|알고\s*있|의향|가능성|평가|필요|선호|기대)/u;
const statusQuestionPattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|수강|통학|운동|클릭|먹|마시)(?:한\s*적|해\s*본|해본|어\s*본|어본|한\s*경험|하고\s*있|하지\s*않고\s*있|했(?:나요|습니까)|했었(?:나요|습니까)|여부)|(?:현재|최근).*(?:해당|맞(?:나요|습니까)|있(?:나요|습니까)|재학|재직|거주|직장에\s*다니고)/u;
const statusChoicePattern =
  /(?:경험|이용|사용|참여|방문|구매).*(?:있음|없음)|(?:예|네).*(?:아니요|아님)|해당함.*해당하지\s*않음/u;
const substantiveStatusLookalikePattern =
  /(?:얼마나\s*(?:자주|만족|편리|쉬|어렵|불편|도움|필요|안전|위험|혼잡)|몇\s*(?:번|회)|며칠|빈도|횟수|어떤\s*(?:목적|이유)|주된\s*목적|이용\s*목적|알아보거나\s*비교|검토하거나\s*비교)/u;

function questionMetadataText(question: EvaluatedQuestion) {
  return [
    question.role,
    question.measuredRole,
    question.planBlockId,
    question.purposeBlockId,
    question.measuredVariable,
    question.questionPurpose,
  ].filter(Boolean).join(" ");
}

function questionLooksLikeStatusCheck(question: EvaluatedQuestion) {
  const titleLooksSubstantive = substantiveStatusLookalikePattern.test(
    question.title,
  );
  const titleLooksLikeStatus =
    !titleLooksSubstantive &&
    statusQuestionPattern.test(question.title);
  const compactStatusChoices =
    !titleLooksSubstantive &&
    question.options.length >= 2 &&
    question.options.length <= 4 &&
    statusChoicePattern.test(question.options.join("\n"));
  return titleLooksLikeStatus || compactStatusChoices;
}

function duplicateOverallConstructGroups(questions: EvaluatedQuestion[]) {
  const constructByQuestion = questions.flatMap((question, index) => {
    if (question.type !== "scale" && question.type !== "single") return [];
    const corpus = [
      question.title,
      question.measuredVariable,
      question.measuredConstruct,
    ].filter(Boolean).join(" ");
    const key =
      /안전/u.test(corpus) &&
      /(?:전반적|전체적|종합적).*(?:안전|인식|평가)|(?:안전|인식|평가).*(?:전반적|전체적|종합적)|(?:실험실의?\s*)?안전\s*수준.*(?:어느\s*정도|어떻게)/u.test(
        question.title,
      )
        ? "overall-safety-perception"
        : null;
    return key ? [{ key, questionId: String(question.id ?? index + 1) }] : [];
  });
  const groups = new Map<string, string[]>();
  for (const item of constructByQuestion) {
    groups.set(item.key, [...(groups.get(item.key) ?? []), item.questionId]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function isCorePurposeQuestion(question: EvaluatedQuestion) {
  const role = `${question.role ?? ""} ${question.measuredRole ?? ""}`;
  if (corePurposeRolePattern.test(question.role ?? "")) return true;
  if (corePurposeRolePattern.test(question.measuredRole ?? "")) return true;
  if (/barrier|reason|satisfaction|evaluation|priority|awareness/u.test(role)) {
    return true;
  }
  // The API intentionally strips internal role metadata from public questions.
  // A reason such as "대상인지 확인함" may still contain broad purpose words,
  // so visible title copy is the only safe fallback for this classification.
  return corePurposeTitlePattern.test(question.title);
}

export function isEligibilityScreeningQuestion(question: EvaluatedQuestion) {
  if (isCorePurposeQuestion(question)) return false;
  const metadata = questionMetadataText(question);
  const explicitEligibility =
    question.measuredRole === "eligibility" ||
    /(?:^|[-_\s])(?:eligibility|respondent-qualification|target-screening)(?:$|[-_\s])/u.test(
      metadata,
    );
  if (
    question.disqualifiesRespondent === true ||
    explicitEligibility
  ) {
    return true;
  }
  if (question.disqualifiesRespondent === false) return false;
  if (question.measuredRole && question.measuredRole !== "eligibility") {
    return false;
  }
  if (question.role && question.role !== "screening") return false;
  return questionLooksLikeStatusCheck(question);
}

export function isNonDisqualifyingRoutingQuestion(
  question: EvaluatedQuestion,
) {
  if (isCorePurposeQuestion(question)) return false;
  const looksLikeStatus = questionLooksLikeStatusCheck(question);
  if (
    question.disqualifiesRespondent === false &&
    looksLikeStatus
  ) {
    return true;
  }
  if (isEligibilityScreeningQuestion(question)) return false;
  return (
    question.role === "screening" &&
    looksLikeStatus &&
    (question.showIfQuestionIds?.length ?? 0) > 0
  );
}

export function classifySurveyQuestionRole(
  question: EvaluatedQuestion,
): EvaluatedQuestionRole {
  if (isCorePurposeQuestion(question)) return "core_purpose";
  if (isEligibilityScreeningQuestion(question)) return "eligibility_screening";
  if (isNonDisqualifyingRoutingQuestion(question)) {
    return "non_disqualifying_routing";
  }
  if (
    behaviorRolePattern.test(question.role ?? "") ||
    behaviorRolePattern.test(question.measuredRole ?? "") ||
    /(?:얼마나\s*자주|몇\s*번|빈도|소요\s*시간|이동\s*수단)/u.test(question.title)
  ) {
    return "substantive_behavior";
  }
  return "other";
}

function screeningQuestionPresent(questions: EvaluatedQuestion[]) {
  return questions.some(
    (question) =>
      classifySurveyQuestionRole(question) === "eligibility_screening",
  );
}

const prerequisiteTargetStopWords = new Set([
  "최근",
  "현재",
  "동안",
  "이번",
  "지난",
  "해당",
  "여부",
  "경험",
  "이용",
  "사용",
  "참여",
  "구매",
  "방문",
  "적이",
  "있나요",
  "없나요",
]);

function entryQuestionTargetTerms(question: EvaluatedQuestion) {
  const withoutPeriod = question.title
    .replace(/^(?:최근|지난)\s*[^ ]+(?:\s*동안)?\s*/u, "")
    .replace(/^이번\s*(?:학기|학년도)에?\s*/u, "")
    .replace(/[?？.]/gu, "");
  const beforeAction =
    withoutPeriod.match(
      /^(.+?)(?:을|를|에|에서)?\s*(?:이용|사용|참여|구매|방문|시청|수강|먹|마시|재학|재직|거주)/u,
    )?.[1] ?? "";
  const normalizedFull = normalize(beforeAction);
  const tail = beforeAction.split(/(?:의|에서|에 있는)/u).at(-1) ?? "";
  const tokens = [normalizedFull, normalize(tail)]
    .filter((item) => item.length >= 2)
    .filter((item) => !prerequisiteTargetStopWords.has(item));
  return [...new Set(tokens)].sort((left, right) => right.length - left.length);
}

function questionDependsOnEntryQuestion(
  question: EvaluatedQuestion,
  entryQuestion: EvaluatedQuestion,
) {
  if (
    (question.showIfQuestionIds ?? []).includes(entryQuestion.id ?? "")
  ) {
    return true;
  }
  const role = classifySurveyQuestionRole(question);
  if (
    role === "eligibility_screening" ||
    role === "non_disqualifying_routing"
  ) {
    return false;
  }
  if (/(?:재학|재직|거주|연령|학년)/u.test(entryQuestion.title)) {
    return role !== "other";
  }
  const terms = entryQuestionTargetTerms(entryQuestion);
  if (terms.length === 0) return false;
  const corpus = normalize(
    `${question.title} ${question.measuredVariable ?? ""} ${question.questionPurpose ?? question.reason ?? ""}`,
  );
  return terms.some((term) => corpus.includes(term));
}

export function validateScreeningQuestionPosition(
  questions: EvaluatedQuestion[],
) {
  for (let index = 0; index < questions.length; index += 1) {
    const entryQuestion = questions[index];
    const entryRole = classifySurveyQuestionRole(entryQuestion);
    if (
      entryRole !== "eligibility_screening" &&
      entryRole !== "non_disqualifying_routing"
    ) {
      continue;
    }
    const metadata = questionMetadataText(entryQuestion);
    const hasExplicitEntryContract =
      entryQuestion.disqualifiesRespondent === true ||
      entryQuestion.measuredRole === "eligibility" ||
      entryQuestion.role === "screening" ||
      /(?:^|[-_\s])(?:eligibility|respondent-qualification|target-screening)(?:$|[-_\s])/u.test(
        metadata,
      ) ||
      /(?:응답자|대상|자격|적격).*(?:구분|확인)|(?:구분|확인).*(?:응답자|대상|자격|적격)/u.test(
        entryQuestion.questionPurpose ?? entryQuestion.reason ?? "",
      ) ||
      (entryQuestion.showIfQuestionIds?.length ?? 0) > 0;
    const heuristicEntryTarget = hasExplicitEntryContract
      ? null
      : entryQuestionTargetTerms(entryQuestion)[0] ?? null;
    if (!hasExplicitEntryContract && !heuristicEntryTarget) continue;
    const dependentQuestionIds = questions
      .slice(0, index)
      .filter((question) => {
        if (!questionDependsOnEntryQuestion(question, entryQuestion)) {
          return false;
        }
        if (!heuristicEntryTarget) return true;
        const corpus = normalize(
          `${question.title} ${question.measuredVariable ?? ""} ${question.questionPurpose ?? question.reason ?? ""}`,
        );
        return corpus.includes(heuristicEntryTarget);
      })
      .map((question, questionIndex) => question.id ?? String(questionIndex + 1));
    if (dependentQuestionIds.length > 0) {
      return {
        entryQuestionId: entryQuestion.id ?? String(index + 1),
        entryQuestionIndex: index,
        dependentQuestionIds,
      };
    }
  }
  return null;
}

function issue(
  code: string,
  message: string,
  cluster: SurveyRegressionIssue["cluster"],
  fatal = true,
): SurveyRegressionIssue {
  return { code, message, cluster, fatal };
}

export function classifyGenerationPath(input: {
  httpStatus: number | null;
  responseType: string | null;
  responseCode?: string | null;
  generationSource: string | null;
  modelCallCount?: number;
  repairCount: number;
  fallbackCount: number;
  fallbackReason: string | null;
  normalizedMetadataPaths: string[];
  metadataOnlyNormalization?: boolean;
  respondentFacingContentChanged?: boolean;
  outputParsed?: boolean;
  transportFailureKind?:
    | "environment_transport_failure"
    | "environment_auth_failure"
    | null;
}): GenerationPath {
  const modelCallCount = input.modelCallCount ?? 0;
  const outputParsed = input.outputParsed ?? false;
  if (input.transportFailureKind) return input.transportFailureKind;
  if (
    modelCallCount === 0 &&
    !outputParsed &&
    (input.httpStatus === 429 || input.responseCode === "RATE_LIMITED")
  ) {
    return "environment_rate_limited";
  }
  if (
    modelCallCount === 0 &&
    !outputParsed &&
    (input.fallbackReason === "api-key-missing" ||
      input.fallbackReason === "mock-mode" ||
      input.generationSource === "initial_local_blueprint")
  ) {
    return "environment_runtime_inactive";
  }
  if (input.responseType === "clarification") return "clarification";
  if (
    input.httpStatus === null ||
    input.httpStatus < 200 ||
    input.httpStatus >= 300 ||
    input.responseType === "error"
  ) {
    return "request_failure";
  }
  if (
    input.fallbackCount > 0 ||
    Boolean(input.fallbackReason) ||
    /fallback/.test(input.generationSource ?? "")
  ) {
    return "hard_fallback";
  }
  if (
    input.repairCount > 0 ||
    input.respondentFacingContentChanged ||
    /partial_repair/.test(input.generationSource ?? "")
  ) {
    return "partial_repair";
  }
  if (
    input.metadataOnlyNormalization ||
    input.normalizedMetadataPaths.length > 0
  ) {
    return "deterministic_metadata_normalization";
  }
  return "clean_model_success";
}

export function evaluateSemanticResult(
  testCase: SurveyRegressionCase,
  result: Pick<
    SurveyRegressionResult,
    | "classification"
    | "httpStatus"
    | "responseType"
    | "canonicalTargetPopulation"
    | "finalRespondentGroup"
    | "canonicalSurveyObject"
    | "finalEvaluationTarget"
    | "title"
    | "description"
    | "questions"
    | "schemaIssues"
    | "semanticIssues"
    | "qualityIssues"
  >,
) {
  const fatalFailures: SurveyRegressionIssue[] = [];
  const warnings: SurveyRegressionIssue[] = [];
  const questionTitleText = result.questions.map((item) => item.title).join("\n");
  const questionText = result.questions
    .map((item) => questionSemanticCorpus(item))
    .join("\n");
  const targetText =
    result.finalRespondentGroup ?? result.canonicalTargetPopulation ?? "";
  const objectText =
    result.finalEvaluationTarget ?? result.canonicalSurveyObject ?? "";
  const allText = [
    targetText,
    objectText,
    result.title,
    result.description,
    questionText,
  ].filter(Boolean).join("\n");

  if (
    result.classification === "environment_rate_limited" ||
    result.classification === "environment_runtime_inactive" ||
    result.classification === "environment_transport_failure" ||
    result.classification === "environment_auth_failure"
  ) {
    return { fatalFailures, warnings };
  }

  if (testCase.clarificationExpected) {
    if (result.responseType !== "clarification") {
      fatalFailures.push(issue("CLARIFICATION_MISSING", "모호한 입력에 설문을 억지 생성함", "clarification"));
    }
    return { fatalFailures, warnings };
  }
  if (result.responseType === "clarification") {
    fatalFailures.push(issue("UNEXPECTED_CLARIFICATION", "명확한 입력에 불필요한 확인 질문을 반환함", "clarification"));
    return { fatalFailures, warnings };
  }
  if (result.classification === "request_failure") {
    fatalFailures.push(issue("REQUEST_FAILURE", `요청 실패: ${result.httpStatus ?? "unknown"}`, "request_transport"));
  }
  if (result.classification === "hard_fallback") {
    fatalFailures.push(issue("HARD_FALLBACK", "명확한 입력이 hard fallback으로 처리됨", "hard_fallback"));
  }
  if (!targetPopulationMatch(
    targetText,
    testCase.expectedTargetPopulation,
    testCase.expectedSurveyObject,
  )) {
    fatalFailures.push(issue("TARGET_POPULATION_MISMATCH", `응답 대상 불일치: ${targetText}`, "target_population"));
  }
  for (const condition of testCase.expectedEligibilityConditions ?? []) {
    if (!eligibilityConditionPresent(`${targetText}\n${questionText}`, condition)) {
      fatalFailures.push(
        issue(
          "ELIGIBILITY_CONDITION_DROPPED",
          `응답 적격 조건 손실: ${condition}`,
          "eligibility",
        ),
      );
    }
  }
  if (
    testCase.screeningExpected === true &&
    !screeningQuestionPresent(result.questions)
  ) {
    fatalFailures.push(
      issue(
        "ELIGIBILITY_CHECK_MISSING",
        "응답 적격 조건을 확인하는 screening 문항이 없음",
        "eligibility",
      ),
    );
  }
  const surveyObjectMatches =
    testCase.expectedTargetCardinality === "multiple"
      ? !surveyPurposePollutionPattern.test(objectText) &&
        !respondentFrameInSurveyObjectPattern.test(objectText) &&
        testCase.expectedSurveyObject.every((expected) =>
          semanticTextMatch(objectText, [expected]),
        )
      : surveyObjectRoleCompatible(
          objectText,
          testCase.expectedSurveyObject,
          allText,
        );
  if (!surveyObjectMatches) {
    fatalFailures.push(issue("SURVEY_OBJECT_MISMATCH", `조사 대상 불일치: ${objectText}`, "survey_object"));
  }
  for (const entity of testCase.contextEntities ?? []) {
    if (!semanticTextMatch(allText, [entity])) {
      fatalFailures.push(
        issue(
          "CONTEXT_ENTITY_MISMATCH",
          `맥락 장소·서비스 손실: ${entity}`,
          "context_entity",
        ),
      );
    }
  }
  const malformedSemanticText = `${objectText}\n${questionTitleText}`;
  if (
    /(?:에\s*대해|에\s*관해)(?:를|을)|(?:미치는|교통수단별)(?:은|에)|^에게|묻고\s*싶/u.test(
      malformedSemanticText,
    ) ||
    /[\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Cyrillic}]/u.test(
      questionTitleText,
    )
  ) {
    fatalFailures.push(
      issue(
        "MALFORMED_SEMANTIC_PHRASE",
        "조사 요청 조각이나 잘못된 조사가 최종 대상 또는 질문에 남음",
        "question_quality",
      ),
    );
  }
  for (const forbidden of testCase.forbiddenTargetExpansions) {
    if (normalize(targetText).includes(normalize(forbidden))) {
      fatalFailures.push(issue("TARGET_POPULATION_EXPANDED", `응답 대상이 금지 범위로 확대됨: ${forbidden}`, "target_population"));
    }
  }
  for (const forbidden of testCase.forbiddenSurveyObjects) {
    if (normalize(objectText).includes(normalize(forbidden))) {
      fatalFailures.push(issue("FORBIDDEN_SURVEY_OBJECT", `금지된 조사 대상으로 바뀜: ${forbidden}`, "survey_object"));
    }
  }
  for (const term of testCase.mustPreserveTerms) {
    if (!normalize(allText).includes(normalize(term))) {
      fatalFailures.push(issue("NAMED_TERM_LOST", `고유명사 또는 핵심어 손실: ${term}`, "survey_object"));
    }
  }
  if (testCase.mustPreserveNegation && !negationPattern.test(allText)) {
    fatalFailures.push(issue("NEGATION_LOST", "비이용·비참여·미구매 조건이 최종 설문에서 사라짐", "negation"));
  }
  const purposeText = [result.title, result.description, questionText]
    .filter(Boolean)
    .join("\n");
  for (const concept of testCase.expectedPurposeConcepts) {
    if (
      !purposeConceptPresent(
        concept,
        purposeText,
        result.questions,
        testCase.expectedSurveyObject,
      )
    ) {
      fatalFailures.push(
        issue(
          "REQUIRED_PURPOSE_MISSING",
          `필수 조사 목적 누락: ${concept}`,
          "purpose_coverage",
        ),
      );
    }
  }
  for (const concept of testCase.requiredQuestionConcepts) {
    const requiresParallelTargetCoverage =
      testCase.expectedTargetCardinality === "multiple" &&
      testCase.expectedPurposeConcepts.some(
        (purpose) =>
          /비교/u.test(purpose) &&
          conceptPresent(concept, normalize(purpose)),
      );
    const present =
      concept === "대상 비교"
        ? comparisonCoveragePresent(result.questions, testCase.expectedSurveyObject)
        : requiresParallelTargetCoverage
          ? comparisonCoveragePresent(
              result.questions,
              testCase.expectedSurveyObject,
              concept,
            )
        : conceptPresent(concept, questionText);
    if (!present) {
      fatalFailures.push(issue("REQUIRED_QUESTION_CONCEPT_MISSING", `필수 문항 개념 누락: ${concept}`, concept.includes("시간") ? "reference_period" : "purpose_coverage"));
    }
  }
  for (const concept of testCase.forbiddenPurposeConcepts ?? []) {
    if (conceptPresent(concept, purposeText)) {
      fatalFailures.push(
        issue(
          "FORBIDDEN_PURPOSE_ADDED",
          `입력에 없는 조사 목적이 추가됨: ${concept}`,
          "purpose_coverage",
        ),
      );
    }
  }
  for (const concept of testCase.forbiddenQuestionConcepts) {
    if (conceptPresent(concept, questionText)) {
      fatalFailures.push(issue("FORBIDDEN_CONCEPT_PRESENT", `금지 문항 개념 포함: ${concept}`, "question_quality"));
    }
  }
  if (
    genericFillerPatterns.some((pattern) => pattern.test(questionTitleText)) ||
    /[‘'][^’']+[’'](?:과|와)\s*관련해\s*평소\s*가장\s*자주\s*겪는\s*상황/u.test(
      questionTitleText,
    ) ||
    /[‘'][^’']+[’'](?:과|와)\s*관련한\s*행동은\s*주로\s*어떤\s*상황에서/u.test(
      questionTitleText,
    )
  ) {
    fatalFailures.push(issue("GENERIC_FILLER", "generic filler 문항이 포함됨", "question_quality"));
  }
  const normalizedQuestions = result.questions.map((item) => normalize(item.title));
  if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
    fatalFailures.push(issue("DUPLICATE_QUESTION", "완전히 중복된 질문이 있음", "question_quality"));
  }
  for (const group of duplicateOverallConstructGroups(result.questions)) {
    fatalFailures.push(
      issue(
        "DUPLICATE_CONSTRUCT",
        `같은 전반적 construct를 문항 ${group.join(", ")}에서 중복 측정함`,
        "question_quality",
      ),
    );
  }
  const screeningPositionIssue = validateScreeningQuestionPosition(
    result.questions,
  );
  if (screeningPositionIssue) {
    fatalFailures.push(
      issue(
        "MISPLACED_SCREENING_QUESTION",
        `응답 적격성·분기 문항이 ${screeningPositionIssue.entryQuestionIndex + 1}번째에 배치돼 선행 문항 ${screeningPositionIssue.dependentQuestionIds.join(", ")}이 해당 조건을 미리 전제함`,
        "question_quality",
      ),
    );
  }
  const inconvenienceQuestions = result.questions.filter(
    (item) => item.type === "multiple" && /불편했던\s*점/u.test(item.title),
  );
  if (inconvenienceQuestions.length > 1) {
    fatalFailures.push(
      issue(
        "DUPLICATE_CONSTRUCT",
        "같은 불편 유형을 묻는 복수선택 문항이 중복됨",
        "question_quality",
      ),
    );
  }
  if (
    testCase.requiredQuestionConcepts.includes("만족도") &&
    !directSatisfactionMeasurementPresent(result.questions)
  ) {
    fatalFailures.push(
      issue(
        "OVERALL_SATISFACTION_MISSING",
        "만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음",
        "purpose_coverage",
      ),
    );
  }
  if (result.questions.length !== testCase.questionCount) {
    fatalFailures.push(issue("QUESTION_COUNT_MISMATCH", `문항 수 ${result.questions.length}/${testCase.questionCount}`, "question_quality"));
  }
  if (result.schemaIssues.length > 0) {
    fatalFailures.push(issue("SCHEMA_ISSUES", result.schemaIssues.join(", "), "schema"));
  }
  if (result.semanticIssues.length > 0) {
    fatalFailures.push(issue("SEMANTIC_ISSUES", result.semanticIssues.join(", "), "semantic_validation"));
  }
  if (result.qualityIssues.length > 0) {
    warnings.push(issue("QUALITY_ISSUES", result.qualityIssues.join(", "), "question_quality", false));
  }
  if (result.classification === "partial_repair") {
    warnings.push(issue("PARTIAL_REPAIR", "모델 출력 일부가 복구됨", "partial_repair", false));
  }
  return { fatalFailures, warnings };
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /(?:authorization|cookie|session(?:Token)?|api[_-]?key)\s*[=:]\s*[^\s,}]+/gi,
];

export function redactSecrets(value: string) {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, "[REDACTED]"), value);
}

export function assertNoSecrets(value: string) {
  const redacted = redactSecrets(value);
  if (redacted !== value) throw new Error("SECRET_PATTERN_DETECTED");
}
