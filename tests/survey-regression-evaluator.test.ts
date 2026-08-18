import assert from "node:assert/strict";
import test from "node:test";

import { devCases, holdoutCases } from "../evals/survey-regression/v1/dataset-source";
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
