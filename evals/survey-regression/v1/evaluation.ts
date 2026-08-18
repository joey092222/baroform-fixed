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
  "소요 시간": [/소요\s*시간/, /걸리는\s*시간/, /몇\s*분/],
  혼잡: [/혼잡/, /붐비/],
  안전: [/안전/, /위험/],
  접근성: [/접근성/, /접근.*어려/],
  불편: [/불편/, /어려운\s*점/, /장벽/],
  "개선 요구": [/개선/, /바라는\s*점/, /보완/],
  만족도: [/만족/, /평가/],
  인식: [/인식/, /이미지/, /어떻게\s*생각/],
  이미지: [/이미지/, /인식/],
  인지: [/인지/, /알고\s*있/],
  "이용 경험": [/이용한\s*적/, /사용한\s*적/, /이용\s*경험/, /사용\s*경험/],
  "방문 경험": [/방문한\s*적/, /방문\s*경험/],
  "참여 경험": [/참여한\s*적/, /참가한\s*적/, /참여\s*경험/],
  "수강 경험": [/수강한\s*적/, /수강\s*경험/],
  "이용 빈도": [/이용\s*(?:빈도|횟수)/, /사용\s*(?:빈도|횟수)/, /얼마나\s*자주.*(?:이용|사용)/],
  "구매 빈도": [/구매\s*(?:빈도|횟수)/, /주문\s*(?:빈도|횟수)/, /얼마나\s*자주.*(?:구매|주문|외식)/],
  "이용 시간": [/이용\s*시간/, /사용\s*시간/, /시청\s*시간/],
  "시간 사용": [/시간\s*사용/, /얼마나\s*시간/, /하루.*시간/],
  "수면 시간": [/수면\s*시간/, /몇\s*시간.*(?:자|수면)/],
  "대기 시간": [/대기\s*시간/, /얼마나\s*기다/],
  빈도: [/빈도/, /횟수/, /얼마나\s*자주/],
  비용: [/비용/, /가격/, /요금/, /지출/, /부담/],
  "비이용 이유": [/이용하지\s*않는\s*이유/, /사용하지\s*않는\s*이유/, /참여하지\s*않는\s*이유/, /구매하지\s*않는\s*이유/, /가입하지\s*않는\s*이유/, /방문하지\s*않는\s*이유/, /보지\s*않는\s*이유/, /비이용\s*이유/, /미구매\s*이유/, /불참\s*이유/, /장벽/],
  "이용 의향": [/이용\s*의향/, /사용\s*의향/, /다시\s*(?:이용|사용)/, /쓸\s*생각/],
  "참여 의향": [/참여\s*의향/, /가입\s*의향/, /재참여/, /참가할\s*생각/],
  "서비스 필요성": [/필요/, /도입\s*수요/, /수요/],
  "원하는 기능": [/원하는\s*기능/, /필요한\s*기능/, /기능\s*수요/],
  사용성: [/사용성/, /편의성/, /사용하기\s*쉬/],
  신뢰: [/신뢰/],
  공정성: [/공정/],
  의사소통: [/의사소통/, /소통/],
  피로: [/피로/],
  소속감: [/소속감/],
  스트레스: [/스트레스/],
  집중도: [/집중/],
  갈등: [/갈등/],
  "해결 방식": [/해결/, /대처/],
  "학습 효과": [/학습\s*효과/, /도움\s*정도/, /자신감/],
  "학교 적응": [/학교\s*적응/, /적응/],
  "선택 이유": [/선택한\s*이유/, /선택\s*이유/],
  "이용 목적": [/이용\s*목적/, /사용\s*목적/],
  선호: [/선호/, /관심\s*(?:활동|주제)/],
  충동구매: [/충동\s*구매/],
  저축: [/저축/],
  "대상 비교": [/비교/, /차이/],
};

const negationPattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|클릭|운동)(?:하지\s*않|하지\s*못|한\s*적\s*없)|비이용|미구매|불참|미가입|비방문|비시청|비주문|안\s*(?:쓰|가|하|먹|보)|못\s*(?:쓰|가|하)/;

const genericFillerPatterns = conceptPatterns["generic filler"];

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

export function conceptPresent(concept: string, corpus: string) {
  const mapped = conceptPatterns[concept];
  if (mapped) return mapped.some((pattern) => pattern.test(corpus));
  const tokens = meaningfulTokens(concept);
  return tokens.length > 0 && tokens.every((token) => normalize(corpus).includes(normalize(token)));
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
  generationSource: string | null;
  repairCount: number;
  fallbackCount: number;
  fallbackReason: string | null;
  normalizedMetadataPaths: string[];
}): GenerationPath {
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
  if (input.repairCount > 0 || /partial_repair/.test(input.generationSource ?? "")) {
    return "partial_repair";
  }
  if (input.normalizedMetadataPaths.length > 0) {
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
  const questionText = result.questions.map((item) => item.title).join("\n");
  const targetText = [
    result.finalRespondentGroup,
    result.canonicalTargetPopulation,
    result.description,
  ].filter(Boolean).join(" ");
  const objectText = [
    result.finalEvaluationTarget,
    result.canonicalSurveyObject,
    result.title,
    questionText,
  ].filter(Boolean).join(" ");
  const allText = `${targetText}\n${objectText}`;

  if (testCase.clarificationExpected) {
    if (result.responseType !== "clarification") {
      fatalFailures.push(issue("EXPECTED_CLARIFICATION_MISSING", "모호한 입력에 설문을 억지 생성함", "clarification"));
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
  if (!semanticTextMatch(targetText, testCase.expectedTargetPopulation)) {
    fatalFailures.push(issue("TARGET_POPULATION_MISMATCH", `응답 대상 불일치: ${targetText}`, "target_population"));
  }
  if (!semanticTextMatch(objectText, testCase.expectedSurveyObject)) {
    fatalFailures.push(issue("SURVEY_OBJECT_MISMATCH", `조사 대상 불일치: ${objectText}`, "survey_object"));
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
  for (const concept of testCase.requiredQuestionConcepts) {
    if (!conceptPresent(concept, questionText)) {
      fatalFailures.push(issue("REQUIRED_CONCEPT_MISSING", `필수 문항 개념 누락: ${concept}`, concept.includes("시간") ? "reference_period" : "purpose_coverage"));
    }
  }
  for (const concept of testCase.forbiddenQuestionConcepts) {
    if (conceptPresent(concept, questionText)) {
      fatalFailures.push(issue("FORBIDDEN_CONCEPT_PRESENT", `금지 문항 개념 포함: ${concept}`, "question_quality"));
    }
  }
  if (genericFillerPatterns.some((pattern) => pattern.test(questionText))) {
    fatalFailures.push(issue("GENERIC_FILLER", "generic filler 문항이 포함됨", "question_quality"));
  }
  const normalizedQuestions = result.questions.map((item) => normalize(item.title));
  if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
    fatalFailures.push(issue("DUPLICATE_QUESTION", "완전히 중복된 질문이 있음", "question_quality"));
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
