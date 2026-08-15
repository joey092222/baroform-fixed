import assert from "node:assert/strict";
import test from "node:test";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { POST as startReferenceUpload } from "../app/api/reference-files/route";
import { POST as uploadReferencePart } from "../app/api/reference-files/[uploadId]/parts/route";
import { POST as completeReferenceUpload } from "../app/api/reference-files/[uploadId]/complete/route";
import {
  buildSurveyAiRequest,
  parseSurveyDraftResponse,
} from "../app/survey-ai";
import {
  buildSurveyRevisionRequest,
  parseSurveyRevisionResponse,
} from "../app/survey-revision";
import {
  analyzeSurveyPrompt,
  hasActionableSurveyDirection,
  isExplicitDurationSurveyRequest,
  isLiteralFrequencySurveyRequest,
  isSleepDurationSurveyRequest,
  isSimpleProportionSurveyRequest,
  parseExplicitSurveyMeasurement,
  parseSurveySemantics,
} from "../app/survey-intent";
import { applyTargetGradeToQuestions } from "../app/survey-grade";
import {
  maxReferenceFileBytes,
  maxReferenceFilesTotalBytes,
  normalizedReferenceFile,
} from "../app/reference-files";
import { verifyReferenceFileToken } from "../app/reference-file-upload";
import { createSurveyGenerationSchema } from "../app/lib/ai/survey-generation-schema";

type QuestionType = "scale" | "single" | "multiple" | "text";

function question(
  id: number,
  title: string,
  type: QuestionType = "scale",
  options: string[] = [],
) {
  return {
    id,
    title,
    reason: `${title} 분석에 필요한 질문`,
    type,
    options,
    required: id < 5,
  };
}

function requestInputText(input: unknown) {
  return typeof input === "string" ? input : JSON.stringify(input);
}

test("단순 비율 요청은 해당 여부 한 문항으로 그대로 설계한다", () => {
  const prompt = "대학생들 중 자취를 하는 학생의 비율을 조사해달라";
  const semantics = parseSurveySemantics(prompt);
  const draft = analyzeSurveyPrompt(prompt);

  assert.equal(isSimpleProportionSurveyRequest(prompt), true);
  assert.equal(semantics.respondentGroup, "대학생");
  assert.equal(semantics.evaluationTarget, "자취 여부");
  assert.equal(semantics.goalLabel, "해당 학생 비율 파악");
  assert.equal(draft.title, "대학생 자취 비율 조사");
  assert.equal(draft.aiQuestions.length, 1);
  assert.equal(draft.aiQuestions[0]?.title, "현재 자취를 하고 있나요?");
  assert.deepEqual(draft.aiQuestions[0]?.options, ["예", "아니요"]);
  assert.doesNotMatch(
    JSON.stringify(draft.aiQuestions),
    /관련|평가|만족|개선|이유|학년|학과/,
  );
});

test("비율 외 조사 목적이 함께 있으면 단순 비율 전용 경로로 축약하지 않는다", () => {
  assert.equal(
    isSimpleProportionSurveyRequest(
      "대학생 중 자취하는 학생의 비율과 자취 이유를 조사해달라",
    ),
    false,
  );
});

test("학생 소비 습관은 추가 목적 없이도 구체적인 행동 설문으로 설계한다", () => {
  const prompt = "학생들의 소비 습관을 조사하라";
  const semantics = parseSurveySemantics(prompt);
  const draft = analyzeSurveyPrompt(prompt);
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.equal(hasActionableSurveyDirection(prompt), true);
  assert.equal(semantics.respondentGroup, "학생");
  assert.equal(semantics.evaluationTarget, "소비 습관");
  assert.equal(semantics.goalLabel, "소비 행태 파악");
  assert.equal(draft.title, "학생 소비 습관 조사");
  assert.equal(draft.aiQuestions.length, 7);
  assert.match(corpus, /생활비/);
  assert.match(corpus, /지출이 많은 항목/);
  assert.match(corpus, /결제 수단/);
  assert.match(corpus, /충동적으로 구매/);
  assert.doesNotMatch(
    corpus,
    /얼마나 관련이 있나요|전반적으로 어떻게 평가하시나요|만족도와 개선점|참여 의향|불편 사항/,
  );
});

test("카공 빈도는 빈도라는 단어가 아니라 실제 카공 행동 주기를 묻는다", () => {
  const prompt = "대학생들의 카공 빈도를 조사하라";
  const draft = analyzeSurveyPrompt(prompt);
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.equal(isLiteralFrequencySurveyRequest(prompt), true);
  assert.equal(draft.title, "대학생 카공 빈도 조사");
  assert.equal(
    draft.aiQuestions[0]?.title,
    "최근 1개월 동안 카공을 얼마나 자주 하나요?",
  );
  assert.deepEqual(draft.aiQuestions[0]?.options, [
    "전혀 하지 않음",
    "월 1회 미만",
    "월 1~3회",
    "주 1~2회",
    "주 3~4회",
    "주 5회 이상",
  ]);
  assert.match(corpus, /한 번 카공할 때/);
  assert.match(corpus, /카공할 장소/);
  assert.match(corpus, /음료나 음식/);
  assert.doesNotMatch(
    corpus,
    /카공 빈도는 어느 정도인가요|그 경험이 드는|드물게 있음|거의 항상 있음/,
  );
});

test("대학생 수면 시간 의견은 실제 수면 시간과 충분함을 묻는다", () => {
  const prompt = "대학생 수면 시간 의견을 조사하라";
  const semantics = parseSurveySemantics(prompt);
  const draft = analyzeSurveyPrompt(prompt);
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.equal(isSleepDurationSurveyRequest(prompt), true);
  assert.equal(semantics.respondentGroup, "대학생");
  assert.equal(semantics.evaluationTarget, "수면 시간");
  assert.equal(semantics.goalLabel, "수면 시간과 인식 파악");
  assert.equal(draft.title, "대학생 수면 시간 조사");
  assert.equal(draft.aiQuestions.length, 7);
  assert.equal(
    draft.aiQuestions[0]?.title,
    "평일에 하루 평균 몇 시간 정도 자나요?",
  );
  assert.match(corpus, /주말이나 공휴일/);
  assert.match(corpus, /충분하다고 느끼나요/);
  assert.match(corpus, /가장 적절하다고 생각하는 하루 수면 시간/);
  assert.match(corpus, /부족해지는 주된 이유/);
  assert.match(corpus, /일상에 미치는 영향/);
  assert.doesNotMatch(
    corpus,
    /수면 시간.*얼마나 관련이 있나요|전반적으로 어떻게 평가하시나요|중요하게 생각하는 요소/,
  );
});

test("SNS 이용 시간은 서비스명이 아니라 실제 시간량을 묻는 측정 기준으로 해석한다", () => {
  const prompt = "연세대학교 재학생 SNS 이용 시간 조사";
  const semantics = parseSurveySemantics(prompt);
  const measurement = parseExplicitSurveyMeasurement(prompt);
  const draft = analyzeSurveyPrompt(prompt);
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.equal(isExplicitDurationSurveyRequest(prompt), true);
  assert.equal(semantics.respondentGroup, "연세대학교 재학생");
  assert.equal(semantics.evaluationTarget, "SNS 이용 시간");
  assert.equal(semantics.goalLabel, "실제 이용 시간 파악");
  assert.deepEqual(measurement, {
    kind: "duration",
    target: "SNS 이용",
    metricLabel: "이용 시간",
    sourceTopic: "SNS 이용 시간",
  });
  assert.equal(draft.title, "연세대학교 재학생 SNS 이용 시간 조사");
  assert.equal(
    draft.aiQuestions[0]?.title,
    "평일 하루 평균 SNS 이용 시간은 얼마나 되나요?",
  );
  assert.deepEqual(draft.aiQuestions[0]?.options, [
    "전혀 하지 않음",
    "30분 미만",
    "30분 이상 1시간 미만",
    "1시간 이상 2시간 미만",
    "2시간 이상 3시간 미만",
    "3시간 이상 4시간 미만",
    "4시간 이상",
  ]);
  assert.match(corpus, /주말이나 공휴일 하루 평균 SNS 이용 시간/);
  assert.match(corpus, /일주일 중 SNS 이용 시간이 있는 날/);
  assert.match(corpus, /SNS 이용 시간이 가장 긴 시간대/);
  assert.doesNotMatch(
    corpus,
    /SNS 이용 시간.*(?:사용하거나 이용|만족|얼마나 관련)|전반적으로 어떻게 평가/,
  );
});

test("명시된 측정 기준은 실제 대상과 분리해 공통 의미 구조로 보존한다", () => {
  assert.deepEqual(
    parseExplicitSurveyMeasurement("대학생 배달앱 월 지출 금액 조사"),
    {
      kind: "cost",
      target: "배달앱",
      metricLabel: "월 지출 금액",
      sourceTopic: "배달앱 월 지출 금액",
    },
  );
  assert.deepEqual(
    parseExplicitSurveyMeasurement("대학생들의 도서관 방문 횟수 조사"),
    {
      kind: "frequency",
      target: "도서관 방문",
      metricLabel: "횟수",
      sourceTopic: "도서관 방문 횟수",
    },
  );
  assert.deepEqual(
    parseExplicitSurveyMeasurement("대학생들의 카페 선택 이유 조사"),
    {
      kind: "reason",
      target: "카페 선택",
      metricLabel: "이유",
      sourceTopic: "카페 선택 이유",
    },
  );
});

test("설문 생성 API는 단순 비율 요청도 검색을 시도하고 실패 시 최소 문항으로 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("테스트 검색 연결 실패");
  };

  const create = (targetGrade: "전학년" | "2학년") =>
    createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": `baroform-proportion-${targetGrade === "전학년" ? "all" : "grade2"}`,
        },
        body: JSON.stringify({
          prompt: "대학생들 중 자취를 하는 학생의 비율을 조사해달라",
          targetGrade,
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );

  try {
    const allGradesResponse = await create("전학년");
    const allGrades = (await allGradesResponse.json()) as {
      status: string;
      blueprint: {
        respondentGroup: string;
        aiQuestions: Array<{ title: string; options?: string[] }>;
      };
    };
    assert.equal(allGradesResponse.status, 200);
    assert.equal(
      allGradesResponse.headers.get("x-baroform-ai-fallback"),
      "responses-api-error",
    );
    assert.equal(allGrades.status, "ready_with_caution");
    assert.equal(allGrades.blueprint.respondentGroup, "대학생");
    assert.deepEqual(allGrades.blueprint.aiQuestions, [
      {
        id: 1,
        title: "현재 자취를 하고 있나요?",
        reason: "‘예’ 응답 수를 전체 유효 응답 수로 나눠 해당 학생의 비율을 계산해요.",
        type: "single",
        options: ["예", "아니요"],
        required: true,
      },
    ]);

    const secondGradeResponse = await create("2학년");
    const secondGrade = (await secondGradeResponse.json()) as {
      blueprint: { aiQuestions: Array<{ title: string }> };
    };
    assert.equal(secondGrade.blueprint.aiQuestions.length, 2);
    assert.match(secondGrade.blueprint.aiQuestions[0]?.title ?? "", /2학년/);
    assert.equal(
      secondGrade.blueprint.aiQuestions[1]?.title,
      "현재 자취를 하고 있나요?",
    );
    assert.equal(upstreamCalled, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 카공 빈도도 검색을 시도하고 실패 시 행동 문항으로 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("테스트 검색 연결 실패");
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-direct-cagong-frequency-test",
        },
        body: JSON.stringify({
          prompt: "대학생들의 카공 빈도를 조사하라",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      status: string;
      clarification?: unknown;
      blueprint: {
        aiQuestions: Array<{ title: string; options?: string[] }>;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("x-baroform-ai-fallback"),
      "responses-api-error",
    );
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.equal(body.blueprint.aiQuestions.length, 7);
    assert.equal(
      body.blueprint.aiQuestions[0]?.title,
      "최근 1개월 동안 카공을 얼마나 자주 하나요?",
    );
    assert.deepEqual(body.blueprint.aiQuestions[0]?.options, [
      "전혀 하지 않음",
      "월 1회 미만",
      "월 1~3회",
      "주 1~2회",
      "주 3~4회",
      "주 5회 이상",
    ]);
    assert.equal(upstreamCalled, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 수면 시간도 검색을 시도하고 실패 시 생활시간 문항으로 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("테스트 검색 연결 실패");
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-direct-sleep-duration-test",
        },
        body: JSON.stringify({
          prompt: "대학생 수면 시간 의견을 조사하라",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      status: string;
      clarification?: unknown;
      blueprint: {
        title: string;
        aiQuestions: Array<{ title: string; options?: string[] }>;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("x-baroform-ai-fallback"),
      "responses-api-error",
    );
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.equal(body.blueprint.title, "대학생 수면 시간 조사");
    assert.equal(body.blueprint.aiQuestions.length, 7);
    assert.equal(
      body.blueprint.aiQuestions[0]?.title,
      "평일에 하루 평균 몇 시간 정도 자나요?",
    );
    assert.equal(upstreamCalled, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 SNS 이용 시간도 검색을 시도하고 실패 시 시간 문항으로 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("테스트 검색 연결 실패");
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-direct-sns-duration-test",
        },
        body: JSON.stringify({
          prompt: "연세대학교 재학생 SNS 이용 시간 조사",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      status: string;
      clarification?: unknown;
      blueprint: {
        title: string;
        description: string;
        goal: string;
        respondentGroup: string;
        aiQuestions: Array<{ title: string; options?: string[] }>;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("x-baroform-ai-fallback"),
      "responses-api-error",
    );
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.equal(
      body.blueprint.title,
      "연세대학교 재학생 SNS 이용 시간 조사",
    );
    assert.equal(body.blueprint.goal, "실제 이용 시간 파악");
    assert.equal(body.blueprint.respondentGroup, "연세대학교 재학생");
    assert.match(
      body.blueprint.description,
      /^연세대학교 재학생을 대상으로, SNS 이용 시간을 실제 시간 단위로/,
    );
    assert.doesNotMatch(
      body.blueprint.description,
      /연세대학교 재학생을 대상으로, 연세대학교 재학생을 대상으로/,
    );
    assert.equal(
      body.blueprint.aiQuestions[0]?.title,
      "평일 하루 평균 SNS 이용 시간은 얼마나 되나요?",
    );
    assert.equal(upstreamCalled, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

const fixtureQuestionRoles = [
  "eligibility",
  "behavior",
  "specific-dimension",
  "driver",
  "comparison",
  "priority",
  "open-ended",
] as const;

function diversifyFixtureQuestions(
  questions: ReturnType<typeof question>[],
) {
  const types = questions.map((item) => item.type);
  let longestRun = 1;
  let currentRun = 1;
  for (let index = 1; index < types.length; index += 1) {
    currentRun = types[index] === types[index - 1] ? currentRun + 1 : 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  const scaleCount = types.filter((type) => type === "scale").length;
  const alreadyDiverse =
    new Set(types).size >= 3 &&
    longestRun < 4 &&
    scaleCount <= Math.ceil(questions.length * 0.6);
  if (questions.length < 6 || alreadyDiverse) {
    return questions;
  }
  return questions.map((item, index) => {
    if (index === questions.length - 1) {
      return { ...item, type: "text" as const, options: [] };
    }
    const pattern: QuestionType[] = [
      "single",
      "scale",
      "multiple",
      "scale",
    ];
    const type = pattern[index % pattern.length];
    return {
      ...item,
      type,
      options:
        type === "single" || type === "multiple"
          ? ["해당함", "해당하지 않음", "판단하기 어려움"]
          : [],
    };
  });
}

function readyPayload({
  prompt,
  evaluationTarget,
  respondentGroup,
  entityType,
  templateQuestions,
  aiQuestions,
  sourceUrls,
  factSourceUrl = sourceUrls[0],
}: {
  prompt: string;
  evaluationTarget: string;
  respondentGroup: string;
  entityType:
    | "building"
    | "cafeteria"
    | "student-life"
    | "service"
    | "other";
  templateQuestions: ReturnType<typeof question>[];
  aiQuestions: ReturnType<typeof question>[];
  sourceUrls: string[];
  factSourceUrl?: string;
}) {
  const preparedAiQuestions = diversifyFixtureQuestions(aiQuestions);
  const result = {
    result: {
      status: "ready",
      interpretation: {
        kind: "satisfaction",
        intentLabel: "만족도 조사",
        respondentGroup,
        evaluationTarget,
        goal: "만족도와 개선점 파악",
        recognizedEntity: prompt.includes("맛나샘") ? "맛나샘" : evaluationTarget,
        entityType,
        searchRequired: true,
        confidence: "high",
        assumptions: [],
      },
      title: `${evaluationTarget} 만족도 조사`,
      description: `${respondentGroup}을 대상으로 실제 경험을 조사합니다.`,
      templateTitle: `${evaluationTarget} 핵심 템플릿`,
      templateSummary: "핵심 경험과 개선점을 확인합니다.",
      aiTitle: `${evaluationTarget} AI 맞춤 설문`,
      researchSummary: "공개 자료를 확인해 조사 차원을 구성했습니다.",
      researchClassification: "verified",
      researchLimitations: [],
      verifiedFacts: [
        {
          fact: "설문 설계에 반영할 수 있는 확인된 사실입니다.",
          sourceUrl: factSourceUrl,
        },
      ],
      designPlan: {
        referenceGrounding: [
          {
            sourceLabel: "테스트 참고자료",
            insight: "조사 대상의 구체적인 경험 차원을 문항에 반영했습니다.",
            questionIds: [1, Math.min(3, preparedAiQuestions.length)],
          },
        ],
        analyticalAxes: ["실제 이용 행동", "핵심 경험 평가", "개선 우선순위"],
        questionRoles: preparedAiQuestions.map(
          (_, index) => fixtureQuestionRoles[index % fixtureQuestionRoles.length],
        ),
      },
      templateQuestions,
      aiQuestions: preparedAiQuestions,
      qualityCheck: {
        respondentNotMiscastAsSubject: true,
        questionsMatchSubject: true,
        noDuplicateQuestions: true,
        referencesMateriallyUsed: true,
        questionsCoverDistinctDimensions: true,
        questionTypesPurposefullyVaried: true,
        noGenericPlaceholderWording: true,
        allSpecificClaimsGrounded: true,
        oneConceptPerQuestion: true,
        neutralWording: true,
        responseOptionsAreMece: true,
        referencePeriodsAddedWhereNeeded: true,
        branchPathsValid: true,
        questionCountValid: true,
        mobileReadable: true,
        respondentPathSimulationPassed: true,
      },
    },
  };

  return {
    status: "completed",
    output: [
      {
        type: "web_search_call",
        status: "completed",
        action: {
          sources: sourceUrls.map((url, index) => ({
            title: `출처 ${index + 1}`,
            url,
          })),
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(result),
            annotations: [],
          },
        ],
      },
    ],
  };
}

function editReadyPayload(
  payload: ReturnType<typeof readyPayload>,
  edit: (result: Record<string, unknown>) => void,
) {
  const message = payload.output.find((item) => item.type === "message") as
    | { content?: Array<{ text?: string }> }
    | undefined;
  const content = message?.content?.[0];
  assert.ok(content?.text);
  const decoded = JSON.parse(content.text) as {
    result: Record<string, unknown>;
  };
  edit(decoded.result);
  content.text = JSON.stringify(decoded);
}

function structuredQuestion(
  id: number,
  role:
    | "screening"
    | "behavior"
    | "experience"
    | "evaluation"
    | "barrier"
    | "open",
  type:
    | "single_choice"
    | "multiple_choice"
    | "scale"
    | "long_text",
  text: string,
  labels: string[] = [],
) {
  return {
    id: `Q${id}`,
    section_id: "S1",
    role,
    type,
    text,
    helper_text: null,
    required: type !== "long_text",
    reference_period: id === 2 ? "최근 4주" : null,
    options: labels.map((label, index) => ({
      id: `Q${id}_O${index + 1}`,
      label,
      exclusive: label === "이용하지 않음",
      fixed_position: label === "기타",
      allows_text: label === "기타",
    })),
    scale:
      type === "scale"
        ? {
            min: 1,
            max: 5,
            min_label: "전혀 만족하지 않음",
            max_label: "매우 만족",
          }
        : null,
    randomize_options: false,
    show_if: [],
    validation: {
      min_value: null,
      max_value: null,
      min_selections: type === "multiple_choice" ? 1 : null,
      max_selections: type === "multiple_choice" ? 3 : null,
      max_length: type === "long_text" ? 1000 : null,
    },
    analysis: {
      construct: role,
      purpose: `${text} 결과를 이용 행태 분석에 사용합니다.`,
      variable_name: `q_${id}`,
      coding_notes: null,
    },
    grounding: {
      uses_external_fact: id === 1,
      source_ids: id === 1 ? ["SRC1"] : [],
    },
  };
}

function structuredReadyPayload() {
  const sourceUrl = "https://comic.naver.com";
  const questions = [
    structuredQuestion(1, "screening", "single_choice", "네이버웹툰을 이용한 적이 있나요?", ["예", "아니요"]),
    structuredQuestion(2, "behavior", "single_choice", "최근 4주 동안 네이버웹툰을 얼마나 자주 이용했나요?", ["이용하지 않음", "월 1~3회", "주 1~2회", "주 3회 이상"]),
    structuredQuestion(3, "behavior", "single_choice", "한 번 이용할 때 보통 얼마나 오래 웹툰을 보나요?", ["10분 미만", "10~29분", "30~59분", "1시간 이상"]),
    structuredQuestion(4, "experience", "multiple_choice", "주로 어떤 상황에서 웹툰을 보나요?", ["통학 중", "쉬는 시간", "잠들기 전", "기타"]),
    structuredQuestion(5, "experience", "multiple_choice", "주로 보는 웹툰 장르를 골라주세요.", ["드라마", "로맨스", "액션", "코미디", "기타"]),
    structuredQuestion(6, "evaluation", "scale", "네이버웹툰 이용 경험에 전반적으로 얼마나 만족하나요?"),
    structuredQuestion(7, "open", "long_text", "이용하면서 가장 불편했던 점이 있다면 적어주세요."),
  ];
  const generation = {
    status: "ready" as const,
    research: {
      search_status: "verified" as const,
      entities: [
        {
          input_name: "네이버웹툰",
          resolved_name: "네이버웹툰",
          resolved_as: "웹툰 서비스",
          affiliation_or_location: "대한민국",
          confidence: "verified" as const,
          verified_facts: [
            {
              fact: "웹툰 콘텐츠를 제공하는 서비스입니다.",
              source_ids: ["SRC1"],
            },
          ],
        },
      ],
      sources: [
        {
          id: "SRC1",
          title: "네이버웹툰",
          url: sourceUrl,
          source_type: "official" as const,
          used_for: "서비스 정체 확인",
        },
      ],
      limitations: [],
    },
    survey_plan: {
      survey_type: "이용 현황 조사",
      target: "네이버웹툰을 알고 있는 대학생",
      eligibility: "대학생",
      primary_objective: "대학생의 네이버웹툰 이용 행태와 경험을 파악한다.",
      sub_objectives: ["이용 빈도", "이용 상황", "불편 경험"],
      constructs: [
        { name: "이용 여부", reason: "이용자 규모를 구분한다." },
        { name: "이용 빈도", reason: "이용 강도를 파악한다." },
        { name: "이용 시간", reason: "회당 체류 시간을 파악한다." },
        { name: "이용 상황", reason: "주요 이용 맥락을 파악한다." },
        { name: "장르 선호", reason: "콘텐츠 선호를 파악한다." },
        { name: "만족도", reason: "전체 경험을 평가한다." },
        { name: "불편", reason: "개선 단서를 찾는다." },
      ],
      requested_question_count: 7,
      count_rule: "max_path" as const,
      total_question_nodes: 7,
      min_path_questions: 7,
      max_path_questions: 7,
      estimated_minutes: 3,
    },
    survey: {
      title: "대학생 네이버웹툰 이용 현황 조사",
      intro: "대학생의 네이버웹툰 이용 방식과 경험을 알아보기 위한 설문입니다.",
      sections: [{ id: "S1", title: "이용 경험", description: null }],
      questions,
      completion_message: "응답해주셔서 감사합니다.",
    },
    quality_check: {
      all_named_entities_searched: true,
      all_specific_claims_grounded: true,
      all_questions_have_analysis_purpose: true,
      double_barreled_questions_removed: true,
      leading_questions_removed: true,
      duplicate_questions_removed: true,
      response_options_checked: true,
      all_logic_paths_valid: true,
      question_count_valid: true,
      mobile_readability_checked: true,
      respondent_path_simulation_passed: true,
      warnings: [],
    },
  };
  const parsed = createSurveyGenerationSchema(7).parse(generation);
  return {
    status: "completed",
    output_parsed: parsed,
    output: [
      {
        type: "web_search_call",
        status: "completed",
        action: {
          sources: [{ title: "네이버웹툰", url: sourceUrl }],
        },
      },
    ],
  };
}

test("검색 기반 구조화 결과를 기존 설문 편집 형식으로 연결한다", () => {
  const result = parseSurveyDraftResponse(
    structuredReadyPayload(),
    "대학생 네이버웹툰 이용 현황 조사",
  );

  assert.equal(result.status, "ready");
  if (result.status !== "ready" && result.status !== "ready_with_caution") {
    assert.fail("완성된 설문 결과가 필요합니다.");
  }
  assert.equal(result.blueprint.aiQuestions.length, 7);
  assert.equal(result.blueprint.aiQuestions[1]?.type, "single");
  assert.equal(result.blueprint.aiQuestions[5]?.type, "scale");
  assert.equal(result.research.sources[0]?.url, "https://comic.naver.com/");
  assert.equal(result.surveyPlan?.requested_question_count, 7);
  assert.equal(result.qualityCheck?.question_count_valid, true);
  assert.equal(result.completionMessage, "응답해주셔서 감사합니다.");
});

test("구조화 결과의 중복 문항 ID를 서버 검증에서 거부한다", () => {
  const payload = structuredReadyPayload();
  payload.output_parsed.survey.questions[1]!.id = "Q1";

  assert.throws(
    () =>
      parseSurveyDraftResponse(
        payload,
        "대학생 네이버웹툰 이용 현황 조사",
      ),
    /질문 ID Q1가 중복/,
  );
});

for (const surveyCase of [
  { prompt: "맛나샘 만족도 조사", count: 12 },
  { prompt: "대우관 등하교 경험 조사", count: 10 },
  {
    prompt: "연세대학교의 가상 시설 별빛라운지 이용 경험 조사",
    count: 7,
  },
  {
    prompt:
      "현재 국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생 이용 현황과 경험 분석",
    count: 7,
  },
] as const) {
  test(`${surveyCase.prompt} 요청은 원문과 정확한 문항 수를 검색 요청에 보존한다`, () => {
    const request = buildSurveyAiRequest(
      surveyCase.prompt,
      analyzeSurveyPrompt(surveyCase.prompt),
      "gpt-5.6",
      { questionCount: surveyCase.count },
    );
    const input = requestInputText(request.input);
    const format = request.text.format as unknown as {
      schema: {
        properties: {
          survey: {
            properties: {
              questions: { minItems?: number; maxItems?: number };
            };
          };
        };
      };
    };
    const questionSchema =
      format.schema.properties.survey.properties.questions;

    assert.match(input, new RegExp(surveyCase.prompt));
    assert.match(input, new RegExp(`\\[희망 문항 수\\]\\n${surveyCase.count}`));
    assert.equal(request.tool_choice, "required");
    assert.equal(request.reasoning.effort, "high");
    assert.equal(request.max_output_tokens, 20_000);
    assert.doesNotMatch(JSON.stringify(request.text.format.schema), /"format":"uri"/);
    assert.equal(questionSchema.minItems, surveyCase.count);
    assert.equal(questionSchema.maxItems, surveyCase.count);
  });
}

test("OpenAI 요청은 모든 설문에서 검색과 내부 품질 검사를 강제한다", () => {
  const prompt = "대우관 만족도 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );

  assert.equal(request.model, "gpt-5.6");
  assert.equal(request.tool_choice, "required");
  assert.equal(request.reasoning.effort, "high");
  assert.equal(request.store, false);
  assert.equal(request.tools[0]?.type, "web_search");
  assert.equal(request.tools[0]?.search_context_size, "medium");
  assert.equal(request.tools[0]?.user_location.country, "KR");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.match(requestInputText(request.input), /로그인 프로필 문맥: 별도 정보 없음/);
  assert.doesNotMatch(requestInputText(request.input), /현재 운영 학교는 연세대학교/);
  assert.match(request.instructions, /입력이 불완전하면 검색 결과와 입력 문맥/);
  assert.match(requestInputText(request.input), /\d{4}-\d{2}-\d{2}/);
  assert.match(request.instructions, /모든 설문 요청에서 최소 한 번 이상 웹 검색/);
  assert.match(request.instructions, /최소 다음 응답자 경로를 내부적으로 시뮬레이션/);
  assert.match(request.instructions, /사용자에게 추가 질문을 하지 않는다/);
  assert.match(request.instructions, /ready_with_caution/);
  assert.equal(JSON.stringify(request).includes("OPENAI_API_KEY"), false);
});

test("첨부 사진과 링크를 실제 멀티모달 참고 자료로 전달한다", () => {
  const prompt = "이 자료를 바탕으로 만족도 조사를 만들어줘";
  const link = "https://www.yonsei.ac.kr/sc/366/subview.do";
  const dataUrl = `data:image/png;base64,${"a".repeat(120)}`;
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
    {
      targetGrade: "전학년",
      questionCount: 7,
      references: {
        images: Array.from({ length: 10 }, (_, index) => ({
          name: index === 0 ? "식당 안내 캡처.png" : `추가 캡처 ${index + 1}.png`,
          dataUrl,
        })),
        links: [link],
      },
    },
  );

  assert.equal(request.tool_choice, "required");
  assert.ok(Array.isArray(request.input));
  const serialized = JSON.stringify(request.input);
  assert.match(serialized, /input_image/);
  assert.match(serialized, /식당 안내 캡처\.png/);
  assert.match(serialized, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(serialized, /reference_links/);
  assert.equal(serialized.includes(dataUrl), true);
  assert.equal((serialized.match(/"type":"input_image"/g) ?? []).length, 10);
});

test("첨부 문서와 표를 실제 input_file 참고 자료로 전달한다", () => {
  const prompt = "첨부한 기획서와 조사표를 참고해 수요 조사를 만들어줘";
  const pdfData = `data:application/pdf;base64,${Buffer.from("survey brief").toString("base64")}`;
  const sheetData = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from("survey sheet").toString("base64")}`;
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
    {
      references: {
        images: [],
        files: [
          {
            name: "서비스 기획서.pdf",
            mimeType: "application/pdf",
            dataUrl: pdfData,
          },
          {
            name: "기존 조사표.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dataUrl: sheetData,
          },
        ],
        links: [],
      },
    },
  );

  const serialized = JSON.stringify(request.input);
  assert.equal((serialized.match(/"type":"input_file"/g) ?? []).length, 2);
  assert.match(serialized, /서비스 기획서\.pdf/);
  assert.match(serialized, /기존 조사표\.xlsx/);
  assert.match(serialized, /멀티모달 입력/);
  assert.equal(serialized.includes(pdfData), true);
  assert.equal(serialized.includes(sheetData), true);
  assert.equal(request.tool_choice, "required");
});

test("참고자료가 있으면 깊이 있는 분석 계약과 높은 추론 수준을 사용한다", () => {
  const request = buildSurveyAiRequest(
    "첨부 자료를 토대로 학생 지원 서비스 수요를 조사해줘",
    analyzeSurveyPrompt("학생 지원 서비스 수요 조사"),
    "gpt-5.6",
    {
      questionCount: 7,
      references: {
        images: [],
        files: [
          {
            name: "학생 지원 기획서.pdf",
            mimeType: "application/pdf",
            fileId: "file-reference-depth",
          },
        ],
        links: [],
      },
    },
  );

  assert.equal(request.reasoning.effort, "high");
  const schema = request.text.format.schema as {
    properties: {
      survey: { properties: { questions: { minItems: number; maxItems: number } } };
    };
  };
  assert.equal(
    schema.properties.survey.properties.questions.minItems,
    7,
  );
  assert.match(request.instructions, /근거 연결/);
  assert.match(request.instructions, /조사 구조/);
});

test("첨부자료가 한 문항에만 형식적으로 연결된 결과는 거부한다", () => {
  const prompt = "첨부 보고서 기반 학생 지원 서비스 수요 조사";
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `학생 지원 서비스 질문 ${index + 1}`),
  );
  const payload = readyPayload({
    prompt,
    evaluationTarget: "학생 지원 서비스",
    respondentGroup: "연세대학교 재학생",
    entityType: "service",
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    sourceUrls: ["https://example.com/student-support"],
  });
  editReadyPayload(payload, (result) => {
    const designPlan = result.designPlan as Record<string, unknown>;
    designPlan.referenceGrounding = [
      {
        sourceLabel: "학생 지원 보고서",
        insight: "지원 신청 과정의 정보 격차가 핵심 문제입니다.",
        questionIds: [1],
      },
    ];
  });

  assert.throws(
    () =>
      parseSurveyDraftResponse(payload, prompt, 7, "전학년", true),
    /충분히 반영되지 않았습니다/,
  );
});

test("같은 척도와 역할을 반복한 단조로운 AI 설문은 거부한다", () => {
  const prompt = "학생 지원 서비스 만족도 조사";
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `학생 지원 서비스 세부 만족도 ${index + 1}`),
  );
  const payload = readyPayload({
    prompt,
    evaluationTarget: "학생 지원 서비스",
    respondentGroup: "연세대학교 재학생",
    entityType: "service",
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    sourceUrls: ["https://example.com/student-support"],
  });
  editReadyPayload(payload, (result) => {
    result.aiQuestions = questions;
    const designPlan = result.designPlan as Record<string, unknown>;
    designPlan.questionRoles = questions.map(() => "specific-dimension");
  });

  assert.throws(
    () => parseSurveyDraftResponse(payload, prompt),
    /문항의 역할이 단조롭습니다|문항 유형이 단조롭습니다/,
  );
});

test("7문항은 자유응답 없이도 목적에 맞는 객관식과 척도형 조합을 허용한다", () => {
  const prompt =
    "현재 국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험을 분석하고 싶어";
  const questions = [
    question(1, "최근 3개월 이내 네이버 웹툰을 이용한 적이 있나요?", "single", ["예", "아니요"]),
    question(2, "최근 1개월 동안 네이버 웹툰을 얼마나 자주 이용했나요?", "single", ["월 1회 미만", "월 1~3회", "주 1~2회", "주 3회 이상"]),
    question(3, "네이버 웹툰을 한 번 이용할 때 평균적으로 얼마나 오래 이용하나요?", "single", ["10분 미만", "10분 이상 30분 미만", "30분 이상 1시간 미만", "1시간 이상"]),
    question(4, "네이버 웹툰을 주로 어떤 상황에서 이용하나요?", "multiple", ["통학할 때", "쉬는 시간", "잠들기 전", "기타"]),
    question(5, "네이버 웹툰에서 주로 감상하는 콘텐츠 장르를 골라주세요.", "multiple", ["로맨스", "판타지", "액션", "드라마", "기타"]),
    question(6, "네이버 웹툰의 전반적인 이용 경험에 얼마나 만족하시나요?", "scale"),
    question(7, "네이버 웹툰을 이용하면서 불편했던 점을 골라주세요.", "multiple", ["작품 탐색", "광고", "결제 부담", "앱 사용성", "특별히 없음"]),
  ];

  const parsed = parseSurveyDraftResponse(
    readyPayload({
      prompt,
      evaluationTarget: "네이버 웹툰",
      respondentGroup: "대학생",
      entityType: "service",
      templateQuestions: questions.slice(0, 5),
      aiQuestions: questions,
      sourceUrls: ["https://comic.naver.com"],
    }),
    prompt,
  );

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    assert.equal(parsed.blueprint.aiQuestions.some((item) => item.type === "text"), false);
  }
});

test("항목명처럼 끝난 AI 문항을 응답 가능한 질문 문장으로 다듬는다", () => {
  const prompt = "학생지원센터 상담 예약 경험 조사";
  const questions = [
    question(1, "학생지원센터 상담 이용 단계", "single", ["예약 전", "예약 완료", "상담 완료"]),
    question(2, "예약을 끝내기 어렵게 만든 요인", "multiple", ["시간 탐색", "안내 부족"]),
    question(3, "첫 상담까지 걸린 시간", "single", ["1일 이내", "1주 이내", "1주 초과"]),
    question(4, "상담 유형 선택의 명확성", "single", ["명확함", "보통", "불명확함"]),
    question(5, "실시간 잔여시간 표시의 도움 정도", "scale"),
    question(6, "가장 먼저 개선해야 할 기능", "single", ["잔여시간", "유형 추천"]),
    question(7, "예약 과정에서 바꿔야 할 한 가지", "text"),
  ];
  const parsed = parseSurveyDraftResponse(
    readyPayload({
      prompt,
      evaluationTarget: "학생지원센터 상담 예약 경험",
      respondentGroup: "연세대학교 재학생",
      entityType: "service",
      templateQuestions: questions.slice(0, 5),
      aiQuestions: questions,
      sourceUrls: ["https://example.com/student-support"],
    }),
    prompt,
    7,
    "전학년",
    true,
  );

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    const titles = parsed.blueprint.aiQuestions.map((item) => item.title);
    assert.match(titles[0], /골라주세요\.$/);
    assert.doesNotMatch(titles[0], /경험을 직접 이용/);
    assert.match(titles[1], /모두 골라주세요\.$/);
    assert.match(titles[4], /어느 정도인가요\?$/);
    assert.match(titles[6], /구체적으로 적어주세요\.$/);
  }
});

test("업로드된 큰 파일은 Base64 대신 OpenAI file_id로 전달한다", () => {
  const request = buildSurveyAiRequest(
    "첨부 보고서를 참고해 만족도 조사를 만들어줘",
    analyzeSurveyPrompt("첨부 보고서를 참고해 만족도 조사를 만들어줘"),
    "gpt-5.6",
    {
      references: {
        images: [],
        files: [
          {
            name: "학생생활 보고서.pdf",
            mimeType: "application/pdf",
            fileId: "file-reference123",
          },
        ],
        links: [],
      },
    },
  );

  const serialized = JSON.stringify(request.input);
  assert.match(serialized, /"file_id":"file-reference123"/);
  assert.doesNotMatch(serialized, /file_data/);
});

test("참고 파일은 개당 10MB, 전체 20MB 한도를 사용한다", () => {
  assert.equal(maxReferenceFileBytes, 10 * 1024 * 1024);
  assert.equal(maxReferenceFilesTotalBytes, 20 * 1024 * 1024);
  assert.ok(
    normalizedReferenceFile(
      "강의자료.pdf",
      "application/pdf",
      maxReferenceFileBytes,
    ),
  );
  assert.equal(
    normalizedReferenceFile(
      "강의자료.pdf",
      "application/pdf",
      maxReferenceFileBytes + 1,
    ),
    null,
  );
});

test("큰 참고 파일은 조각 업로드 후 설문 생성에 file_id로 연결된다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousSecret = process.env.BAROFORM_REFERENCE_SECRET;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPostgresUrl = process.env.POSTGRES_URL;
  const previousNeonUrl = process.env.NEON_DATABASE_URL;
  const previousFetch = globalThis.fetch;
  const prompt = "업로드한 보고서를 참고한 학생 서비스 만족도 조사";
  const fileSize = 32;
  let responseRequest: Record<string, unknown> | null = null;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.BAROFORM_REFERENCE_SECRET = "test-reference-secret";
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.NEON_DATABASE_URL;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/uploads")) {
      return Response.json({ id: "upload_reference123" });
    }
    if (url.endsWith("/v1/uploads/upload_reference123/parts")) {
      assert.ok(init?.body instanceof FormData);
      return Response.json({ id: "part_reference123" });
    }
    if (url.endsWith("/v1/uploads/upload_reference123/complete")) {
      return Response.json({
        file: { id: "file-reference123", bytes: fileSize },
      });
    }
    if (url.endsWith("/v1/responses")) {
      responseRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const questions = Array.from({ length: 7 }, (_, index) =>
        question(index + 1, `학생 서비스 질문 ${index + 1}`),
      );
      return Response.json(
        readyPayload({
          prompt,
          evaluationTarget: "학생 서비스",
          respondentGroup: "연세대학교 재학생",
          entityType: "service",
          templateQuestions: questions.slice(0, 5),
          aiQuestions: questions,
          sourceUrls: ["https://example.com/reference-file"],
        }),
      );
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const startResponse = await startReferenceUpload(
      new Request("http://localhost/api/reference-files", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-large-file-test",
        },
        body: JSON.stringify({
          name: "학생 서비스 보고서.pdf",
          mimeType: "application/pdf",
          size: fileSize,
        }),
      }),
    );
    assert.equal(startResponse.status, 200);
    const startResult = (await startResponse.json()) as {
      uploadId: string;
      uploadToken: string;
    };

    const partResponse = await uploadReferencePart(
      new Request(
        `http://localhost/api/reference-files/${startResult.uploadId}/parts`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${startResult.uploadToken}`,
            "content-type": "application/octet-stream",
            origin: "http://localhost",
          },
          body: new Uint8Array(fileSize),
        },
      ),
      { params: Promise.resolve({ uploadId: startResult.uploadId }) },
    );
    assert.equal(partResponse.status, 200);
    const partResult = (await partResponse.json()) as { partId: string };

    const completeResponse = await completeReferenceUpload(
      new Request(
        `http://localhost/api/reference-files/${startResult.uploadId}/complete`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${startResult.uploadToken}`,
            "content-type": "application/json",
            origin: "http://localhost",
          },
          body: JSON.stringify({ partIds: [partResult.partId] }),
        },
      ),
      { params: Promise.resolve({ uploadId: startResult.uploadId }) },
    );
    assert.equal(completeResponse.status, 200);
    const completeResult = (await completeResponse.json()) as {
      fileToken: string;
    };
    assert.ok(await verifyReferenceFileToken(completeResult.fileToken));

    const draftResponse = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-large-file-draft-test",
        },
        body: JSON.stringify({
          prompt,
          targetGrade: "전학년",
          questionCount: 7,
          references: {
            images: [],
            files: [{ fileToken: completeResult.fileToken }],
            links: [],
          },
        }),
      }),
    );
    assert.equal(
      draftResponse.status,
      200,
      JSON.stringify(await draftResponse.clone().json()),
    );
    const sentRequest = responseRequest as Record<string, unknown> | null;
    assert.ok(sentRequest);
    assert.match(JSON.stringify(sentRequest.input), /"file_id":"file-reference123"/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
    if (previousSecret) process.env.BAROFORM_REFERENCE_SECRET = previousSecret;
    else delete process.env.BAROFORM_REFERENCE_SECRET;
    if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    else delete process.env.DATABASE_URL;
    if (previousPostgresUrl) process.env.POSTGRES_URL = previousPostgresUrl;
    else delete process.env.POSTGRES_URL;
    if (previousNeonUrl) process.env.NEON_DATABASE_URL = previousNeonUrl;
    else delete process.env.NEON_DATABASE_URL;
  }
});

test("설문 생성 API가 첨부 파일 본문을 OpenAI 요청에 보존한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  const prompt = "첨부 파일 기반 신규 서비스 수요 조사";
  const fileData = `data:application/pdf;base64,${Buffer.from("baroform product brief").toString("base64")}`;
  let upstreamRequest: Record<string, unknown> | null = null;
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `신규 서비스 수요 질문 ${index + 1}`),
  );
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    upstreamRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json(
      readyPayload({
        prompt,
        evaluationTarget: "신규 서비스",
        respondentGroup: "연세대학교 재학생",
        entityType: "service",
        templateQuestions: questions.slice(0, 5),
        aiQuestions: questions,
        sourceUrls: ["https://example.com/reference"],
      }),
    );
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-reference-file-test",
        },
        body: JSON.stringify({
          prompt,
          targetGrade: "전학년",
          questionCount: 7,
          references: {
            images: [],
            files: [
              {
                name: "서비스 기획서.pdf",
                mimeType: "application/pdf",
                dataUrl: fileData,
              },
            ],
            links: [],
          },
        }),
      }),
    );

    assert.equal(response.status, 200);
    const sentRequest = upstreamRequest as Record<string, unknown> | null;
    assert.ok(sentRequest);
    assert.match(JSON.stringify(sentRequest.input), /input_file/);
    assert.match(JSON.stringify(sentRequest.input), /서비스 기획서\.pdf/);
    assert.equal(JSON.stringify(sentRequest.input).includes(fileData), true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API가 사용자가 지정한 공개 링크를 AI 조사 요청에 보존한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  const link = "https://www.yonsei.ac.kr/sc/366/subview.do";
  let upstreamRequest: Record<string, unknown> | null = null;
  const prompt = "한경관 식당 만족도 조사를 만들어줘";
  const questions = [
    question(1, "최근 한경관 식당에서 식사한 적이 있나요?", "single", ["예", "아니요"]),
    question(2, "한경관 음식의 맛과 품질에 얼마나 만족하나요?"),
    question(3, "한경관 메뉴 다양성에 얼마나 만족하나요?"),
    question(4, "가격 대비 음식의 양에 얼마나 만족하나요?"),
    question(5, "배식 대기시간은 적절했나요?"),
    question(6, "위생과 좌석 혼잡 중 개선할 점을 골라주세요.", "multiple", ["위생", "좌석", "혼잡"]),
    question(7, "한경관 식당에 바라는 점을 적어주세요.", "text"),
  ];
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    upstreamRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json(
      readyPayload({
        prompt,
        evaluationTarget: "한경관 식당",
        respondentGroup: "한경관 식당 이용자",
        entityType: "cafeteria",
        templateQuestions: questions.slice(0, 5),
        aiQuestions: questions,
        sourceUrls: [link],
      }),
    );
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-reference-link-test",
        },
        body: JSON.stringify({
          prompt,
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], links: [link] },
        }),
      }),
    );

    assert.equal(response.status, 200);
    const sentRequest = upstreamRequest as Record<string, unknown> | null;
    assert.ok(sentRequest);
    assert.equal(sentRequest.tool_choice, "required");
    assert.match(JSON.stringify(sentRequest.input), /yonsei\.ac\.kr/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("사용자가 고른 학년과 문항 수를 AI 생성 계약에 반영한다", () => {
  const prompt = "대우관 등하교 경험 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
    { targetGrade: "3-4학년", questionCount: 12 },
  );

  assert.match(requestInputText(request.input), /3-4학년/);
  assert.match(requestInputText(request.input), /\[희망 문항 수\]\s+12/);
  const schema = request.text.format.schema as {
    properties: {
      survey: { properties: { questions: { minItems: number; maxItems: number } } };
    };
  };
  assert.equal(schema.properties.survey.properties.questions.minItems, 12);
  assert.equal(schema.properties.survey.properties.questions.maxItems, 12);
});

test("학년 적격성과 시설 이용 경험을 서로 다른 문항으로 분리한다", () => {
  const original = [
    question(
      1,
      "현재 연세대학교 신촌캠퍼스 전학년 재학생이며, 최근 1학기 내 중앙도서관을 이용한 적이 있습니까?",
      "single",
      ["예", "아니요"],
    ),
    ...Array.from({ length: 6 }, (_, index) =>
      question(index + 2, `중앙도서관 이용 경험 질문 ${index + 1}`),
    ),
  ];

  const questions = applyTargetGradeToQuestions(original, "1학년", 7);

  assert.equal(
    questions[0]?.title,
    "귀하는 현재 연세대학교 1학년 재학생입니까?",
  );
  assert.equal(
    questions[1]?.title,
    "최근 1학기 내 중앙도서관을 이용한 적이 있습니까?",
  );
  assert.equal(questions.length, 7);
  assert.doesNotMatch(
    questions.map((item) => item.title).join(" "),
    /전학년 재학생|재학생이며/,
  );
});

test("전학년 선택은 자연스러운 재학생 표현으로 정리한다", () => {
  const questions = applyTargetGradeToQuestions(
    [
      question(
        1,
        "현재 연세대학교 신촌캠퍼스 전학년 재학생이며, 최근 중앙도서관을 이용한 적이 있습니까?",
        "single",
        ["예", "아니요"],
      ),
      question(2, "중앙도서관 좌석은 편리했습니까?"),
      question(3, "개선이 필요한 점을 알려주세요.", "text"),
    ],
    "전학년",
    3,
  );

  assert.equal(
    questions[0]?.title,
    "최근 중앙도서관을 이용한 적이 있습니까?",
  );
  assert.doesNotMatch(
    questions.map((item) => item.title).join(" "),
    /전학년 재학생/,
  );
});

test("AI 수정 요청은 현재 설문 전체를 보존 가능한 구조로 전달한다", () => {
  const currentQuestions = [
    question(1, "대우관을 오가는 빈도는 어느 정도인가요?", "single", ["매일", "주 1~2회"]),
    question(2, "이동에 걸리는 시간은 어느 정도인가요?"),
  ];
  const request = buildSurveyRevisionRequest({
    model: "gpt-5.6",
    title: "대우관 등하교 경험 조사",
    description: "이동 경험을 조사합니다.",
    questions: currentQuestions,
    instruction: "날씨 관련 질문을 하나 추가해줘",
    targetGrade: "전학년",
  });

  assert.match(request.input, /날씨 관련 질문/);
  assert.match(request.input, /대우관을 오가는 빈도/);
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
});

test("AI 수정 결과에서 확장 문항 유형과 설정을 정규화한다", () => {
  const revised = parseSurveyRevisionResponse({
    status: "completed",
    output_text: JSON.stringify({
      title: "수정된 설문",
      description: "수정된 안내",
      message: "날짜 질문을 추가했어요.",
      questions: [
        {
          id: 8,
          title: "등교 날짜를 선택해주세요.",
          description: "가장 최근 날짜",
          reason: "최근 경험을 구분합니다.",
          type: "date",
          options: [],
          required: true,
          shuffleOptions: false,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: "",
          scaleMaxLabel: "",
        },
      ],
    }),
  });

  assert.equal(revised.questions[0].id, 1);
  assert.equal(revised.questions[0].type, "date");
  assert.equal(revised.questions[0].required, true);
});

test("표시 한도를 넘는 실제 검색 출처도 사실 검증에 사용할 수 있다", () => {
  const sources = Array.from(
    { length: 6 },
    (_, index) => `https://example${index + 1}.com/source`,
  );
  const template = Array.from({ length: 5 }, (_, index) =>
    question(index + 1, `서비스 경험 질문 ${index + 1}`),
  );
  const ai = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `서비스 심층 질문 ${index + 1}`),
  );
  const parsed = parseSurveyDraftResponse(
    readyPayload({
      prompt: "새 서비스 만족도 조사",
      evaluationTarget: "새 서비스",
      respondentGroup: "서비스 이용자",
      entityType: "other",
      templateQuestions: template,
      aiQuestions: ai,
      sourceUrls: sources,
      factSourceUrl: sources[5],
    }),
    "새 서비스 만족도 조사",
  );

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    assert.equal(parsed.research.sources.length, 5);
    assert.equal(parsed.research.facts.length, 1);
  }
});

test("응답자 설명 속 맛나샘이 학교생활 평가 대상을 덮어쓰지 않는다", () => {
  const template = [
    question(1, "현재 학교생활 경험이 있나요?", "single", ["예", "아니요"]),
    question(2, "학교생활 전반에 얼마나 만족하나요?"),
    question(3, "수업과 학업 경험에 얼마나 만족하나요?"),
    question(4, "학교 안내와 지원은 충분했나요?"),
    question(5, "학교생활에서 가장 개선할 점은 무엇인가요?", "text"),
  ];
  const ai = [
    question(1, "현재 학교생활을 경험하고 있나요?", "single", ["예", "아니요"]),
    question(2, "학교생활 전체 만족도는 어느 정도인가요?"),
    question(3, "수업 및 학업 지원에 만족하나요?"),
    question(4, "교우 관계와 소속감에 만족하나요?"),
    question(5, "학교 안내와 행정 지원에 만족하나요?"),
    question(6, "앞으로 학교생활을 추천할 의향이 있나요?"),
    question(7, "구체적인 개선 의견을 적어주세요.", "text"),
  ];
  const parsed = parseSurveyDraftResponse(
    readyPayload({
      prompt: "맛나샘 이용자들의 학교생활 만족도",
      evaluationTarget: "학교생활",
      respondentGroup: "맛나샘 이용자",
      entityType: "student-life",
      templateQuestions: template,
      aiQuestions: ai,
      sourceUrls: ["https://www.yonsei.ac.kr/source"],
    }),
    "맛나샘 이용자들의 학교생활 만족도",
  );

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    assert.equal(parsed.blueprint.domain, "student-life");
    const corpus = parsed.blueprint.aiQuestions
      .flatMap((item) => [item.title, ...(item.options ?? [])])
      .join(" ");
    assert.equal(/맛|메뉴|가격|배식/.test(corpus), false);
  }
});

test("API 키가 없고 목적이 짧은 고유명사도 합리적 가정으로 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ prompt: "맛나샘" }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      clarification?: unknown;
      blueprint?: { aiQuestions?: unknown[] };
    };
    assert.equal(response.status, 200);
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.ok((body.blueprint?.aiQuestions?.length ?? 0) > 0);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  }
});

test("대상과 측정 내용이 명확한 빈도 조사는 추가 질문 없이 바로 만든다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const prompt =
      "연세대 학생들이 학교에서 집 가고 싶다는 생각을 하는 빈도 조사";
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-literal-frequency-test",
        },
        body: JSON.stringify({ prompt }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      clarification?: unknown;
      blueprint?: {
        respondentGroup?: string;
        aiQuestions?: Array<{ title: string }>;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.match(
      body.blueprint?.respondentGroup ?? "",
      /연세대(?:학교)?\s*(?:재)?학생/,
    );
    assert.equal(
      body.blueprint?.aiQuestions?.[0]?.title,
      "최근 1개월 동안 학교에서 집 가고 싶다는 생각이 얼마나 자주 드나요?",
    );
    assert.doesNotMatch(
      body.blueprint?.aiQuestions?.map((item) => item.title).join(" ") ?? "",
      /학년|학과/,
    );
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  }
});

test("API 키가 없어도 학생 소비 습관은 목적을 되묻지 않고 바로 만든다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-consumption-habits-test",
        },
        body: JSON.stringify({
          prompt: "학생들의 소비 습관을 조사하라",
          targetGrade: "전학년",
          questionCount: 7,
        }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      clarification?: unknown;
      blueprint?: {
        title?: string;
        aiQuestions?: Array<{ title: string; options?: string[] }>;
      };
    };
    const corpus =
      body.blueprint?.aiQuestions
        ?.flatMap((item) => [item.title, ...(item.options ?? [])])
        .join(" ") ?? "";

    assert.equal(response.status, 200);
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.clarification, undefined);
    assert.equal(body.blueprint?.title, "학생 소비 습관 조사");
    assert.match(corpus, /생활비/);
    assert.match(corpus, /결제 수단/);
    assert.doesNotMatch(corpus, /무엇을 알아보고|만족도와 개선점|참여 의향/);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  }
});

test("AI가 명확한 빈도 조사에 재질문하면 재생성 대상으로 거부한다", () => {
  const prompt =
    "연세대 학생들이 학교에서 집 가고 싶다는 생각을 하는 빈도 조사";
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `집에 가고 싶다는 생각의 빈도 질문 ${index + 1}`),
  );
  const payload = readyPayload({
    prompt,
    evaluationTarget: "학교에서 집에 가고 싶다는 생각의 빈도",
    respondentGroup: "연세대 학생",
    entityType: "other",
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    sourceUrls: ["https://www.yonsei.ac.kr/source"],
  });
  editReadyPayload(payload, (result) => {
    result.status = "needs_clarification";
    result.question = "어느 학과 학생을 대상으로 할까요?";
    result.reason = "세부 대상을 확인해야 합니다.";
    result.options = ["인문계열", "자연계열", "전체"];
    result.interpretation = {
      ...(result.interpretation as Record<string, unknown>),
      searchRequired: false,
    };
  });

  assert.throws(
    () => parseSurveyDraftResponse(payload, prompt),
    /불필요한 확인 질문/,
  );
});

test("AI가 소비 습관 조사 목적을 되물으면 재생성 대상으로 거부한다", () => {
  const prompt = "학생들의 소비 습관을 조사하라";
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `소비 습관 질문 ${index + 1}`),
  );
  const payload = readyPayload({
    prompt,
    evaluationTarget: "소비 습관",
    respondentGroup: "학생",
    entityType: "other",
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    sourceUrls: ["https://example.com/source"],
  });
  editReadyPayload(payload, (result) => {
    result.status = "needs_clarification";
    result.question = "소비 습관에 대해 무엇을 알아보고 싶나요?";
    result.reason = "조사 방향을 확인해야 합니다.";
    result.options = ["만족도와 개선점", "수요와 참여 의향", "경험과 불편 사항"];
    result.interpretation = {
      ...(result.interpretation as Record<string, unknown>),
      searchRequired: false,
    };
  });

  assert.throws(
    () => parseSurveyDraftResponse(payload, prompt),
    /불필요한 확인 질문/,
  );
});

test("검색 출처를 확인하지 못해도 주의 상태의 완성 설문을 반환한다", () => {
  const prompt = "프로메테우스 만족도 조사";
  const questions = Array.from({ length: 7 }, (_, index) =>
    question(index + 1, `프로메테우스 경험 질문 ${index + 1}`),
  );
  const payload = readyPayload({
    prompt,
    evaluationTarget: "프로메테우스",
    respondentGroup: "프로메테우스 경험자",
    entityType: "other",
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    sourceUrls: ["https://example.com/source"],
  });
  payload.output.splice(0, 1);

  const parsed = parseSurveyDraftResponse(payload, prompt);

  assert.equal(parsed.status, "ready_with_caution");
  assert.equal(parsed.research.status, "fallback");
  assert.equal(parsed.research.classification, "unresolved");
  assert.equal(parsed.research.sources.length, 0);
  assert.match(parsed.research.limitations?.join(" ") ?? "", /검색을 완료하지 못해/);
});

test("AI 연결이 없어도 방향이 명확한 입력은 문맥 기반 초안을 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-clear-fallback-test",
        },
        body: JSON.stringify({
          prompt: "도서관 좌석 이용 만족도 조사",
          targetGrade: "3-4학년",
          questionCount: 9,
        }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      blueprint?: {
        aiQuestions?: Array<{ title: string }>;
        description?: string;
        respondentGroup?: string;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.blueprint?.aiQuestions?.length, 9);
    assert.match(
      body.blueprint?.respondentGroup ?? "",
      /3학년 또는 4학년/,
    );
    assert.equal(
      body.blueprint?.aiQuestions?.[0]?.title,
      "귀하는 현재 연세대학교 3학년 또는 4학년 재학생입니까?",
    );
    assert.match(
      body.blueprint?.description ?? "",
      /^연세대학교 3학년 또는 4학년 재학생을 대상으로,/,
    );
    assert.doesNotMatch(
      body.blueprint?.aiQuestions?.map((item) => item.title).join(" ") ?? "",
      /(이용|사용|수강|참여|경험)(?:을|를)\s*(?:직접\s*)?\1|재학생이며/,
    );
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  }
});

test("단일 AI 결과 형식이 실패해도 두 번째 호출 없이 주의 상태의 초안을 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let fetchCalls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return Response.json({ status: "completed", output: [] });
  };
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-invalid-result-fallback-test",
        },
        body: JSON.stringify({
          prompt: "신입생 학교생활 적응 만족도 조사",
          questionCount: 7,
        }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      research?: { classification?: string; limitations?: string[] };
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ready_with_caution");
    assert.equal(body.research?.classification, "unresolved");
    assert.ok((body.research?.limitations?.length ?? 0) > 0);
    assert.equal(fetchCalls, 1);
    assert.equal(response.headers.get("x-baroform-ai-mode"), "verified-fallback");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("대우관 등하교 의견은 의견 자체가 아니라 이동 경험으로 해석한다", () => {
  const draft = analyzeSurveyPrompt("대우관 등하교에 대한 의견 조사");

  assert.equal(draft.title, "대우관 등하교 의견 조사");
  assert.equal(draft.evaluationTarget, "대우관 등하교 경험");
  assert.match(draft.templateQuestions[0].title, /대우관으로 등교하거나 대우관에서 하교한 빈도/);
  assert.doesNotMatch(draft.templateQuestions[0].title, /의견.*(?:이용|사용)/);
});

test("한경관 만족도는 건물 시설이 아니라 식당 경험으로 해석한다", () => {
  const draft = analyzeSurveyPrompt("한경관 만족도 조사");
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.equal(draft.domain, "cafeteria");
  assert.equal(draft.evaluationTarget, "한경관");
  assert.match(draft.aiQuestions[0].title, /한경관 식당에서 식사한 적/);
  assert.match(corpus, /맛|음식/);
  assert.match(corpus, /메뉴/);
  assert.match(corpus, /가격|양/);
  assert.match(corpus, /대기|위생|좌석|혼잡/);
  assert.doesNotMatch(corpus, /강의실|학습공간|엘리베이터/);
});

test("한경관은 사전 힌트를 사실로 단정하지 않고 식당 맥락 검색 대상으로 전달된다", () => {
  const prompt = "한경관 만족도 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );

  const input = requestInputText(request.input);
  assert.match(input, /"fallbackDomain":"cafeteria"/);
  assert.doesNotMatch(input, /연세대학교 한경관\(어울샘식당\)/);
  assert.match(
    request.instructions,
    /검색 결과 제목이나 검색 요약만 읽고 사실을 확정하지 않는다/,
  );
});

test("대우관 등하교 설문은 실제 이동 불편과 개선 요소를 다룬다", () => {
  const draft = analyzeSurveyPrompt("대우관 등하교에 대한 의견 조사");
  const corpus = draft.aiQuestions
    .flatMap((item) => [item.title, ...(item.options ?? [])])
    .join(" ");

  assert.match(corpus, /거리/);
  assert.match(corpus, /소요시간/);
  assert.match(corpus, /오르막|계단/);
  assert.match(corpus, /날씨/);
  assert.match(corpus, /혼잡/);
  assert.match(corpus, /보행.*안전/);
  assert.match(corpus, /셔틀|대중교통/);
});

test("AI가 의견을 이용 대상으로 만든 결과는 폐기한다", () => {
  const badQuestions = Array.from({ length: 7 }, (_, index) =>
    question(
      index + 1,
      index === 0
        ? "이번 학기에 대우관 등하교에 대한 의견을 직접 이용한 적이 있나요?"
        : `대우관 이동 관련 질문 ${index + 1}`,
    ),
  );
  const badTemplate = badQuestions.slice(0, 5).map((item, index) => ({
    ...item,
    id: index + 1,
  }));

  assert.throws(
    () =>
      parseSurveyDraftResponse(
        readyPayload({
          prompt: "대우관 등하교에 대한 의견 조사",
          evaluationTarget: "대우관 등하교에 대한 의견",
          respondentGroup: "대우관 등하교 경험자",
          entityType: "building",
          templateQuestions: badTemplate,
          aiQuestions: badQuestions,
          sourceUrls: ["https://www.yonsei.ac.kr/source"],
        }),
        "대우관 등하교에 대한 의견 조사",
      ),
    /조사 방식 표현|이용 대상으로/,
  );
});

test("AI가 이용 시간을 서비스처럼 해석한 결과는 폐기한다", () => {
  const badQuestions = Array.from({ length: 7 }, (_, index) =>
    question(
      index + 1,
      index === 0
        ? "SNS 이용 시간을 얼마나 자주 사용하거나 이용하시나요?"
        : `SNS 이용 시간 관련 질문 ${index + 1}`,
    ),
  );

  assert.throws(
    () =>
      parseSurveyDraftResponse(
        readyPayload({
          prompt: "연세대학교 재학생 SNS 이용 시간 조사",
          evaluationTarget: "SNS 이용 시간",
          respondentGroup: "연세대학교 재학생",
          entityType: "other",
          templateQuestions: badQuestions.slice(0, 5),
          aiQuestions: badQuestions,
          sourceUrls: ["https://www.yonsei.ac.kr/source"],
        }),
        "연세대학교 재학생 SNS 이용 시간 조사",
      ),
    /측정 기준|측정 내용/,
  );
});
