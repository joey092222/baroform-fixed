import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { buildSurveyAiRequest } from "../app/survey-ai";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import {
  classifySurveyTopic,
  normalizeStructuredSurveyInput,
  topicCategoryAllowsExperienceScreener,
} from "../app/survey-request";

const aiAbilityInput = normalizeStructuredSurveyInput({
  topic: "생성형 AI 활용 능력과 사용 경험",
  target: "전 연령대의 일반인",
  objective: "연령대별 활용 수준과 교육 수요 파악",
  keyAspects: ["사용 여부", "이용 빈도", "활용 가능한 작업", "어려움", "교육 의향"],
  referencePeriod: "최근 3개월",
  context: "연령대별 결과 비교",
});

function requestText(request: ReturnType<typeof buildSurveyAiRequest>) {
  if (typeof request.input === "string") return request.input;
  return request.input
    .flatMap((message) => message.content)
    .filter((item) => item.type === "input_text")
    .map((item) => item.text)
    .join("\n");
}

test("사례별 조사 주제 유형을 목적에 맞게 분류한다", () => {
  assert.equal(classifySurveyTopic("맛나샘 이용 경험"), "place_facility");
  assert.equal(classifySurveyTopic("네이버웹툰 이용 현황"), "service_product");
  assert.equal(classifySurveyTopic("대학생활 만족도"), "satisfaction_evaluation");
  assert.equal(classifySurveyTopic("AI 활용 능력"), "ability_skill");
  assert.equal(classifySurveyTopic("심리상담 프로그램 이용 경험"), "event_program");
  assert.equal(topicCategoryAllowsExperienceScreener("place_facility"), true);
  assert.equal(topicCategoryAllowsExperienceScreener("service_product"), true);
  assert.equal(topicCategoryAllowsExperienceScreener("event_program"), true);
  assert.equal(topicCategoryAllowsExperienceScreener("ability_skill"), false);
  assert.equal(topicCategoryAllowsExperienceScreener("satisfaction_evaluation"), false);
});

test("모델 요청은 대상·주제·목적·기간을 별도 블록으로 전달한다", () => {
  const fallback = analyzeSurveyPrompt(aiAbilityInput.topic);
  const request = buildSurveyAiRequest(aiAbilityInput.topic, fallback, "gpt-test", {
    surveyMode: "standard",
    targetGrade: "전학년",
    questionCount: 7,
    structuredInput: aiAbilityInput,
    topicCategory: "ability_skill",
  });
  const input = requestText(request);

  assert.match(input, /\[조사 대상\]\n전 연령대의 일반인/);
  assert.match(input, /\[조사 주제\]\n생성형 AI 활용 능력과 사용 경험/);
  assert.match(input, /\[조사 목적\]\n연령대별 활용 수준과 교육 수요 파악/);
  assert.match(input, /\[기준 기간\]\n최근 3개월/);
  assert.match(input, /\[내부 주제 유형\]\nability_skill/);
  assert.match(input, /조사 주제 자체를 이용했는지 묻는 스크리너 생성 금지/);
  assert.equal("tools" in request, false);
  assert.doesNotMatch(
    input,
    /최근 3개월 이내 전 연령대 AI 사용능력 실태조사/,
  );
});

test("고유 시설은 구조화 입력에서도 검색하고 일반 능력 조사는 검색하지 않는다", () => {
  const placeInput = normalizeStructuredSurveyInput({
    topic: "맛나샘 이용 경험",
    target: "연세대학교 학부생",
    objective: "이용 경험과 개선점을 파악",
    keyAspects: ["이용 여부", "불편한 점"],
    referencePeriod: "이번 학기",
    context: "신촌캠퍼스",
  });
  const placeRequest = buildSurveyAiRequest(
    placeInput.topic,
    analyzeSurveyPrompt(placeInput.topic),
    "gpt-test",
    {
      surveyMode: "standard",
      questionCount: 7,
      structuredInput: placeInput,
      topicCategory: classifySurveyTopic(placeInput),
    },
  );
  assert.equal("tools" in placeRequest, true);
  assert.equal(placeRequest.tool_choice, "required");
});

test("구조화 입력 API는 능력 조사명을 이용 대상으로 만들지 않고 실제 행동을 분기한다", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          ...aiAbilityInput,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
        }),
      }),
    );
    const result = await response.json() as {
      blueprint?: { aiQuestions?: Array<{ title: string; showIf?: unknown[] }> };
      error?: string;
    };
    assert.equal(response.status, 200, result.error);
    const questions = result.blueprint?.aiQuestions ?? [];
    assert.equal(
      questions[0]?.title,
      "최근 3개월 동안 생성형 AI를 사용한 적이 있나요?",
    );
    assert.ok((questions[1]?.showIf?.length ?? 0) > 0);
    assert.doesNotMatch(
      questions.map((question) => question.title).join(" "),
      /AI 사용능력 실태조사를 이용한 적/,
    );
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});

test("일부 구조화 필드만 보낸 요청은 구체적인 입력 오류를 반환한다", async () => {
  const response = await createSurveyDraft(
    new Request("http://localhost/api/survey-draft", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ topic: "AI 활용 능력", surveyMode: "standard" }),
    }),
  );
  const result = await response.json() as { code?: string };
  assert.equal(response.status, 400);
  assert.equal(result.code, "INVALID_STRUCTURED_INPUT");
});

test("제작 화면은 필수 구조화 필드와 접힌 추가 정보 뒤에 기존 기능을 배치한다", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const createView = source.slice(
    source.indexOf("function CreateView"),
    source.indexOf("function AuthModal"),
  );
  const topic = createView.indexOf("무엇을 조사할까요?");
  const target = createView.indexOf("누구에게 물어볼까요?");
  const objective = createView.indexOf("이 설문으로 무엇을 알고 싶나요?");
  const aspects = createView.indexOf("어떤 내용을 꼭 확인할까요?");
  const additional = createView.indexOf("create-additional-info");
  const attachments = createView.indexOf("SurveyReferenceControls");
  const mode = createView.indexOf("survey-mode-setting");
  const generate = createView.indexOf("create-composer-footer");

  assert.ok(topic >= 0 && target > topic && objective > target && aspects > objective);
  assert.ok(additional > aspects && attachments > additional);
  assert.ok(mode > attachments && generate > mode);
  assert.doesNotMatch(createView, /육하원칙/);
});
