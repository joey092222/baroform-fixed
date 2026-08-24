import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  MAX_MODEL_CALLS_PER_REQUEST,
  MAX_REGENERATION_ATTEMPTS,
  MAX_REPAIR_ATTEMPTS,
} from "../app/survey-generation-trace";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import {
  parseSurveyIntent,
  validateSurveyIntentCandidate,
  type SurveyIntentQuestionCandidate,
} from "../app/survey-semantic-intent";

type RouteQuestion = {
  title: string;
  type: string;
  options?: string[];
};

type RouteBody = {
  ok: boolean;
  type: "survey" | "clarification" | "error";
  status?: string;
  requestId: string;
  code?: string;
  error?: string;
  blueprint?: {
    title: string;
    subject: string;
    respondentGroup: string | null;
    aiQuestions: RouteQuestion[];
  };
};

let routeRequestSequence = 0;

async function generateThroughLocalRoute(prompt: string) {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  routeRequestSequence += 1;
  const startedAt = performance.now();
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": `baroform-keyword-semantics-${routeRequestSequence}`,
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
    const elapsedMs = performance.now() - startedAt;
    const body = (await response.json()) as RouteBody;

    assert.notEqual(response.status, 500, JSON.stringify(body));
    assert.notEqual(body.code, "UNKNOWN_GENERATION_ERROR");
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.equal(body.type, "survey");
    assert.match(body.status ?? "", /^ready/);
    assert.ok(body.requestId);
    assert.ok(body.blueprint);
    assert.ok(elapsedMs < 10_000, `로컬 생성이 ${Math.round(elapsedMs)}ms 소요됨`);
    assert.equal(response.headers.get("x-baroform-model-calls"), "0");
    assert.equal(response.headers.get("x-baroform-regeneration-count"), "0");
    assert.ok(
      Number(response.headers.get("x-baroform-repair-count") ?? "0") <=
        MAX_REPAIR_ATTEMPTS,
    );
    return { body, response, elapsedMs };
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

function routeCorpus(body: RouteBody) {
  return (body.blueprint?.aiQuestions ?? [])
    .flatMap((question) => [question.title, ...(question.options ?? [])])
    .join(" ");
}

const routeCases = [
  {
    name: "온라인 설문 제작과 배포",
    prompt:
      "연세대학교 학생들이 과제나 연구를 위해 온라인 설문을 제작하고 배포하는 빈도와, 그 과정에서 겪는 불편을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /온라인 설문.*제작/);
      assert.match(corpus, /배포|공유/);
      assert.match(corpus, /응답자.*모집|참여자를 찾기/);
    },
  },
  {
    name: "온라인 폼 제작과 배포",
    prompt:
      "연세대학교 학생들이 과제나 연구를 위해 온라인 폼을 제작하고 배포하는 빈도와, 그 과정에서 겪는 불편을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /온라인 폼.*제작/);
      assert.match(corpus, /배포|공유/);
    },
  },
  {
    name: "질문지 제작과 배포",
    prompt:
      "대학생들이 수업 과제를 위해 질문지를 만들고 배포할 때 겪는 어려움을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      assert.match(routeCorpus(body), /질문지.*(?:제작|배포|공유)/);
    },
  },
  {
    name: "설문 참여",
    prompt:
      "연세대학교 학생들이 다른 사람이 만든 온라인 설문에 참여하는 빈도와 참여 과정에서 겪는 불편을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /온라인 설문.*참여/);
      assert.match(corpus, /빈도|얼마나 자주|드물게|가끔/);
      assert.match(corpus, /불편|어려움/);
    },
  },
  {
    name: "사용자 조사 수행",
    prompt:
      "대학생들이 프로젝트를 위해 사용자 조사를 수행할 때 겪는 어려움을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      assert.match(routeCorpus(body), /사용자 조사.*수행/);
    },
  },
  {
    name: "인터뷰 준비와 진행",
    prompt:
      "대학생들이 과제에서 인터뷰를 준비하고 진행할 때 겪는 어려움을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /인터뷰.*준비/);
      assert.match(corpus, /진행|수행/);
    },
  },
  {
    name: "사용성 테스트 참여",
    prompt:
      "대학생들의 앱 사용성 테스트 참여 경험과 불편 사항을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      assert.match(routeCorpus(body), /사용성 테스트.*참여/);
    },
  },
  {
    name: "AI 사용능력 실태조사",
    prompt: "전 연령대 AI 사용능력 실태조사",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /연령대/);
      assert.match(corpus, /AI 기반 도구.*사용|AI.*활용/);
      assert.doesNotMatch(corpus, /최근\s*3개월/);
      assert.doesNotMatch(corpus, /AI 사용능력 실태조사(?:를|을) 이용/);
    },
  },
  {
    name: "서비스 이용 현황",
    prompt:
      "대학생들의 네이버 웹툰 이용 현황과 불편 사항을 조사하고 싶어요",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /네이버\s*웹툰(?:을|를) 이용한 적/);
      assert.doesNotMatch(corpus, /네이버\s*웹툰 이용 현황.*조사(?:를|을) 이용/);
    },
  },
  {
    name: "명시된 기간 유지",
    prompt: "최근 3개월간 대학생들의 배달앱 이용 경험과 불편 사항 조사",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /최근\s*3개월/);
      assert.match(corpus, /배달\s*앱(?:을|를) 이용한 적/);
    },
  },
  {
    name: "정상적인 경험 스크리닝",
    prompt: "카페 신메뉴를 먹어본 고객 대상 만족도 조사",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /카페 신메뉴.*(?:구매|먹어본|시식)/);
      assert.doesNotMatch(corpus, /만족도 조사(?:를|을) (?:구매|먹|시식)/);
    },
  },
  {
    name: "비이용자 포함",
    prompt:
      "AI를 한 번도 사용하지 않은 사람까지 포함한 전 연령대 AI 인식 조사",
    assertResult(body: RouteBody) {
      const corpus = routeCorpus(body);
      assert.match(corpus, /연령대/);
      assert.match(corpus, /우려|신뢰|사용할 의향/);
      assert.doesNotMatch(corpus, /응답 종료|설문 종료/);
    },
  },
] as const;

test("12개 핵심 회귀 입력은 동일한 route에서 제한 시간 내 survey를 반환한다", async (t) => {
  const results = new Map<string, RouteBody>();
  for (const routeCase of routeCases) {
    await t.test(routeCase.name, async () => {
      const { body } = await generateThroughLocalRoute(routeCase.prompt);
      routeCase.assertResult(body);
      results.set(routeCase.name, body);
    });
  }

  const surveyIntent = parseSurveyIntent(routeCases[0].prompt);
  const formIntent = parseSurveyIntent(routeCases[1].prompt);
  assert.deepEqual(
    surveyIntent.activities.map((item) => item.activityKind),
    formIntent.activities.map((item) => item.activityKind),
  );
  assert.equal(results.get("온라인 설문 제작과 배포")?.type, "survey");
  assert.equal(results.get("온라인 폼 제작과 배포")?.type, "survey");
});

test("의미 validator는 정상 활동 문장을 단어와 무관하게 허용한다", () => {
  const validCases: Array<{
    prompt: string;
    question: SurveyIntentQuestionCandidate;
  }> = [
    {
      prompt: routeCases[0].prompt,
      question: { title: "온라인 설문을 직접 제작해 본 경험이 있습니까?" },
    },
    {
      prompt: routeCases[3].prompt,
      question: {
        title: "다른 사람이 만든 온라인 설문에 얼마나 자주 참여합니까?",
      },
    },
    {
      prompt: routeCases[0].prompt,
      question: {
        title: "온라인 설문을 배포할 때 가장 불편한 점은 무엇입니까?",
      },
    },
    {
      prompt: routeCases[4].prompt,
      question: { title: "사용자 조사를 직접 수행해 본 경험이 있습니까?" },
    },
    {
      prompt: routeCases[6].prompt,
      question: { title: "사용성 테스트에 참여해 본 경험이 있습니까?" },
    },
    {
      prompt: routeCases[5].prompt,
      question: { title: "인터뷰를 진행할 때 가장 어려운 점은 무엇입니까?" },
    },
    {
      prompt: "일반인의 AI 교육 수강 경험과 어려움 조사",
      question: { title: "AI 교육을 수강해 본 경험이 있습니까?" },
    },
    {
      prompt: "대학생의 온라인 설문 제작 도구 이용 경험 조사",
      question: {
        title: "온라인 설문 제작 도구를 사용해 본 경험이 있습니까?",
      },
    },
  ];

  for (const validCase of validCases) {
    const violations = validateSurveyIntentCandidate(
      parseSurveyIntent(validCase.prompt),
      { questions: [validCase.question] },
    );
    assert.deepEqual(violations, [], `${validCase.question.title}: ${JSON.stringify(violations)}`);
  }
});

test("의미 validator는 조사 제목이 행동 대상이 된 관계를 계속 차단한다", () => {
  const invalidCases = [
    {
      prompt: "전 연령대 AI 사용능력 실태조사",
      question: "AI 사용능력 실태조사를 이용한 적이 있습니까?",
      codes: ["SURVEY_PURPOSE_USED_AS_OBJECT"],
    },
    {
      prompt: "대학생의 학교생활 만족도 조사",
      question: "학교생활 만족도 조사를 사용해 본 경험이 있습니까?",
      codes: ["SURVEY_PURPOSE_USED_AS_OBJECT"],
    },
    {
      prompt: "친환경 제품 구매 인식 조사",
      question: "친환경 제품 구매 인식 조사를 구매한 적이 있습니까?",
      codes: ["SURVEY_PURPOSE_USED_AS_OBJECT"],
    },
    {
      prompt: "전 연령대 AI 사용능력 실태조사",
      question:
        "최근 3개월 이내 전 연령대의 AI 사용능력 실태조사를 이용했습니까?",
      codes: [
        "SURVEY_PURPOSE_USED_AS_OBJECT",
        "INVENTED_TIMEFRAME",
        "INVALID_TARGET_ROLE",
      ],
    },
  ] as const;

  for (const invalidCase of invalidCases) {
    const violations = validateSurveyIntentCandidate(
      parseSurveyIntent(invalidCase.prompt),
      { questions: [{ id: 1, title: invalidCase.question }] },
    );
    const codes = new Set(violations.map((item) => item.code));
    for (const code of invalidCase.codes) assert.ok(codes.has(code));
    assert.ok(violations.every((item) => item.severity === "repairable"));
  }
});

test("동의어 치환 320개 조합은 모두 같은 survey 결과 유형을 만든다", () => {
  const instruments = [
    "온라인 설문",
    "온라인 폼",
    "질문지",
    "설문지",
    "온라인 질문지",
  ];
  const creationPhrases = ["제작하고", "만들고", "작성하고", "구성하고"];
  const distributionPhrases = [
    "배포할",
    "공유할",
    "전달할",
    "응답자를 모집할",
  ];
  const purposes = [
    "불편을 조사하고 싶어요",
    "어려움을 파악하고 싶어요",
    "문제점을 알아보고 싶어요",
    "경험을 분석하고 싶어요",
  ];
  let count = 0;

  for (const instrument of instruments) {
    for (const creation of creationPhrases) {
      for (const distribution of distributionPhrases) {
        for (const purpose of purposes) {
          const prompt = `대학생들이 ${instrument}를 ${creation} ${distribution} 때 겪는 ${purpose}`;
          const intent = parseSurveyIntent(prompt);
          const blueprint = analyzeSurveyPrompt(prompt);
          const violations = validateSurveyIntentCandidate(intent, {
            questions: blueprint.aiQuestions,
          });

          assert.equal(intent.objectKind, "behavior_usage", prompt);
          assert.ok(intent.activities.length >= 2, prompt);
          assert.ok(blueprint.aiQuestions.length > 0, prompt);
          assert.deepEqual(violations, [], `${prompt}: ${JSON.stringify(violations)}`);
          count += 1;
        }
      }
    }
  }

  assert.equal(count, 320);
});

test("84개 대상·활동 조합은 로컬 경로에서 구조화된 결과로 종료한다", () => {
  const targets = [
    "대학생",
    "직장인",
    "전 연령대",
    "연세대학교 학생",
    "자취 중인 대학생",
    "앱 사용자",
    "비이용자를 포함한 일반인",
  ];
  const activities = [
    "온라인 설문 제작",
    "온라인 폼 배포",
    "질문지 작성",
    "사용자 조사 수행",
    "인터뷰 진행",
    "사용성 테스트 참여",
    "AI 도구 사용",
    "웹툰 이용",
    "배달앱 이용",
    "재택근무",
    "팀 프로젝트",
    "수업 발표",
  ];
  const constructs = [
    "빈도",
    "만족도",
    "불편",
    "어려움",
    "인식",
    "자신감",
    "이해도",
    "사용 의도",
    "중단 이유",
    "개선 요구",
  ];
  const purposes = [
    "조사하고 싶어요",
    "파악하고 싶어요",
    "분석하고 싶어요",
    "알아보고 싶어요",
    "비교하고 싶어요",
  ];
  const startedAt = performance.now();
  let count = 0;

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    for (let activityIndex = 0; activityIndex < activities.length; activityIndex += 1) {
      const construct = constructs[(targetIndex + activityIndex) % constructs.length];
      const purpose = purposes[(targetIndex * 2 + activityIndex) % purposes.length];
      const prompt = `${targets[targetIndex]}의 ${activities[activityIndex]} ${construct}를 ${purpose}`;

      assert.doesNotThrow(() => {
        const intent = parseSurveyIntent(prompt);
        const blueprint = analyzeSurveyPrompt(prompt);
        assert.ok(intent.studyTitle);
        assert.ok(blueprint.aiQuestions.length > 0);
        assert.doesNotMatch(blueprint.title, /undefined|null/i);
      }, prompt);
      count += 1;
    }
  }

  assert.equal(count, 84);
  assert.ok(performance.now() - startedAt < 10_000);
  assert.equal(MAX_REPAIR_ATTEMPTS, 1);
  assert.equal(MAX_REGENERATION_ATTEMPTS, 1);
  assert.equal(MAX_MODEL_CALLS_PER_REQUEST, 2);
});

test("한국어 공백·대소문자·연결 표현 차이가 결과 유형을 바꾸지 않는다", () => {
  const variants = [
    "온라인 설문을 제작하고 배포할 때 겪는 불편 조사",
    "온라인설문을 제작 및 배포할 때 겪는 불편 조사",
    "온라인 설문조사를 제작·배포할 때 겪는 불편 조사",
    "온라인 설문 조사를 만들어서 공유할 때 겪는 불편 조사",
    "AI 도구 사용 빈도 조사",
    "ai 도구 사용 빈도 조사",
    "Ai 기반 도구 사용 빈도 조사",
    "인공지능 도구 사용 빈도 조사",
    "네이버 웹툰 이용 현황 조사",
    "네이버웹툰 이용 현황 조사",
    "웹툰 플랫폼 이용 현황 조사",
  ];

  for (const prompt of variants) {
    const intent = parseSurveyIntent(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);
    assert.ok(intent.studyTitle, prompt);
    assert.ok(blueprint.aiQuestions.length > 0, prompt);
    assert.doesNotMatch(blueprint.title, /undefined|null/i);
  }
});
