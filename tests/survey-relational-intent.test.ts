import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import {
  parseSurveyIntent,
  validateSurveyIntentCandidate,
} from "../app/survey-semantic-intent";
import {
  hasRelationalResearchIntent,
  parseSurveyResearchIntent,
} from "../app/survey-research-intent";
import { createSurveyPlan } from "../app/survey-planning";
import { repairInvalidQuestions } from "../app/survey-ai";

const forbiddenGeneric =
  /실제로 경험하거나 선택한 구체적인 대상을 적어주세요|추상적인 조사 주제를 응답자가 답할 수 있는 구체적인 대상으로 확인함|현재 얼마나 관련이 있나요|직접 경험 중|과거에 경험함|알고 있지만 경험 없음|주제에 대한 전체 평가를 공통 척도로 확인함/;

const questionCorpus = (prompt: string) =>
  analyzeSurveyPrompt(prompt).aiQuestions
    .flatMap((item) => [item.title, item.reason, ...(item.options ?? [])])
    .join(" ");

test("통학 시간과 자취 비율은 응답자 변수·관계·집계 지표로 분해된다", () => {
  const prompt =
    "연세대학교 학생들의 통학 시간과 그에 따른 학생들의 자취 비율에 대해 조사해줘";
  const intent = parseSurveyIntent(prompt);
  const research = intent.researchIntent;
  const blueprint = analyzeSurveyPrompt(prompt);
  const plan = createSurveyPlan(intent, 7);
  const corpus = questionCorpus(prompt);

  assert.equal(intent.targetPopulation, "연세대학교 학생");
  assert.equal(hasRelationalResearchIntent(research), true);
  assert.ok(
    research.variables.some(
      (item) =>
        item.name === "통학 시간" &&
        item.scope === "respondent_level" &&
        item.measurementLevel === "numeric",
    ),
  );
  assert.ok(
    research.variables.some(
      (item) =>
        item.name === "현재 거주 형태" && item.scope === "respondent_level",
    ),
  );
  assert.ok(
    research.variables.some(
      (item) => item.name === "자취 여부" && item.scope === "respondent_level",
    ),
  );
  assert.deepEqual(
    research.derivedMetrics.map((item) => [item.name, item.metricType]),
    [["자취 비율", "proportion"]],
  );
  assert.equal(research.relations[0]?.type, "group_comparison");
  assert.match(research.analysisGoals[0]?.description ?? "", /통학 시간 구간별 자취 비율 비교/);
  assert.equal(blueprint.title, "연세대학교 학생의 통학 시간과 현재 거주 형태 조사");
  assert.match(blueprint.description, /통학 시간.*현재 거주 형태.*자취 비율/);
  assert.deepEqual(
    blueprint.aiQuestions.map((item) => item.title),
    [
      "현재 거주 형태를 알려주세요.",
      "현재 거주지에서 학교까지 편도로 얼마나 걸리나요?",
      "주로 이용하는 통학 수단을 알려주세요.",
      "본가에서 학교까지 통학한다면 편도로 얼마나 걸릴 것으로 예상하나요?",
      "통학 시간이 현재 거주 형태를 선택하는 데 어느 정도 영향을 주었나요?",
      "현재 거주 형태를 선택한 주된 이유를 모두 골라주세요.",
      "통학 부담을 줄이기 위해 가장 필요한 지원이 있다면 적어주세요.",
    ],
  );
  assert.ok(plan.blocks.every((item) => item.analysisUsage));
  assert.doesNotMatch(corpus, forbiddenGeneric);
  assert.doesNotMatch(corpus, /학생들의 자취 비율은 몇|자취 비율은 얼마|자취 비율.*퍼센트/);
  assert.deepEqual(validateSurvey(prompt, parseSurveyBrief(prompt), blueprint), []);
});

test("관계형 필수 사례 8개는 각 기초 변수를 측정하고 집계 지표를 직접 묻지 않는다", () => {
  const cases = [
    {
      prompt: "대학생들의 공부 시간과 성적의 관계를 조사하고 싶어요",
      expected: [/공부.*시간/, /성적/],
      forbidden: /공부 시간과 성적.*구체적인 대상/,
    },
    {
      prompt: "연령대별 AI 사용률을 조사해줘",
      expected: [/연령대/, /AI.*사용한 적/],
      forbidden: /AI 사용률.*(?:얼마|퍼센트|추측)/,
    },
    {
      prompt: "운동 빈도에 따른 수면의 질 차이를 조사하고 싶어요",
      expected: [/운동.*자주/, /수면의 질/],
      forbidden: /운동 빈도와 수면의 질.*구체적인 대상/,
    },
    {
      prompt: "직장인의 근무 시간과 이직 의향의 관계",
      expected: [/근무 시간/, /이직.*고려/],
      forbidden: /조사 제목.*평가/,
    },
    {
      prompt: "지역별 배달앱 이용률 조사",
      expected: [/거주.*지역/, /배달 앱.*이용한 적/],
      forbidden: /지역.*이용률.*(?:얼마|추측)/,
    },
    {
      prompt: "학년별 동아리 참여 비율 조사",
      expected: [/학년/, /동아리.*참여/],
      forbidden: /참여 비율.*(?:얼마|퍼센트|추측)/,
    },
    {
      prompt: "네이버 웹툰 이용 빈도에 따른 만족도 차이",
      expected: [/네이버 웹툰.*자주 이용/, /만족/],
      forbidden: /네이버 웹툰 이용 빈도와 만족도.*구체적인 대상/,
    },
    {
      prompt: "연세대학교 학생들의 통학 시간과 그에 따른 학생들의 자취 비율에 대해 조사해줘",
      expected: [/편도로 얼마나/, /거주 형태/],
      forbidden: /자취 비율.*(?:얼마|퍼센트|추측)/,
    },
  ];

  for (const item of cases) {
    const intent = parseSurveyIntent(item.prompt);
    const blueprint = analyzeSurveyPrompt(item.prompt);
    const corpus = questionCorpus(item.prompt);
    assert.equal(hasRelationalResearchIntent(intent.researchIntent), true, item.prompt);
    assert.ok(intent.researchIntent.variables.length >= 2, item.prompt);
    assert.ok(intent.researchIntent.relations.length >= 1, item.prompt);
    for (const expected of item.expected) assert.match(corpus, expected, item.prompt);
    assert.doesNotMatch(corpus, item.forbidden, item.prompt);
    assert.doesNotMatch(corpus, forbiddenGeneric, item.prompt);
    assert.deepEqual(
      validateSurvey(item.prompt, parseSurveyBrief(item.prompt), blueprint),
      [],
      item.prompt,
    );
  }
});

test("의미 검증기는 generic 구체화·직접 집계 질문·불완전 제목을 구분해 차단한다", () => {
  const prompt =
    "연세대학교 학생들의 통학 시간과 그에 따른 학생들의 자취 비율에 대해 조사해줘";
  const intent = parseSurveyIntent(prompt);
  const violations = validateSurveyIntentCandidate(intent, {
    title: "연세대학교 학생 통학에 걸리는",
    description:
      "경험과 평가, 중요 요소 및 개선 의견을 파악하는 익명 설문입니다.",
    questions: [
      {
        id: 1,
        title:
          "통학 시간과 자취 비율에서 실제로 경험하거나 선택한 구체적인 대상을 적어주세요.",
      },
      { id: 2, title: "학생들의 자취 비율은 몇 퍼센트라고 생각하나요?" },
    ],
  });
  const codes = new Set(violations.map((item) => item.code));
  assert.ok(codes.has("GENERIC_CONCRETIZATION_FALLBACK_USED"));
  assert.ok(codes.has("MEASURABLE_VARIABLE_MISCLASSIFIED_AS_ABSTRACT"));
  assert.ok(codes.has("DERIVED_METRIC_ASKED_DIRECTLY"));
  assert.ok(codes.has("VARIABLE_COVERAGE_MISSING"));
  assert.ok(codes.has("MULTI_VARIABLE_INTENT_FLATTENED"));
  assert.ok(codes.has("ANALYSIS_GOAL_NOT_SUPPORTED"));
  assert.ok(codes.has("INCOMPLETE_SURVEY_TITLE"));
  assert.ok(codes.has("GENERIC_DESCRIPTION_MISMATCH"));
});

test("56개 관계 표현 조합은 topic 평탄화·집계 직접 질문·generic fallback 없이 설계된다", () => {
  const predictors = [
    "연령대",
    "학년",
    "통학 시간",
    "통학 거리",
    "공부 시간",
    "운동 빈도",
    "이용 빈도",
    "소득 구간",
    "거주 지역",
    "근무 시간",
  ];
  const outcomes = [
    "자취 비율",
    "AI 사용률",
    "만족도",
    "수면의 질",
    "성적",
    "지각 빈도",
    "구매 금액",
    "이직 의향",
    "동아리 참여 비율",
    "스트레스 수준",
  ];
  const expressions = [
    (left: string, right: string) => `${left}에 따른 ${right}`,
    (left: string, right: string) => `${left}별 ${right}`,
    (left: string, right: string) => `${left}과 ${right}의 관계`,
    (left: string, right: string) => `${left}이 ${right}에 미치는 영향`,
    (left: string, right: string) => `${left}에 따라 달라지는 ${right}`,
    (left: string, right: string) => `${left}과 ${right} 간 차이`,
    (left: string, right: string) => `${left}일수록 ${right}`,
  ];

  for (let index = 0; index < 56; index += 1) {
    const left = predictors[index % predictors.length];
    const right = outcomes[(index * 3) % outcomes.length];
    const prompt = `${expressions[index % expressions.length](left, right)} 조사`;
    const research = parseSurveyResearchIntent(prompt);
    const intent = parseSurveyIntent(prompt);
    const plan = createSurveyPlan(intent, 7);
    const blueprint = analyzeSurveyPrompt(prompt);
    const corpus = questionCorpus(prompt);
    const respondentVariables = research.variables.filter(
      (item) => item.scope === "respondent_level" && item.directlyAskable,
    );

    assert.equal(hasRelationalResearchIntent(research), true, prompt);
    assert.ok(respondentVariables.length >= 2, prompt);
    assert.ok(research.relations.length >= 1, prompt);
    assert.ok(plan.blocks.length >= 2, prompt);
    assert.equal(blueprint.aiQuestions.length, 7, prompt);
    assert.doesNotMatch(corpus, forbiddenGeneric, prompt);
    assert.doesNotMatch(
      corpus,
      /(?:비율|사용률|이용률|참여율).*(?:몇\s*(?:퍼센트|%)|얼마|추측)/,
      prompt,
    );
    assert.deepEqual(
      validateSurvey(prompt, parseSurveyBrief(prompt), blueprint),
      [],
      prompt,
    );
  }
});

test("실제 API route의 모델 없는 경로도 관계형 설문을 200으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-relational-regression",
        },
        body: JSON.stringify({
          prompt:
            "연세대학교 학생들의 통학 시간과 그에 따른 학생들의 자취 비율에 대해 조사해줘",
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      blueprint?: ReturnType<typeof analyzeSurveyPrompt>;
    };
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-baroform-model-calls"), "0");
    assert.equal(response.headers.get("x-baroform-regeneration-count"), "0");
    assert.equal(body.blueprint?.aiQuestions.length, 7);
    assert.doesNotMatch(
      body.blueprint?.aiQuestions.map((item) => item.title).join(" ") ?? "",
      forbiddenGeneric,
    );
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

const sleepTardinessPrompt =
  "대학생들의 평소 수업이 있는 날 하루 수면 시간과 이번 학기 지각 횟수의 관계를 조사해줘";

test("수면 시간·지각 횟수 계획은 측정 문항과 비문항 분석 블록을 분리한다", () => {
  const intent = parseSurveyIntent(sleepTardinessPrompt);
  const plan = createSurveyPlan(intent, 7);
  const measurementBlocks = plan.blocks.filter((item) => item.kind === "measurement");
  const analysisBlocks = plan.blocks.filter((item) => item.kind === "analysis");

  assert.equal(measurementBlocks.length, 7);
  assert.equal(analysisBlocks.length, 1);
  assert.equal(analysisBlocks[0]?.directlyAskable, false);
  assert.equal(analysisBlocks[0]?.questionCount, 0);
  assert.equal(analysisBlocks[0]?.analysisType, "association");
  assert.deepEqual(
    analysisBlocks[0]?.variableIds,
    intent.researchIntent.relations[0]
      ? [
          intent.researchIntent.relations[0].fromVariableId,
          intent.researchIntent.relations[0].toVariableId,
        ]
      : [],
  );
});

test("수면 시간·지각 횟수 fallback은 7개 분석 가능 문항을 만들고 관계 자체는 묻지 않는다", () => {
  const blueprint = analyzeSurveyPrompt(sleepTardinessPrompt);
  const questions = blueprint.aiQuestions;
  const text = questions.map((item) => item.title).join(" ");

  assert.equal(questions.length, 7);
  assert.deepEqual(questions.slice(0, 2).map((item) => item.type), ["single", "single"]);
  assert.match(questions[0]?.title ?? "", /수업이 있는 날.*몇 시간/);
  assert.match(questions[1]?.title ?? "", /지각한 횟수.*몇 회/);
  assert.deepEqual(questions[0]?.options, [
    "4시간 미만",
    "4시간 이상~5시간 미만",
    "5시간 이상~6시간 미만",
    "6시간 이상~7시간 미만",
    "7시간 이상~8시간 미만",
    "8시간 이상",
  ]);
  assert.deepEqual(questions[1]?.options, ["0회", "1~2회", "3~5회", "6~10회", "11회 이상"]);
  assert.doesNotMatch(text, /두 값.*(?:관계|함께 달라)|관련 있다고 느끼|영향이 있다고 생각/);
  assert.deepEqual(
    validateSurvey(sleepTardinessPrompt, parseSurveyBrief(sleepTardinessPrompt), blueprint),
    [],
  );
});

test("관계형 의미 검증은 변수·관계·분석 가능성을 서로 다른 오류로 보고한다", () => {
  const intent = parseSurveyIntent(sleepTardinessPrompt);
  const violations = validateSurveyIntentCandidate(intent, {
    title: "대학생 수면과 지각 조사",
    description: "수면과 지각을 알아보는 설문입니다.",
    questions: [
      {
        id: "q1",
        title: "앞에서 답한 두 값이 함께 달라진다고 느끼는 정도는 어느 수준인가요?",
        type: "scale",
        options: ["전혀 아님", "매우 그러함"],
      },
    ],
  });
  const codes = new Set(violations.map((item) => item.code));
  assert.ok(codes.has("VARIABLE_COVERAGE_MISSING"));
  assert.ok(codes.has("RELATION_COVERAGE_MISSING"));
  assert.ok(codes.has("ANALYSIS_GOAL_NOT_SUPPORTED"));
  assert.ok(codes.has("DIRECT_RELATION_QUESTION_USED"));
  assert.ok(violations.some((item) => item.origin === "relation_mapping"));
});

test("관계형 핵심 10개 입력은 두 기초 변수를 유지하고 분석 블록을 질문으로 만들지 않는다", () => {
  const cases = [
    [sleepTardinessPrompt, /수면 시간/, /지각 횟수/],
    ["대학생들의 평균 수면 시간과 지각 비율의 관계", /수면 시간/, /지각 여부/],
    ["공부 시간과 성적의 관계", /공부 시간/, /성적/],
    ["운동 빈도에 따른 수면의 질 차이", /운동 빈도/, /수면의 질/],
    ["통학 시간과 지각 횟수의 관계", /통학 시간/, /지각 횟수/],
    ["학년별 동아리 참여 비율", /학년/, /동아리 참여 여부/],
    ["지역별 배달앱 이용률", /거주 지역/, /배달 앱 이용 여부/],
    ["나이와 AI 사용 여부의 관계", /나이/, /AI 사용 여부/],
    ["근무 시간과 이직 의향의 관계", /근무 시간/, /이직 의향/],
    ["네이버 웹툰 이용 빈도에 따른 만족도 차이", /이용 빈도/, /만족도/],
  ] as const;

  for (const [prompt, firstVariable, secondVariable] of cases) {
    const intent = parseSurveyIntent(prompt);
    const plan = createSurveyPlan(intent, 7);
    const blueprint = analyzeSurveyPrompt(prompt);
    const variables = intent.researchIntent.variables
      .filter((item) => item.scope === "respondent_level" && item.directlyAskable)
      .map((item) => item.name)
      .join(" ");
    const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

    assert.match(variables, firstVariable, prompt);
    assert.match(variables, secondVariable, prompt);
    assert.ok(plan.blocks.some((item) => item.kind === "analysis" && !item.directlyAskable), prompt);
    assert.equal(blueprint.aiQuestions.length, 7, prompt);
    assert.doesNotMatch(corpus, /두 값.*(?:관계|함께 달라)|관련 있다고 느끼/, prompt);
    assert.deepEqual(validateSurvey(prompt, parseSurveyBrief(prompt), blueprint), [], prompt);
  }
});

test("실제 standard route는 수면 시간·지각 횟수 입력을 fallback에서도 200으로 완료한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-sleep-tardiness-regression",
        },
        body: JSON.stringify({
          prompt: sleepTardinessPrompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      requestId?: string;
      blueprint?: ReturnType<typeof analyzeSurveyPrompt>;
    };
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.requestId, response.headers.get("x-baroform-request-id"));
    assert.equal(body.blueprint?.aiQuestions.length, 7);
    assert.match(body.blueprint?.aiQuestions[0]?.title ?? "", /몇 시간/);
    assert.match(body.blueprint?.aiQuestions[1]?.title ?? "", /몇 회/);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("모델이 analysis block을 직접 관계 문항으로 오해해도 해당 문항만 복구한다", () => {
  const intent = parseSurveyIntent(sleepTardinessPrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(sleepTardinessPrompt);
  const broken = {
    ...fallback,
    aiQuestions: fallback.aiQuestions.map((item, index) =>
      index === 6
        ? {
            ...item,
            title: "앞에서 답한 두 값이 서로 관련 있다고 느끼는 정도는 어느 수준인가요?",
            type: "single" as const,
            options: ["전혀 관련 없음", "매우 관련 있음"],
          }
        : item,
    ),
  };
  const violations = validateSurveyIntentCandidate(intent, {
    title: broken.title,
    description: broken.description,
    questions: broken.aiQuestions.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      options: item.options,
      measuredVariable: item.measuredVariable,
      measuredConstruct: item.measuredConstruct,
    })),
  });
  assert.ok(violations.some((item) => item.code === "DIRECT_RELATION_QUESTION_USED"));
  const repair = repairInvalidQuestions({
    survey: broken,
    intent,
    plan,
    violations,
    getFallback: () => fallback,
  });
  assert.deepEqual(repair.repairedQuestionIds, [7]);
  assert.deepEqual(repair.preservedQuestionIds, [1, 2, 3, 4, 5, 6]);
  assert.doesNotMatch(repair.survey.aiQuestions[6]?.title ?? "", /두 값.*관련/);
});

test("numeric 변수를 자유입력으로 내보낸 schema mismatch는 순서형 선택지 문항으로 복구한다", () => {
  const intent = parseSurveyIntent(sleepTardinessPrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(sleepTardinessPrompt);
  const broken = {
    ...fallback,
    aiQuestions: fallback.aiQuestions.map((item, index) =>
      index < 2 ? { ...item, type: "shortText" as const, options: undefined } : item,
    ),
  };
  const violations = validateSurveyIntentCandidate(intent, {
    title: broken.title,
    description: broken.description,
    questions: broken.aiQuestions.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      options: item.options,
      measuredVariable: item.measuredVariable,
      measuredConstruct: item.measuredConstruct,
    })),
  });
  assert.ok(
    violations.some((item) => item.code === "ANALYSIS_FEASIBILITY_UNSUPPORTED"),
  );
  const repair = repairInvalidQuestions({
    survey: broken,
    intent,
    plan,
    violations,
    getFallback: () => fallback,
  });
  assert.equal(repair.survey.aiQuestions[0]?.type, "single");
  assert.equal(repair.survey.aiQuestions[1]?.type, "single");
  assert.ok((repair.survey.aiQuestions[0]?.options?.length ?? 0) >= 5);
  assert.ok((repair.survey.aiQuestions[1]?.options?.length ?? 0) >= 5);
  assert.deepEqual(
    validateSurvey(sleepTardinessPrompt, parseSurveyBrief(sleepTardinessPrompt), repair.survey),
    [],
  );
});
