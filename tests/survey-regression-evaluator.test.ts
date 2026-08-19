import assert from "node:assert/strict";
import test from "node:test";

import { devCases, holdoutCases } from "../evals/survey-regression/v1/dataset-source";
import { frontedPurposeSmokeCases } from "../evals/survey-regression/v1.1/fronted-purpose-smoke";
import {
  conceptPresent,
  evaluateSemanticResult,
  semanticTextMatch,
  targetPopulationMatch,
} from "../evals/survey-regression/v1/evaluation";
import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";

const allCases = [...devCases, ...holdoutCases];
const testCase = (id: string) => {
  const found = allCases.find((item) => item.id === id);
  if (!found) throw new Error(`TEST_CASE_MISSING:${id}`);
  return found;
};
const frontedCase = (id: string) => {
  const found = frontedPurposeSmokeCases.find((item) => item.id === id);
  if (!found) throw new Error(`FRONTED_TEST_CASE_MISSING:${id}`);
  return found;
};
type EvaluatedResult = Parameters<typeof evaluateSemanticResult>[1];
const result = (overrides: Partial<EvaluatedResult>): EvaluatedResult => ({
  classification: "deterministic_metadata_normalization",
  httpStatus: 200,
  responseType: "survey",
  canonicalTargetPopulation: null,
  finalRespondentGroup: "응답자",
  canonicalSurveyObject: null,
  finalEvaluationTarget: "조사 대상",
  title: "설문",
  description: "설문 설명",
  questions: [],
  schemaIssues: [],
  semanticIssues: [],
  qualityIssues: [],
  ...overrides,
});
const question = (
  title: string,
  type = "single",
  options: string[] = [],
): SurveyRegressionResult["questions"][number] => ({ title, type, options });

test("학교 약칭과 정식 명칭은 일반 규칙으로 같은 응답 대상으로 비교한다", () => {
  assert.equal(
    targetPopulationMatch("한울대 경영학부 학생", ["한울대학교 경영학부 학생"]),
    true,
  );
  assert.equal(
    semanticTextMatch("연세대학교 경영대학 재학생", ["연세대 경영대생"]),
    true,
  );
});

test("전체 집단과 이용자 집단의 범위 차이를 동의 표현으로 통과시키지 않는다", () => {
  assert.equal(targetPopulationMatch("네이버 웹툰을 이용하는 대학생", ["대학생"]), false);
  assert.equal(targetPopulationMatch("대학생", ["네이버 웹툰을 이용하는 대학생"]), false);
  assert.equal(
    targetPopulationMatch("네이버 웹툰을 이용하는 대학생", ["네이버 웹툰 이용 대학생"]),
    true,
  );
});

test("필수 개념 동의 표현을 선택지까지 포함해 인식한다", () => {
  assert.equal(conceptPresent("비이용 이유", "친환경 세제를 사지 않는 이유"), true);
  assert.equal(conceptPresent("이용 빈도", "최근 한 달 동안 얼마나 자주 방문했나요?"), true);
  assert.equal(conceptPresent("학습 효과", "취업 준비에 얼마나 도움이 되었나요?"), true);
  assert.equal(conceptPresent("개선 요구", "가장 먼저 바뀌었으면 하는 점"), true);
  assert.equal(conceptPresent("대상 비교", "어떤 프로그램에 참여했나요?"), true);
});

test("비이용 조건과 개선 요구가 보존된 설문을 부정 손실로 오판하지 않는다", () => {
  const evaluated = evaluateSemanticResult(
    testCase("dev-past-014"),
    result({
      finalRespondentGroup: "한경관 학식을 먹지 않는 연세대학교 재학생",
      finalEvaluationTarget: "한경관 학식",
      title: "한경관 학식을 먹지 않는 이유 조사",
      description: "한경관 학식을 현재 먹지 않는 학생의 이유를 조사합니다.",
      questions: [
        question("한경관 학식을 먹지 않는 가장 큰 이유는 무엇인가요?", "multiple"),
        question("한경관 학식을 먹어 볼 생각이 들려면 무엇이 바뀌어야 하나요?"),
        ...Array.from({ length: 5 }, (_, index) => question(`보조 문항 ${index + 1}`)),
      ],
    }),
  );
  assert.equal(evaluated.fatalFailures.some((item) => item.code === "NEGATION_LOST"), false);
  assert.equal(
    evaluated.fatalFailures.some((item) => item.code === "REQUIRED_CONCEPT_MISSING"),
    false,
  );
});

test("설명이나 질문이 아닌 최종 respondentGroup과 evaluationTarget을 의미 계약으로 검사한다", () => {
  const evaluated = evaluateSemanticResult(
    testCase("dev-complex-009"),
    result({
      finalRespondentGroup: "새봄대학교 재학생",
      finalEvaluationTarget: "에게 솔빛관을 오갈 때 느끼는 혼잡과 안전을 묻고 싶어",
      title: "솔빛관 이동 경험 조사",
      description: "새봄대학교 학생을 대상으로 솔빛관 이동을 조사합니다.",
      questions: [
        question("평소 솔빛관을 얼마나 자주 오가나요?"),
        question("솔빛관 이동 수단은 무엇인가요?"),
        question("솔빛관은 얼마나 혼잡한가요?"),
        question("솔빛관 이동은 안전한가요?"),
        question("불편한 점은 무엇인가요?", "multiple"),
        question("개선할 점은 무엇인가요?"),
        question("추가 의견을 적어주세요", "text"),
      ],
    }),
  );
  assert.ok(
    evaluated.fatalFailures.some((item) =>
      ["SURVEY_OBJECT_MISMATCH", "MALFORMED_SEMANTIC_PHRASE"].includes(item.code),
    ),
  );
});

test("후행 스크리너, 중복 불편 문항, 간접 만족 요소를 문항 구조 오류로 검출한다", () => {
  const evaluated = evaluateSemanticResult(
    testCase("dev-past-017"),
    result({
      classification: "partial_repair",
      finalRespondentGroup: "맛나샘을 이용하는 학생",
      finalEvaluationTarget: "맛나샘",
      title: "맛나샘 만족도 조사",
      description: "맛나샘 이용 학생의 만족도와 개선 의견을 조사합니다.",
      questions: [
        question("맛나샘에서 불편했던 점을 모두 골라주세요", "multiple"),
        question("맛나샘에서 만족스러웠던 점은 무엇인가요?", "multiple"),
        question("맛나샘을 이용하며 불편했던 점은 무엇인가요?", "multiple"),
        question("맛나샘에서 개선할 점은 무엇인가요?"),
        question("맛나샘을 이용한 적이 있나요?"),
        question("맛나샘을 얼마나 자주 이용하나요?"),
        question("추가 의견을 적어주세요", "text"),
      ],
    }),
  );
  const codes = new Set(evaluated.fatalFailures.map((item) => item.code));
  assert.equal(codes.has("MISPLACED_SCREENING_QUESTION"), true);
  assert.equal(codes.has("DUPLICATE_CONSTRUCT"), true);
  assert.equal(codes.has("OVERALL_SATISFACTION_MISSING"), true);
});

test("응답자 자격과 이용 자격을 연속으로 먼저 묻는 screening prefix는 허용한다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-noisy-002"),
    result({
      finalRespondentGroup: "최근 3개월 다온 앱을 쓴 대학생",
      finalEvaluationTarget: "다온 앱의 새 기능",
      title: "다온 앱 새 기능 만족도 조사",
      description: "최근 3개월 다온 앱을 쓴 대학생의 새 기능 만족도를 조사합니다.",
      questions: [
        question("현재 대학에 재학 중인가요?", "single", ["네", "아니요", "휴학 중"]),
        question("최근 3개월 안에 다온 앱을 사용한 적이 있나요?", "single", ["있어요", "없어요"]),
        question("최근 3개월 동안 다온 앱의 새 기능을 얼마나 자주 사용했나요?"),
        question("다온 앱의 새 기능에 전반적으로 얼마나 만족했나요?", "scale"),
        question("새 기능을 사용하기 쉬웠나요?"),
        question("새 기능에서 불편했던 점은 무엇인가요?", "multiple"),
        question("새 기능에서 가장 먼저 바뀌었으면 하는 점을 적어주세요", "text"),
      ],
    }),
  );

  assert.equal(
    evaluated.fatalFailures.some((item) => item.code === "MISPLACED_SCREENING_QUESTION"),
    false,
  );
});

test("조사 대상 메타데이터가 핵심 명사로 축약돼도 맥락과 질문이 완전하면 오탐하지 않는다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-clear-007"),
    result({
      finalRespondentGroup: "지난 6개월 온새미 플랫폼을 사용한 직장인",
      finalEvaluationTarget: "요금제",
      title: "온새미 플랫폼 요금제 만족도 조사",
      description: "지난 6개월 동안 플랫폼을 사용한 직장인의 의견을 조사합니다.",
      questions: [
        question("지난 6개월 동안 온새미 플랫폼을 사용한 적이 있나요?", "single", ["있음", "없음"]),
        question("온새미 플랫폼을 사용했을 당시 직장인이었나요?", "single", ["예", "아니요"]),
        question("지난 6개월 동안 온새미 플랫폼을 얼마나 자주 사용했나요?"),
        question("지난 6개월 동안 어떤 요금제를 사용했나요?"),
        question("온새미 플랫폼 요금제에 전반적으로 얼마나 만족했나요?", "scale"),
        question("온새미 플랫폼의 요금 수준에 얼마나 만족했나요?", "scale"),
        question("온새미 플랫폼 요금제에서 가장 먼저 바뀌었으면 하는 점은 무엇인가요?", "text"),
      ],
    }),
  );
  assert.equal(
    evaluated.fatalFailures.some((item) => item.code === "SURVEY_OBJECT_MISMATCH"),
    false,
  );
});

test("두 대상을 각각 측정하고 더 만족한 대상을 고르게 하면 비교 coverage로 인정한다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-control-003"),
    result({
      classification: "partial_repair",
      finalRespondentGroup: "별마루 카페 새 메뉴와 기존 메뉴 이용자",
      finalEvaluationTarget: "별마루 카페 새 메뉴·기존 메뉴",
      title: "별마루 카페 새 메뉴와 기존 메뉴 만족도 조사",
      description: "새 메뉴와 기존 메뉴의 만족도를 살펴봅니다.",
      questions: [
        question("별마루 카페의 새 메뉴와 기존 메뉴를 모두 먹어 본 적이 있나요?"),
        question("최근 한 달 동안 새 메뉴를 얼마나 자주 주문하나요?"),
        question("최근 한 달 동안 기존 메뉴를 얼마나 자주 주문하나요?"),
        question("새 메뉴에 전반적으로 얼마나 만족했나요?", "scale"),
        question("기존 메뉴에 전반적으로 얼마나 만족했나요?", "scale"),
        question("더 만족한 메뉴 유형을 고른 가장 큰 이유는 무엇인가요?", "multiple"),
        question("새 메뉴나 기존 메뉴에서 가장 먼저 바뀌었으면 하는 점은 무엇인가요?", "text"),
      ],
    }),
  );
  assert.equal(
    evaluated.fatalFailures.some(
      (item) =>
        item.code === "REQUIRED_QUESTION_CONCEPT_MISSING" &&
        item.message.includes("대상 비교"),
    ),
    false,
  );
  assert.equal(
    evaluated.fatalFailures.some(
      (item) =>
        item.code === "REQUIRED_PURPOSE_MISSING" &&
        item.message.includes("만족도 비교"),
    ),
    false,
  );
});

test("시설에 대한 전반적 인상은 인식 측정으로 인정한다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-noisy-006"),
    result({
      finalRespondentGroup: "최근 두 달 늘빛 체육관을 이용한 주민",
      finalEvaluationTarget: "늘빛 체육관",
      title: "늘빛 체육관 시설 인식 조사",
      description: "최근 두 달 시설 이용 주민의 인식을 조사합니다.",
      questions: [
        question("최근 두 달 동안 늘빛 체육관을 이용해 본 적이 있나요?"),
        question("최근 두 달 동안 늘빛 체육관을 몇 번 이용했나요?"),
        question("늘빛 체육관을 이용한 주된 목적은 무엇인가요?"),
        question("늘빛 체육관에 대해 전반적으로 어떤 인상을 받았나요?", "scale"),
        question("늘빛 체육관을 다시 이용할 가능성은 어느 정도인가요?", "scale"),
        question("늘빛 체육관에서 가장 먼저 개선됐으면 하는 점은 무엇인가요?"),
        question("늘빛 체육관에 관한 의견을 적어주세요", "text"),
      ],
    }),
  );

  assert.equal(
    evaluated.fatalFailures.some(
      (item) =>
        item.code === "REQUIRED_QUESTION_CONCEPT_MISSING" &&
        item.message.includes("인식"),
    ),
    false,
  );
});

test("명시적인 5점 단일선택 만족도 문항도 직접 만족도 측정으로 인정한다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-clear-004"),
    result({
      finalRespondentGroup: "최근 한 달 해든 매장에서 구매한 고객",
      finalEvaluationTarget: "신제품",
      title: "해든 매장 신제품 만족도 조사",
      description: "최근 구매 고객의 신제품 만족도를 살펴봅니다.",
      questions: [
        question("최근 한 달 안에 해든 매장에서 구매한 적이 있나요?"),
        question("최근 한 달 동안 해든 매장에서 얼마나 자주 구매했나요?"),
        question("최근 한 달 안에 해든 매장에서 신제품을 구매해 본 적이 있나요?"),
        question("구매한 신제품에 전반적으로 얼마나 만족했나요?", "single", [
          "매우 만족",
          "만족하는 편",
          "보통",
          "만족하지 않는 편",
          "전혀 만족하지 않음",
          "구매하지 않아 평가하기 어려움",
        ]),
        question("신제품의 가격은 어떻게 느껴졌나요?"),
        question("신제품 만족도에 가장 큰 영향을 준 것은 무엇인가요?"),
        question("신제품에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요", "text"),
      ],
    }),
  );
  assert.equal(
    evaluated.fatalFailures.some((item) => item.code === "OVERALL_SATISFACTION_MISSING"),
    false,
  );
});

test("두 대상의 단일선택 만족도와 직접 비교 문항을 모두 coverage로 인정한다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-control-003"),
    result({
      finalRespondentGroup: "별마루 카페 새 메뉴와 기존 메뉴 이용자",
      finalEvaluationTarget: "별마루 카페 새 메뉴·기존 메뉴",
      title: "별마루 카페 새 메뉴와 기존 메뉴 만족도 조사",
      description: "새 메뉴와 기존 메뉴의 만족도를 비교합니다.",
      questions: [
        question("별마루 카페에서 어떤 메뉴를 먹어 본 적이 있나요?"),
        question("새 메뉴를 고를 때 중요하게 생각한 점은 무엇인가요?"),
        question("기존 메뉴를 고를 때 중요하게 생각한 점은 무엇인가요?"),
        question("별마루 카페 새 메뉴에 전반적으로 얼마나 만족했나요?", "single", [
          "전혀 만족하지 않음", "만족하지 않는 편", "보통", "만족하는 편", "매우 만족",
        ]),
        question("별마루 카페 기존 메뉴에 전반적으로 얼마나 만족했나요?", "single", [
          "전혀 만족하지 않음", "만족하지 않는 편", "보통", "만족하는 편", "매우 만족",
        ]),
        question("새 메뉴와 기존 메뉴 중 어느 쪽이 더 만족스러웠나요?"),
        question("새 메뉴나 기존 메뉴에서 가장 먼저 바뀌었으면 하는 점은 무엇인가요?", "text"),
      ],
    }),
  );
  const codes = new Set(evaluated.fatalFailures.map((item) => item.code));
  assert.equal(codes.has("OVERALL_SATISFACTION_MISSING"), false);
  assert.equal(
    evaluated.fatalFailures.some(
      (item) =>
        item.code === "REQUIRED_QUESTION_CONCEPT_MISSING" &&
        item.message.includes("대상 비교"),
    ),
    false,
  );
});

test("비교 대상 하나가 질문에서 빠지면 비교 coverage를 통과시키지 않는다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-control-003"),
    result({
      finalRespondentGroup: "별마루 카페 새 메뉴와 기존 메뉴 이용자",
      finalEvaluationTarget: "별마루 카페 새 메뉴·기존 메뉴",
      title: "별마루 카페 새 메뉴 만족도 조사",
      description: "새 메뉴만 평가합니다.",
      questions: [
        question("새 메뉴를 먹어 본 적이 있나요?"),
        question("새 메뉴를 얼마나 자주 주문하나요?"),
        question("새 메뉴에 전반적으로 얼마나 만족했나요?", "scale"),
        question("새 메뉴의 맛은 어땠나요?"),
        question("새 메뉴의 가격은 어땠나요?"),
        question("새 메뉴에서 더 만족한 점은 무엇인가요?"),
        question("새 메뉴 개선 의견을 적어주세요", "text"),
      ],
    }),
  );
  assert.equal(
    evaluated.fatalFailures.some(
      (item) =>
        item.code === "REQUIRED_QUESTION_CONCEPT_MISSING" &&
        item.message.includes("대상 비교"),
    ),
    true,
  );
});

test("무관한 문장에 만족이라는 단어만 있어도 직접 만족도 측정으로 보지 않는다", () => {
  const evaluated = evaluateSemanticResult(
    frontedCase("fronted-clear-007"),
    result({
      finalRespondentGroup: "지난 6개월 온새미 플랫폼을 사용한 직장인",
      finalEvaluationTarget: "요금제",
      title: "온새미 플랫폼 요금제 조사",
      description: "요금제에 관한 조사입니다.",
      questions: [
        question("지난 6개월 동안 온새미 플랫폼을 사용한 적이 있나요?"),
        question("현재 직장인인가요?"),
        question("지난 6개월 동안 온새미 플랫폼을 얼마나 자주 사용했나요?"),
        question("사용한 요금제는 무엇인가요?"),
        question("‘만족’이라는 표현을 본 적이 있나요?", "scale"),
        question("요금제 이름을 적어주세요", "text"),
        question("추가 의견을 적어주세요", "text"),
      ],
    }),
  );
  assert.equal(
    evaluated.fatalFailures.some((item) => item.code === "OVERALL_SATISFACTION_MISSING"),
    true,
  );
});
