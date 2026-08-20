import assert from "node:assert/strict";
import test from "node:test";

import {
  restoreMissingRequiredPlanBlocks,
} from "../app/survey-ai";
import {
  analyzeSurveyPrompt,
  type SurveyQuestion,
} from "../app/survey-intent";
import { parseSurveyIntent } from "../app/survey-semantic-intent";
import {
  compactSurveyPlanForPrompt,
  createSurveyPlan,
  evaluateSurveyPlanCoverage,
  inferExplicitUsageQuestionRole,
  questionCoversSurveyPlanBlock,
} from "../app/survey-planning";

const usagePrompt = "대학생의 네이버 웹툰 이용 경험을 조사하고 싶다";

function question(id: number, title: string): SurveyQuestion {
  return {
    id,
    title,
    reason: "해당 측정 변수를 확인함.",
    type: "single",
    options: ["예", "아니요"],
    required: true,
  };
}

test("플랫폼 이용 경험 설문은 이용 여부와 이용 빈도를 필수 plan block으로 분리한다", () => {
  const plan = createSurveyPlan(parseSurveyIntent(usagePrompt), 7);
  const required = plan.blocks
    .filter((block) => block.required)
    .map((block) => block.id);

  assert.equal(plan.intentKind, "service_product");
  assert.ok(required.includes("usage-status"));
  assert.ok(required.includes("usage-frequency"));
  assert.ok(plan.blocks.some((block) => block.id === "usage-time-context") === false);
  const compact = compactSurveyPlanForPrompt(plan);
  assert.equal(compact.blocks.find((block) => block.id === "usage-status")?.required, true);
});

test("이미 이용자로 제한된 만족도 설문은 이용 여부를 중복 요구하지 않는다", () => {
  const prompt = "네이버 웹툰을 이용 중인 대학생들의 만족도 조사";
  const plan = createSurveyPlan(parseSurveyIntent(prompt), 7);

  assert.equal(plan.targetPopulation, "네이버 웹툰을 이용 중인 대학생");
  assert.equal(plan.blocks.some((block) => block.id === "usage-status"), false);
  assert.equal(plan.blocks.some((block) => block.id === "usage-frequency"), false);
  assert.ok(plan.blocks.some((block) => /만족/.test(block.variable)));
});

test("명시된 이용 시간대와 선호 장르는 필수이고 일반 이용 빈도는 강제하지 않는다", () => {
  const prompt = "대학생의 네이버 웹툰 이용 시간대와 선호 장르 조사";
  const plan = createSurveyPlan(parseSurveyIntent(prompt), 7);
  const required = plan.blocks
    .filter((block) => block.required)
    .map((block) => block.id);

  assert.ok(required.includes("usage-time-context"));
  assert.ok(required.includes("usage-preferred-genre"));
  assert.equal(required.includes("usage-frequency"), false);
  assert.equal(required.includes("usage-status"), false);
});

test("시간대 문항은 이용 빈도 coverage를 충족하지 않으며 누락 블록만 복원한다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const originalTitles = [
    "현재 대학교 또는 대학원에 재학하거나 휴학 중이신가요?",
    "주로 언제 네이버웹툰을 보나요?",
    "주로 어떤 상황에서 네이버웹툰을 보나요?",
    "즐겨 보는 웹툰 장르는 무엇인가요?",
    "네이버웹툰 서비스 전반에 얼마나 만족하나요?",
    "네이버웹툰을 보면서 불편했던 점이 있나요?",
    "주변 대학생에게 네이버웹툰을 추천할 가능성은 어느 정도인가요?",
  ];
  const survey = {
    ...fallback,
    templateQuestions: originalTitles.slice(0, 5).map((title, index) =>
      question(index + 1, title),
    ),
    aiQuestions: originalTitles.map((title, index) => question(index + 1, title)),
    semanticPlan: plan,
  };

  const initial = evaluateSurveyPlanCoverage(plan, survey.aiQuestions);
  assert.deepEqual(initial.missingRequiredBlockIds, [
    "usage-status",
    "usage-frequency",
  ]);

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });
  const corpus = restored.survey.aiQuestions.map((item) => item.title).join(" ");

  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.match(corpus, /이용한 적|이용해 본/);
  assert.match(corpus, /얼마나 자주|이용 빈도/);
  assert.match(corpus, /만족/);
  assert.match(corpus, /불편/);
  assert.equal(restored.repairedQuestionIds.length, 2);
  assert.equal(restored.preservedQuestionIds.length, 5);
});

test("부분 복구 뒤 빈도 문항이 사라져도 최종 coverage 검사에서 되살린다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const questions = fallback.aiQuestions.slice(0, 7).map((item) => ({ ...item }));
  const frequencyIndex = questions.findIndex((item) => /얼마나 자주|이용 빈도/.test(item.title));
  assert.ok(frequencyIndex >= 0);
  questions[frequencyIndex] = question(
    questions[frequencyIndex]!.id,
    "주로 어느 시간대에 네이버웹툰을 보나요?",
  );
  const survey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    semanticPlan: plan,
  };

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });

  assert.deepEqual(restored.initialCoverage.missingRequiredBlockIds, [
    "usage-frequency",
  ]);
  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.match(
    restored.survey.aiQuestions.map((item) => item.title).join(" "),
    /얼마나 자주|이용 빈도/,
  );
});

test("빈도 metadata를 단 이용 여부 문항은 역할 불일치이며 coverage에 포함하지 않는다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const questions = fallback.aiQuestions.slice(0, 7).map((item) => ({ ...item }));
  const frequencyIndex = questions.findIndex((item) => /얼마나 자주|이용 빈도/.test(item.title));
  assert.ok(frequencyIndex >= 0);
  questions[frequencyIndex] = {
    ...question(questions[frequencyIndex]!.id, "네이버 웹툰을 이용한 적이 있나요?"),
    planBlockId: "usage-frequency",
    measuredVariable: "네이버 웹툰 이용 빈도",
  };
  const coverage = evaluateSurveyPlanCoverage(plan, questions);

  assert.equal(inferExplicitUsageQuestionRole(questions[frequencyIndex]!), "usage-status");
  assert.ok(coverage.missingRequiredBlockIds.includes("usage-frequency"));
  assert.ok(
    coverage.incompatibleQuestionIds.includes(String(questions[frequencyIndex]!.id)),
  );
});

test("의미가 같은 이용 여부 문항 하나를 누락된 빈도 문항으로 우선 교체한다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const titles = [
    "네이버 웹툰을 이용해 본 적이 있나요?",
    "네이버 웹툰을 이용한 적이 있나요?",
    "네이버 웹툰을 주로 언제 보나요?",
    "네이버 웹툰을 보는 이유는 무엇인가요?",
    "주로 어떤 장르의 웹툰을 보나요?",
    "네이버 웹툰 이용 경험에 얼마나 만족하나요?",
    "네이버 웹툰에서 불편한 점은 무엇인가요?",
  ];
  const questions = titles.map((title, index) => ({
    ...question(index + 1, title),
    ...(index === 1
      ? {
          planBlockId: "usage-frequency",
          measuredVariable: "네이버 웹툰 이용 빈도",
        }
      : {}),
  }));
  const survey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    semanticPlan: plan,
  };
  const initial = evaluateSurveyPlanCoverage(plan, questions);
  assert.deepEqual(initial.semanticDuplicateGroups, [["1", "2"]]);
  assert.ok(initial.missingRequiredBlockIds.includes("usage-frequency"));

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });
  const finalTitles = restored.survey.aiQuestions.map((item) => item.title);

  assert.deepEqual(restored.repairedQuestionIds, [2]);
  assert.deepEqual(restored.roleMismatchQuestionIds, ["2"]);
  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.deepEqual(restored.finalCoverage.semanticDuplicateGroups, []);
  assert.equal(
    finalTitles.filter((title) => /이용해?\s*본\s*적|이용한\s*적/.test(title)).length,
    1,
  );
  assert.equal(
    finalTitles.filter((title) => /얼마나\s*자주|이용\s*빈도/.test(title)).length,
    1,
  );
});

test("시간대 선택지는 선언 metadata가 빈도여도 usage-time-context로 분류한다", () => {
  const timeQuestion: SurveyQuestion = {
    ...question(3, "주로 언제 네이버 웹툰을 보나요?"),
    options: ["아침", "점심", "저녁", "취침 전"],
    planBlockId: "usage-frequency",
    measuredVariable: "네이버 웹툰 이용 빈도",
  };

  assert.equal(inferExplicitUsageQuestionRole(timeQuestion), "usage-time-context");
});

test("시설 인식 목적은 canonical purpose block에 연결되고 직접 인식 문항을 요구한다", () => {
  const prompt = "시설 인식은 늘빛 체육관을 최근 두 달 이용한 주민에게 조사해줘";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const perceptionBlock = plan.blocks.find((block) => /인식/u.test(block.variable));
  const perceptionPurpose = intent.purposeBlocks.find(
    (block) => block.kind === "attitude_perception",
  );

  assert.ok(perceptionPurpose);
  assert.ok(perceptionBlock);
  assert.equal(perceptionBlock.purposeBlockId, perceptionPurpose.id);
  assert.deepEqual(perceptionBlock.measuredEntityIds, perceptionBlock.sourceEntityIds);

  const satisfactionOnly = [
    "최근 두 달 동안 늘빛 체육관을 이용한 적이 있나요?",
    "최근 두 달 동안 늘빛 체육관을 얼마나 자주 이용했나요?",
    "늘빛 체육관을 주로 어떤 목적으로 이용하나요?",
    "늘빛 체육관 이용 경험에 전반적으로 얼마나 만족하나요?",
    "늘빛 체육관을 이용하기 얼마나 편리했나요?",
    "늘빛 체육관을 이용하며 불편했던 점은 무엇인가요?",
    "늘빛 체육관을 다시 이용할 의향은 어느 정도인가요?",
  ].map((title, index) => question(index + 1, title));
  const coverage = evaluateSurveyPlanCoverage(plan, satisfactionOnly);

  assert.ok(coverage.missingRequiredBlockIds.includes(perceptionBlock.id));
  assert.equal(
    satisfactionOnly.some((item) =>
      questionCoversSurveyPlanBlock(item, perceptionBlock),
    ),
    false,
  );
});

test("전반적으로 어떻게 느꼈는지 묻는 자연스러운 과거형도 시설 인식의 직접 측정이다", () => {
  const prompt = "시설 인식은 늘빛 체육관을 최근 두 달 이용한 주민에게 조사해줘";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const perceptionBlock = plan.blocks.find((block) => /인식/u.test(block.variable));
  assert.ok(perceptionBlock);

  const naturalPastTenseQuestion = question(
    4,
    "가장 최근 늘빛 체육관 이용 경험을 기준으로, 전반적으로 어떻게 느꼈나요?",
  );
  assert.equal(
    questionCoversSurveyPlanBlock(naturalPastTenseQuestion, perceptionBlock),
    true,
  );
});

test("누락된 시설 인식 문항은 fallback의 직접 인상 문항으로 복원한다", () => {
  const prompt = "시설 인식은 늘빛 체육관을 최근 두 달 이용한 주민에게 조사해줘";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(prompt);
  const titles = [
    "최근 두 달 동안 늘빛 체육관을 이용한 적이 있나요?",
    "최근 두 달 동안 늘빛 체육관을 얼마나 자주 이용했나요?",
    "늘빛 체육관을 주로 어떤 목적으로 이용하나요?",
    "늘빛 체육관 이용 경험에 전반적으로 얼마나 만족하나요?",
    "늘빛 체육관을 이용하기 얼마나 편리했나요?",
    "늘빛 체육관을 이용하며 불편했던 점은 무엇인가요?",
    "늘빛 체육관을 다시 이용할 의향은 어느 정도인가요?",
  ];
  const questions = titles.map((title, index) => ({
    ...question(index + 1, title),
    ...(index === 1
      ? {
          options: [
            "최근 두 달 동안 이용하지 않음",
            "1회",
            "2~3회",
            "4회 이상",
          ],
        }
      : {}),
  }));
  const survey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    semanticPlan: plan,
  };

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });
  const finalTitles = restored.survey.aiQuestions.map((item) => item.title);

  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.equal(restored.repairedQuestionIds.length, 1);
  assert.equal(restored.repairedQuestionIds.includes(1), false);
  assert.equal(restored.repairedQuestionIds.includes(2), false);
  assert.equal(
    finalTitles[0],
    "최근 두 달 동안 늘빛 체육관을 이용한 적이 있나요?",
  );
  assert.equal(
    finalTitles[1],
    "최근 두 달 동안 늘빛 체육관을 얼마나 자주 이용했나요?",
  );
  assert.ok(
    finalTitles.some((title) =>
      /전반적으로.*(?:인상|인식)|어떤\s*인상/u.test(title),
    ),
  );
});

test("명시된 비이용 응답 조건의 선별 문항이 없으면 문항 수를 유지하며 첫 문항으로 복원한다", () => {
  const prompt = "별숲앱 안쓰는 자영업자 왜안씀 앞으로쓸지 조사";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(prompt);
  const questions = [
    "별숲앱을 사용하지 않는 이유는 무엇인가요?",
    "별숲앱을 알게 된 경로는 무엇인가요?",
    "별숲앱 대신 사용하는 서비스가 있나요?",
    "서비스 선택에서 가장 중요한 기준은 무엇인가요?",
    "앞으로 별숲앱을 사용해 볼 생각이 있나요?",
    "사용을 고려하게 할 변화는 무엇인가요?",
    "추가 의견을 적어주세요.",
  ].map((title, index) => question(index + 1, title));
  const survey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    semanticPlan: plan,
  };

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });

  assert.equal(restored.survey.aiQuestions.length, 7);
  assert.match(restored.survey.aiQuestions[0]?.title ?? "", /별숲앱.*이용하지 않는 자영업자.*해당/u);
  assert.equal(restored.survey.aiQuestions[0]?.measuredRole, "eligibility");
  assert.equal(restored.survey.aiQuestions[0]?.planBlockId, "eligibility-screening");
});

test("숫자형 단일선택 척도의 직접 전반 만족도 문항은 중복 복원하지 않는다", () => {
  const prompt = "한들식당 이용자의 맛, 주문 편의, 직원 응대와 전체 만족도 조사";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const overallBlock = plan.blocks.find((block) => block.id === "overall-satisfaction");
  assert.ok(overallBlock);

  const directOverall = {
    ...question(1, "한들식당에 전반적으로 얼마나 만족하나요?"),
    type: "single" as const,
    options: ["1", "2", "3", "4", "5"],
  };
  assert.equal(questionCoversSurveyPlanBlock(directOverall, overallBlock), true);
});

test("구체적인 안전 지식·중요도 질문은 일반 인식 블록을 직접 측정한다", () => {
  const prompt = "새빛대학교 환경공학과 학생의 실험실 안전 인식과 개선 요구 조사";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const perceptionBlock = plan.blocks.find(
    (block) => /^인식$/u.test(block.variable) && block.purposeBlockId,
  );
  assert.ok(perceptionBlock);

  assert.equal(
    questionCoversSurveyPlanBlock(
      question(1, "실험실 안전수칙을 얼마나 잘 알고 있다고 생각하나요?"),
      perceptionBlock,
    ),
    true,
  );
  assert.equal(
    questionCoversSurveyPlanBlock(
      question(2, "실험실 안전은 얼마나 중요하다고 생각하나요?"),
      perceptionBlock,
    ),
    true,
  );
});

test("이동 fallback 문항의 계획 메타데이터는 실제 질문 의미와 일치한다", () => {
  const fallback = analyzeSurveyPrompt("다온대학교 학생의 통학 불편 조사");
  const byId = new Map(fallback.aiQuestions.map((item) => [item.id, item]));

  assert.match(byId.get(2)?.measuredVariable ?? "", /이동 수단/u);
  assert.match(byId.get(3)?.measuredVariable ?? "", /소요 시간/u);
  assert.match(byId.get(4)?.measuredVariable ?? "", /혼잡/u);
  assert.match(byId.get(5)?.measuredVariable ?? "", /안전/u);
});

test("명시된 이동 불편은 세부 이동 지표와 별도의 필수 계획 블록으로 검증한다", () => {
  const prompt = "다온대학교 학생의 통학 불편 조사";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const painBlock = plan.blocks.find(
    (block) =>
      block.required &&
      block.directlyAskable &&
      /(?:불편|어려움|문제|장벽)/u.test(block.variable),
  );
  assert.ok(painBlock);

  const indirectOnly = [
    question(1, "일주일에 며칠 통학하나요?"),
    question(2, "주로 어떤 수단으로 통학하나요?"),
    question(3, "편도 이동에는 얼마나 걸리나요?"),
    question(4, "이동 경로는 얼마나 혼잡하나요?"),
    question(5, "이동 경로는 얼마나 안전하다고 느끼나요?"),
    question(6, "가장 먼저 개선되었으면 하는 점은 무엇인가요?"),
    question(7, "추가 의견을 적어주세요."),
  ];
  const missing = evaluateSurveyPlanCoverage(plan, indirectOnly);
  assert.ok(missing.missingRequiredBlockIds.includes(painBlock.id));

  const direct = [...indirectOnly];
  direct[5] = question(6, "통학 과정에서 가장 불편한 점은 무엇인가요?");
  const covered = evaluateSurveyPlanCoverage(plan, direct);
  assert.equal(covered.missingRequiredBlockIds.includes(painBlock.id), false);
});
