import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { buildSurveyAiRequest } from "../app/survey-ai";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import {
  parseSurveyIntent,
  validateSurveyIntentCandidate,
} from "../app/survey-semantic-intent";

type RouteBlueprint = {
  title: string;
  subject: string;
  respondentGroup: string | null;
  aiQuestions: Array<{
    title: string;
    type: string;
    options?: string[];
  }>;
};

let requestSequence = 0;

async function generateThroughRoute(prompt: string) {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  requestSequence += 1;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": `baroform-semantic-regression-${requestSequence}`,
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
    const body = (await response.json()) as {
      status?: string;
      error?: string;
      blueprint?: RouteBlueprint;
    };
    assert.equal(
      response.headers.get("x-baroform-survey-engine"),
      "semantic-intent-v2",
    );
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.match(body.status ?? "", /^ready/);
    assert.ok(body.blueprint);
    return body.blueprint;
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

function questionCorpus(blueprint: RouteBlueprint) {
  return blueprint.aiQuestions
    .flatMap((question) => [question.title, ...(question.options ?? [])])
    .join(" ");
}

test("전 연령대 AI 사용능력 실태조사는 능력과 실제 활용을 측정한다", async () => {
  const prompt = "전 연령대 AI 사용능력 실태조사";
  const intent = parseSurveyIntent(prompt);
  const blueprint = await generateThroughRoute(prompt);
  const corpus = questionCorpus(blueprint);

  assert.equal(intent.targetPopulation, "전 연령대");
  assert.equal(intent.objectKind, "ability_skill");
  assert.equal(intent.explicitTimeframe, null);
  assert.equal(intent.screeningRequired, false);
  assert.equal(blueprint.aiQuestions[0]?.title, "연령대를 선택해 주세요.");
  assert.notDeepEqual(blueprint.aiQuestions[0]?.options, ["예", "아니요"]);
  assert.match(corpus, /수행할 수 있는 작업|사용하는 데 어느 정도 자신/);
  assert.match(corpus, /사용해 본 적 없음|사용하지 않음/);
  assert.doesNotMatch(corpus, /최근\s*3개월/);
  assert.doesNotMatch(corpus, /AI 사용능력 실태조사(?:를|을) 이용/);

  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );
  const requestText =
    typeof request.input === "string"
      ? request.input
      : JSON.stringify(request.input);
  assert.match(requestText, /\[구조화된 설문 의도\]/);
  assert.match(requestText, /"objectKind":"ability_skill"/);
  assert.match(requestText, /"screeningRequired":false/);
  assert.match(requestText, /"explicitTimeframe":null/);
});

test("비이용자를 포함한 AI 인식 조사는 인식·우려·의향을 묻는다", async () => {
  const blueprint = await generateThroughRoute(
    "AI를 사용해 본 적이 없는 사람까지 포함한 전 연령대 AI 인식 조사",
  );
  const corpus = questionCorpus(blueprint);

  assert.equal(blueprint.aiQuestions[0]?.title, "연령대를 선택해 주세요.");
  assert.match(corpus, /어느 정도 알고|우려되는 점|사용할 의향/);
  assert.match(corpus, /사용 경험 없음|사용해 본 적 없음|알지만 사용 경험 없음/);
  assert.doesNotMatch(corpus, /AI 인식 조사(?:를|을) (?:사용|이용)/);
});

test("명시된 최근 3개월 배달 앱 조사는 그 기간과 실제 서비스를 유지한다", async () => {
  const blueprint = await generateThroughRoute(
    "최근 3개월 배달 앱 이용 현황 조사",
  );
  const corpus = questionCorpus(blueprint);

  assert.equal(blueprint.subject, "배달 앱");
  assert.match(blueprint.aiQuestions[0]?.title ?? "", /^최근 3개월 배달 앱을 이용한 적/);
  assert.match(corpus, /최근 3개월/);
  assert.doesNotMatch(corpus, /배달 앱 이용 현황 조사(?:를|을) 이용/);
});

test("직장인 재택근무 만족도는 대상과 실제 경험을 분리한다", async () => {
  const blueprint = await generateThroughRoute(
    "직장인의 재택근무 만족도 조사",
  );
  const corpus = questionCorpus(blueprint);

  assert.equal(blueprint.respondentGroup, "직장인");
  assert.equal(blueprint.subject, "재택근무");
  assert.match(blueprint.aiQuestions[0]?.title ?? "", /재택근무를 직접 경험한 적/);
  assert.match(corpus, /재택근무에 전반적으로 얼마나 만족/);
  assert.doesNotMatch(corpus, /재택근무 만족도 조사(?:를|을) 이용/);
});

test("대학생 네이버웹툰 조사는 실제 서비스 이용을 허용한다", async () => {
  const blueprint = await generateThroughRoute(
    "대학생의 네이버웹툰 이용 현황 조사",
  );
  const corpus = questionCorpus(blueprint);

  assert.equal(blueprint.respondentGroup, "대학생");
  assert.match(blueprint.subject, /네이버\s*웹툰/);
  assert.match(corpus, /네이버\s*웹툰(?:을|를) 이용한 적/);
  assert.doesNotMatch(corpus, /네이버\s*웹툰 이용 현황 조사(?:를|을) 이용/);
});

test("카페 신메뉴를 먹어본 고객 조사는 자격 스크리너를 유지한다", async () => {
  const blueprint = await generateThroughRoute(
    "카페 신메뉴를 먹어본 고객의 만족도 조사",
  );
  const corpus = questionCorpus(blueprint);

  assert.match(blueprint.aiQuestions[0]?.title ?? "", /카페 신메뉴.*구매하거나 먹어본 경험/);
  assert.match(corpus, /카페 신메뉴에 전반적으로 얼마나 만족/);
  assert.doesNotMatch(corpus, /만족도 조사(?:를|을) (?:구매|먹|시식)/);
});

test("의도 검증기는 목적어·기간·대상 역할·불필요한 스크리너를 구분한다", () => {
  const intent = parseSurveyIntent("전 연령대 AI 사용능력 실태조사");
  const violations = validateSurveyIntentCandidate(intent, {
    questions: [
      {
        id: 1,
        title:
          "최근 3개월 이내 전 연령대 AI 사용능력 실태조사를 이용한 적이 있나요?",
        role: "screening",
        options: ["예", "아니요"],
      },
    ],
  });
  const codes = new Set(violations.map((violation) => violation.code));

  assert.ok(codes.has("SURVEY_PURPOSE_USED_AS_OBJECT"));
  assert.ok(codes.has("INVENTED_TIMEFRAME"));
  assert.ok(codes.has("INVALID_TARGET_ROLE"));
  assert.ok(codes.has("UNNECESSARY_SCREENING"));
});
