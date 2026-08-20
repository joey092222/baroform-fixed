import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RECURRING_REFERENCE_PERIOD,
  ensureVisibleReferencePeriod,
  hasVisibleReferencePeriod,
} from "../app/survey-reference-period";
import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
  type SurveyQuestion,
} from "../app/survey-intent";
import { repairInvalidQuestions } from "../app/survey-ai";
import { createSurveyPlan } from "../app/survey-planning";

const frequencyQuestion = (
  title: string,
  explicitTimeframe?: string | null,
): SurveyQuestion => ({
  id: 2,
  title,
  reason: "시설 이용 빈도를 측정함.",
  type: "single",
  options: ["이용하지 않음", "월 1~3회", "주 1~2회", "주 3회 이상"],
  required: true,
  measuredVariable: "솔빛관 이용 빈도",
  measuredConstruct: "이용 빈도",
  explicitTimeframe,
});

test("모델이 구조화 metadata로 선언한 기간을 질문에도 반영한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion("솔빛관을 얼마나 자주 이용하시나요?"),
    { modelReferencePeriod: "최근 한 달" },
  );

  assert.equal(result.explicitTimeframe, "최근 한 달");
  assert.equal(
    result.title,
    "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
  );
});

test("질문과 구조화 metadata의 기간이 일치하면 중복하지 않는다", () => {
  const title = "최근 한 달 동안 솔빛관을 얼마나 자주 이용하셨나요?";
  const result = ensureVisibleReferencePeriod(frequencyQuestion(title), {
    modelReferencePeriod: "최근 한 달",
  });

  assert.equal(result.title, title);
  assert.equal(result.explicitTimeframe, "최근 한 달");
  assert.equal(result.title.match(/최근 한 달/g)?.length, 1);
});

test("질문 문구에만 추가된 수치 기간은 안전한 기본 범위로 정규화한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion("최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?"),
  );

  assert.equal(result.explicitTimeframe, DEFAULT_RECURRING_REFERENCE_PERIOD);
  assert.equal(result.title, "평소 솔빛관을 얼마나 자주 이용하시나요?");
  assert.doesNotMatch(result.title, /최근 한 달/);
});

test("사용자가 지정한 기간이 모델 기간보다 우선한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion(
      "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
      "최근 한 달",
    ),
    {
      userExplicitTimeframe: "이번 학기",
      modelReferencePeriod: "최근 한 달",
    },
  );

  assert.equal(result.explicitTimeframe, "이번 학기");
  assert.equal(
    result.title,
    "이번 학기 동안 솔빛관을 얼마나 자주 이용하시나요?",
  );
  assert.doesNotMatch(result.title, /최근 한 달/);
});

test("한글 수사로 쓴 사용자 기간도 중복 없이 모델 기간보다 우선한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion(
      "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
      "최근 한 달",
    ),
    {
      userExplicitTimeframe: "최근 두 달",
      eligibilityTimeframe: "최근 두 달",
      modelReferencePeriod: "최근 한 달",
    },
  );

  assert.equal(result.explicitTimeframe, "최근 두 달");
  assert.equal(
    result.title,
    "최근 두 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
  );
  assert.equal(result.title.match(/최근 두 달/g)?.length, 1);
  assert.doesNotMatch(result.title, /최근 한 달/);
});

test("적격 조건의 기간은 모델과 기존 문항의 기간보다 우선한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion(
      "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
      "최근 한 달",
    ),
    {
      eligibilityTimeframe: "이번 학기",
      modelReferencePeriod: "최근 한 달",
      existingExplicitTimeframe: "최근 한 달",
    },
  );

  assert.equal(result.explicitTimeframe, "이번 학기");
  assert.equal(
    result.title,
    "이번 학기 동안 솔빛관을 얼마나 자주 이용하시나요?",
  );
});

test("기간이 없는 반복 이용 빈도에는 안전한 기본 기간을 결정적으로 적용한다", () => {
  const result = ensureVisibleReferencePeriod(
    frequencyQuestion("솔빛관을 얼마나 자주 이용하시나요?"),
  );

  assert.equal(result.explicitTimeframe, DEFAULT_RECURRING_REFERENCE_PERIOD);
  assert.equal(
    result.title,
    "평소 솔빛관을 얼마나 자주 이용하시나요?",
  );
});

test("동사가 활용된 반복 구매 빈도에도 기준 기간을 적용한다", () => {
  const sourceQuestion: SurveyQuestion = {
    id: 6,
    title: "계획하지 않았던 물건을 충동적으로 구매하는 빈도는 어느 정도인가요?",
    reason: "충동 구매 빈도를 측정함.",
    type: "single",
    options: ["전혀 없음", "드물게", "가끔", "자주"],
    required: true,
  };
  const result = ensureVisibleReferencePeriod(sourceQuestion);

  assert.equal(result.explicitTimeframe, DEFAULT_RECURRING_REFERENCE_PERIOD);
  assert.equal(
    result.title,
    "평소 계획하지 않았던 물건을 충동적으로 구매하는 빈도는 어느 정도인가요?",
  );
});

test("만족도 문항에는 기본 기간을 추가하지 않는다", () => {
  const question: SurveyQuestion = {
    id: 4,
    title: "솔빛관 이용 경험에 전반적으로 얼마나 만족하시나요?",
    reason: "만족도를 측정함.",
    type: "scale",
    required: true,
  };

  assert.deepEqual(ensureVisibleReferencePeriod(question), question);
});

test("일회성 행사 참여 문항에는 기본 기간을 추가하지 않는다", () => {
  const question: SurveyQuestion = {
    id: 1,
    title: "새봄축제에 참여하셨나요?",
    reason: "행사 참여 여부를 확인함.",
    type: "single",
    options: ["예", "아니요"],
    required: true,
  };

  assert.deepEqual(ensureVisibleReferencePeriod(question), question);
});

test("partial repair는 수정하지 않은 빈도 문항의 기간과 ID를 보존한다", () => {
  const prompt = "새봄대학교 학생들의 솔빛관 이용 경험과 개선 의견";
  const brief = parseSurveyBrief(prompt);
  const fallback = analyzeSurveyPrompt(prompt);
  const modelSurvey = {
    ...fallback,
    aiQuestions: fallback.aiQuestions.map((question, index) =>
      index === 0
        ? {
            ...question,
            title: "현재 새봄대학교 재학생인가요?",
            type: "single" as const,
            options: ["예", "아니요"],
          }
        : index === 1
          ? frequencyQuestion(
              "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
              "최근 한 달",
            )
          : question,
    ),
  };
  const repaired = repairInvalidQuestions({
    survey: modelSurvey,
    intent: brief.surveyIntent,
    plan: createSurveyPlan(brief.surveyIntent, 7),
    violations: [
      {
        code: "UNNECESSARY_SCREENING",
        severity: "repairable",
        message: "불필요한 재학생 적격성 문항",
        questionId: 1,
      },
    ],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [1]);
  assert.ok(repaired.preservedQuestionIds.includes(2));
  assert.equal(repaired.survey.aiQuestions[1]?.id, 2);
  assert.equal(
    repaired.survey.aiQuestions[1]?.title,
    "최근 한 달 동안 솔빛관을 얼마나 자주 이용하시나요?",
  );
  assert.equal(
    repaired.survey.aiQuestions[1]?.explicitTimeframe,
    "최근 한 달",
  );
});

test("기준 기간 metadata 충돌은 문항을 교체하지 않고 metadata만 맞춘다", () => {
  const prompt = "직장인의 문화생활 이용 빈도 조사";
  const brief = parseSurveyBrief(prompt);
  const fallback = analyzeSurveyPrompt(prompt);
  const originalQuestions = fallback.aiQuestions.map((question, index) =>
    index === 1
      ? frequencyQuestion(
          "최근 한 달 동안 문화생활을 얼마나 자주 하시나요?",
          "평소",
        )
      : { ...question },
  );
  let fallbackCalls = 0;

  const repaired = repairInvalidQuestions({
    survey: {
      ...fallback,
      templateQuestions: originalQuestions.slice(0, 5),
      aiQuestions: originalQuestions,
    },
    intent: brief.surveyIntent,
    plan: createSurveyPlan(brief.surveyIntent, 7),
    violations: [],
    qualityIssues: [
      "문항 2의 기준 기간 메타데이터와 질문 제목이 일치하지 않습니다.",
    ],
    getFallback: () => {
      fallbackCalls += 1;
      return fallback;
    },
  });

  assert.deepEqual(repaired.repairedQuestionIds, []);
  assert.ok(repaired.preservedQuestionIds.includes(2));
  assert.equal(fallbackCalls, 0);
  assert.equal(
    repaired.survey.aiQuestions[1]?.title,
    originalQuestions[1]?.title,
  );
  assert.equal(
    repaired.survey.aiQuestions[1]?.explicitTimeframe,
    "최근 한 달",
  );
  assert.deepEqual(
    repaired.survey.aiQuestions.filter((_, index) => index !== 1),
    originalQuestions.filter((_, index) => index !== 1),
  );
});

test("내부 관계 표식이 노출된 한 문항만 실제 변수 라벨로 교체한다", () => {
  const prompt =
    "직장인의 월 여가비와 문화생활 빈도 및 충동구매의 관계 조사";
  const brief = parseSurveyBrief(prompt);
  const fallback = analyzeSurveyPrompt(prompt);
  const originalQuestions = fallback.aiQuestions.map((item) => ({ ...item }));
  const leakedQuestions = originalQuestions.map((item, index) =>
    index === 3
      ? {
          ...item,
          title: "앞에서 답한 선행 값이 달라지는 상황을 모두 골라주세요.",
        }
      : item,
  );
  const leakedSurvey = {
    ...fallback,
    templateQuestions: leakedQuestions.slice(0, 5),
    aiQuestions: leakedQuestions,
  };
  const qualityIssues = validateSurvey(prompt, brief, leakedSurvey);

  assert.ok(
    qualityIssues.some((issue) =>
      issue.includes("문항 4에 내부 관계 분석 표식이 노출되었습니다"),
    ),
  );

  const repaired = repairInvalidQuestions({
    survey: leakedSurvey,
    intent: brief.surveyIntent,
    plan: createSurveyPlan(brief.surveyIntent, 7),
    violations: [],
    qualityIssues,
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [4]);
  assert.doesNotMatch(
    repaired.survey.aiQuestions[3]?.title ?? "",
    /선행\s*값|결과\s*값|독립\s*변수|종속\s*변수/,
  );
  assert.deepEqual(
    repaired.survey.aiQuestions.filter((_, index) => index !== 3),
    originalQuestions.filter((_, index) => index !== 3),
  );
});

test("대상과 행동이 없는 빈도 문항은 임의 보정하지 않고 기존 검증에서 거부한다", () => {
  const prompt = "시설 이용 경험 조사";
  const brief = parseSurveyBrief(prompt);
  const fallback = analyzeSurveyPrompt(prompt);
  const ambiguous: SurveyQuestion = {
    ...frequencyQuestion("이용 빈도는 어느 정도인가요?"),
    measuredVariable: undefined,
    measuredConstruct: undefined,
  };
  const result = ensureVisibleReferencePeriod(ambiguous);
  const blueprint = {
    ...fallback,
    aiQuestions: [result, ...fallback.aiQuestions.slice(1)],
  };

  assert.equal(result.title, "이용 빈도는 어느 정도인가요?");
  assert.equal(result.explicitTimeframe, undefined);
  assert.equal(hasVisibleReferencePeriod(result), false);
  assert.ok(
    validateSurvey(prompt, brief, blueprint).some((issue) =>
      issue.includes("이용 빈도에 기준 기간이 없습니다"),
    ),
  );
});

test("비이용 이유 문항을 빈도 문항으로 오인하지 않는다", () => {
  const question: SurveyQuestion = {
    id: 1,
    title: "맛나샘을 이용하지 않는 이유는 무엇인가요?",
    reason: "비이용 장벽을 파악함.",
    type: "multiple",
    options: ["가격", "거리", "메뉴", "운영 시간"],
    required: true,
  };

  assert.deepEqual(ensureVisibleReferencePeriod(question), question);
});
