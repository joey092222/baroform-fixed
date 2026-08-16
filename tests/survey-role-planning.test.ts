import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import {
  parseSurveyIntent,
  validateSurveyIntentCandidate,
} from "../app/survey-semantic-intent";
import { createSurveyPlan } from "../app/survey-planning";

const mainPrompt =
  "연세대 학생들의 소비 품목에 대해 조사하고, 이를 바탕으로 신촌 근처에 어떤 매장을 개설하면 좋을지에 대해 조사하고 싶어";

const corpus = (questions: Array<{ title: string; options?: string[] }>) =>
  questions.flatMap((item) => [item.title, ...(item.options ?? [])]).join(" ");

async function generateLocalRoute(prompt: string) {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-role-planning-regression",
        },
        body: JSON.stringify({
          prompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = await response.json() as {
      status?: string;
      blueprint?: ReturnType<typeof analyzeSurveyPrompt>;
      error?: string;
    };
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.ok(body.blueprint);
    return body.blueprint;
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

test("실제 생성 route는 소비 행동부터 신촌 매장 의사결정까지 7문항으로 연결한다", async () => {
  const intent = parseSurveyIntent(mainPrompt);
  const plan = createSurveyPlan(intent, 7);
  const blueprint = await generateLocalRoute(mainPrompt);
  const text = corpus(blueprint.aiQuestions);
  const roles = new Set(plan.blocks.map((block) => block.role));

  assert.equal(intent.targetPopulation, "연세대 학생");
  assert.equal(intent.objectKind, "decision_support");
  assert.ok(intent.entities.some((item) => item.role === "category_set"));
  assert.deepEqual(intent.contexts.map((item) => item.text), ["신촌 근처"]);
  assert.equal(intent.decisionGoals.length, 1);
  assert.ok(intent.relations.some((item) => item.type === "evidence_for"));
  assert.equal(blueprint.aiQuestions.length, 7);
  assert.ok(roles.has("category_set"));
  assert.ok(roles.has("behavior"));
  assert.ok(roles.has("unmet_need"));
  assert.ok(roles.has("decision_option"));
  assert.match(text, /구매|지출/);
  assert.match(text, /신촌 근처/);
  assert.match(text, /구하기 어렵|선택지가 부족/);
  assert.match(text, /매장 종류/);
  assert.match(text, /얼마나 자주 이용/);
  assert.doesNotMatch(text, /소비 품목.*현재 얼마나 관련/);
  assert.doesNotMatch(text, /직접 경험 중|과거에 경험함|알고 있지만 경험 없음/);
  assert.doesNotMatch(text, /소비 품목.*전반적으로.*평가/);
  assert.doesNotMatch(text, /최근\s*(?:1|3|6)개월/);
  assert.ok(
    blueprint.aiQuestions.every(
      (item) => item.planBlockId && item.measuredVariable && item.questionPurpose,
    ),
  );
});

test("명사구 역할 A-H는 제품 만족도 편향 없이 분류된다", () => {
  const cases = [
    {
      prompt: "대학생들이 주로 어떤 소비 품목에 돈을 쓰는지 조사하고 싶어요",
      kind: "category_set",
      requiredRole: "category_set",
      allowEvaluation: false,
    },
    {
      prompt: "전 연령대 AI 사용능력 실태조사",
      kind: "ability_skill",
      requiredRole: "ability",
      allowEvaluation: false,
    },
    {
      prompt: "대학생들의 네이버 웹툰 이용 현황과 불편 사항 조사",
      kind: "service_product",
      requiredRole: "product_or_service",
      allowEvaluation: true,
    },
    {
      prompt: "대학생들이 과제를 위해 온라인 설문을 제작하고 배포할 때 겪는 어려움",
      kind: "behavior_usage",
      requiredRole: "survey_instrument",
      allowEvaluation: false,
    },
    {
      prompt: "AI를 사용해 본 적이 없는 사람까지 포함한 전 연령대 AI 인식 조사",
      kind: "attitude_perception",
      requiredRole: "attitude",
      allowEvaluation: false,
    },
    {
      prompt: "연세대 학생들이 신촌에 새로 생기길 원하는 시설이나 매장을 조사하고 싶어요",
      kind: "decision_support",
      requiredRole: "decision_option",
      allowEvaluation: false,
    },
    {
      prompt: "직장인들의 재택근무 빈도와 그 과정에서 겪는 어려움을 조사하고 싶어요",
      kind: "behavior_usage",
      requiredRole: "activity",
      allowEvaluation: false,
    },
    {
      prompt: "카페 신메뉴를 먹어본 고객의 만족도 조사",
      kind: "satisfaction_evaluation",
      requiredRole: "real_world_object",
      allowEvaluation: true,
    },
  ] as const;

  for (const item of cases) {
    const intent = parseSurveyIntent(item.prompt);
    const blueprint = analyzeSurveyPrompt(item.prompt);
    const text = corpus(blueprint.aiQuestions);
    assert.equal(intent.objectKind, item.kind, item.prompt);
    assert.ok(
      intent.entities.some((entity) => entity.role === item.requiredRole),
      `${item.prompt}: ${item.requiredRole}`,
    );
    assert.doesNotMatch(text, /(?:조사|연구)(?:를|을) (?:사용|이용|구매)/, item.prompt);
    if (!item.allowEvaluation) {
      assert.doesNotMatch(text, /현재 얼마나 관련이 있/, item.prompt);
    }
  }

  const activityIntent = parseSurveyIntent(cases[3].prompt);
  assert.deepEqual(
    new Set(activityIntent.activities.map((item) => item.activityKind)),
    new Set(["create", "distribute"]),
  );
  const perceptionIntent = parseSurveyIntent(cases[4].prompt);
  assert.equal(perceptionIntent.includesNonUsers, true);
  const satisfactionIntent = parseSurveyIntent(cases[7].prompt);
  assert.equal(satisfactionIntent.screeningRequired, true);
});

test("소비·매장·연결 표현 동의어 30개가 같은 역할 구조를 유지한다", () => {
  const categories = [
    "소비 품목",
    "구매 항목",
    "지출 항목",
    "주요 소비 분야",
    "돈을 쓰는 분야",
    "구매하는 제품 종류",
  ];
  const decisions = ["매장", "가게", "점포", "상점", "시설", "업종"];
  const connectors = [
    "이를 바탕으로",
    "그 결과를 활용해",
    "이를 근거로",
    "분석 결과에 따라",
    "조사한 뒤",
  ];

  for (let index = 0; index < 30; index += 1) {
    const prompt = `연세대 학생들의 ${categories[index % categories.length]}을 조사하고 ${connectors[index % connectors.length]} 신촌에 필요한 ${decisions[index % decisions.length]} 종류를 알아보고 싶어요`;
    const intent = parseSurveyIntent(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);
    const roles = new Set(intent.entities.map((item) => item.role));
    const text = corpus(blueprint.aiQuestions);
    assert.equal(intent.objectKind, "decision_support", prompt);
    assert.ok(roles.has("category_set"), prompt);
    assert.ok(roles.has("unmet_need"), prompt);
    assert.ok(roles.has("decision_option"), prompt);
    assert.equal(intent.decisionGoals.length, 1, prompt);
    assert.match(text, /부족|구하기 어렵|충족되지/);
    assert.match(text, /얼마나 자주 이용/);
    assert.doesNotMatch(text, /현재 얼마나 관련이 있|전반적으로 어떻게 평가/);
  }
});

test("복수 목적 입력은 현황·미충족 수요·대안·이용 의향을 모두 보존한다", () => {
  const prompts = [
    "대학생의 배달 음식 이용 패턴을 조사하고, 이를 바탕으로 학교 주변에 필요한 음식점을 알아보고 싶어요",
    "직장인의 출퇴근 불편을 파악하고, 그 결과를 토대로 필요한 교통 서비스를 조사하고 싶어요",
    "학생들의 공부 공간 이용 현황을 분석한 뒤 학교 주변에 어떤 스터디 공간을 만들면 좋을지 알고 싶어요",
    "자취생들의 생활용품 구매 습관을 조사하고 이를 근거로 대학가에 필요한 매장을 선정하고 싶어요",
  ];
  for (const prompt of prompts) {
    const intent = parseSurveyIntent(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);
    const text = corpus(blueprint.aiQuestions);
    const roles = new Set(blueprint.aiQuestions.map((item) => item.measuredRole));
    assert.equal(intent.objectKind, "decision_support", prompt);
    assert.equal(intent.decisionGoals.length, 1, prompt);
    assert.ok(intent.relations.some((item) => item.type === "evidence_for"), prompt);
    assert.ok(roles.has("behavior") || /빈도|얼마나 자주/.test(text), prompt);
    assert.ok(roles.has("unmet_need") || /불편|충족되지/.test(text), prompt);
    assert.ok(roles.has("decision_option") || /필요한|원하는/.test(text), prompt);
    assert.match(text, /우선|가장 필요|얼마나 자주 이용/);
  }
});

test("의미 검증기는 범주를 제품처럼 취급한 문항만 역할 오류로 막는다", () => {
  const intent = parseSurveyIntent(mainPrompt);
  const valid = analyzeSurveyPrompt(mainPrompt);
  assert.deepEqual(
    validateSurveyIntentCandidate(intent, {
      title: valid.title,
      description: valid.description,
      questions: valid.aiQuestions,
    }),
    [],
  );

  const violations = validateSurveyIntentCandidate(intent, {
    questions: [
      { id: 1, title: "소비 품목과 현재 얼마나 관련이 있습니까?" },
      { id: 2, title: "소비 품목을 직접 경험 중입니까?" },
      { id: 3, title: "소비 품목에 대해 전반적으로 어떻게 평가합니까?" },
    ],
  });
  const codes = new Set(violations.map((item) => item.code));
  assert.ok(codes.has("ABSTRACT_CATEGORY_TREATED_AS_PRODUCT"));
  assert.ok(codes.has("INVALID_VERB_OBJECT_RELATION"));
  assert.ok(codes.has("GENERIC_TEMPLATE_ROLE_MISMATCH"));
  assert.ok(codes.has("DECISION_GOAL_DROPPED"));
});

test("64개 조합형 입력은 예외·무한 재생성·의미 없는 관련성 폴백 없이 끝난다", () => {
  const targets = [
    "대학생",
    "연세대학교 학생",
    "직장인",
    "자취생",
    "전 연령대",
    "앱 이용자",
    "지역 주민",
    "학부모",
  ];
  const variables = [
    "소비 품목",
    "AI 사용능력",
    "온라인 설문 제작",
    "배달 앱",
    "재택근무",
    "수업 만족도",
    "통학 불편",
    "공부 공간",
    "취미 활동",
    "정보 획득 경로",
    "시설 수요",
    "매장 선호",
  ];
  const purposes = [
    "현황 파악",
    "빈도 조사",
    "만족도 분석",
    "불편 조사",
    "미충족 수요 파악",
    "선호 비교",
    "신규 서비스 결정",
    "시설 개설 결정",
  ];
  const endings = [
    "조사하고 싶어요",
    "알아보고 싶어요",
    "파악하고 싶어요",
    "분석하고 싶어요",
    "비교하고 싶어요",
  ];

  for (let index = 0; index < 64; index += 1) {
    const prompt = `${targets[index % targets.length]}의 ${variables[index % variables.length]} ${purposes[index % purposes.length]}를 ${endings[index % endings.length]}`;
    const intent = parseSurveyIntent(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);
    const text = corpus(blueprint.aiQuestions);
    assert.ok(intent.entities.length > 0, prompt);
    assert.ok(blueprint.aiQuestions.length >= 5, prompt);
    assert.ok(blueprint.aiQuestions.every((item) => item.title.trim().length > 0), prompt);
    assert.doesNotMatch(text, /현재 얼마나 관련이 있나요/);
  }
});
