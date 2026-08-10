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

test("설문 생성 API는 단순 비율 요청을 AI 호출 없이 최소 문항으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("단순 비율 조사에서 외부 AI를 호출하면 안 됩니다.");
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
      "direct-proportion",
    );
    assert.equal(allGrades.status, "ready");
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
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 명확한 카공 빈도를 AI 호출 없이 행동 문항으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("명확한 행동 빈도 조사에서 외부 AI를 호출하면 안 됩니다.");
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
      "direct-frequency",
    );
    assert.equal(body.status, "ready");
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
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 수면 시간 의견을 AI 호출 없이 생활시간 문항으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("명확한 수면 시간 조사에서 외부 AI를 호출하면 안 됩니다");
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
      "direct-sleep-duration",
    );
    assert.equal(body.status, "ready");
    assert.equal(body.clarification, undefined);
    assert.equal(body.blueprint.title, "대학생 수면 시간 조사");
    assert.equal(body.blueprint.aiQuestions.length, 7);
    assert.equal(
      body.blueprint.aiQuestions[0]?.title,
      "평일에 하루 평균 몇 시간 정도 자나요?",
    );
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("설문 생성 API는 명확한 SNS 이용 시간을 AI 호출 없이 시간 문항으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("명확한 이용 시간 조사에서 외부 AI를 호출하면 안 됩니다");
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
      "direct-duration",
    );
    assert.equal(body.status, "ready");
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
    assert.equal(upstreamCalled, false);
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
      status: "re…6218 tokens truncated…ons.map((item) => item.title).join(" "),
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

test("API 키가 없을 때 목적 없는 고유명사는 확인 질문을 반환한다", async () => {
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
    const body = (await response.json()) as { status?: string };
    assert.equal(response.status, 200);
    assert.equal(body.status, "needs_clarification");
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
    assert.equal(body.status, "ready");
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
    assert.equal(body.status, "ready");
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

test("검색이 필요하지만 출처를 확인하지 못하면 오류 대신 확인 질문을 반환한다", () => {
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

  assert.equal(parsed.status, "needs_clarification");
  if (parsed.status === "needs_clarification") {
    assert.match(parsed.clarification.question, /프로메테우스/);
    assert.equal(parsed.clarification.options.length, 3);
    assert.doesNotMatch(parsed.clarification.options.join(" "), /직접 설명|기타/);
  }
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
    assert.equal(body.status, "ready");
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

test("AI 결과 형식과 재생성이 모두 실패하면 명확한 오류를 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    Response.json({ status: "completed", output: [] });
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
    const body = (await response.json()) as { code?: string };

    assert.equal(response.status, 422);
    assert.equal(body.code, "SURVEY_REGENERATION_FAILED");
    assert.equal(response.headers.get("x-baroform-ai-mode"), null);
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

test("한경관 사전 검증 정보가 AI 요청에 식당 유형으로 전달된다", () => {
  const prompt = "한경관 만족도 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );

  assert.match(
    requestInputText(request.input),
    /연세대학교 한경관\(어울샘식당\)/,
  );
  assert.match(requestInputText(request.input), /"entityType":"cafeteria"/);
  assert.match(requestInputText(request.input), /음식의 맛과 품질/);
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

