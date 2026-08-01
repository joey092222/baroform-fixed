import assert from "node:assert/strict";
import test from "node:test";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  buildSurveyAiRequest,
  parseSurveyDraftResponse,
} from "../app/survey-ai";
import { analyzeSurveyPrompt } from "../app/survey-intent";

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
  const result = {
    result: {
      status: "ready",
      interpretation: {
        kind: "satisfaction",
        intentLabel: "만족도 조사",
        respondentGroup,
        evaluationTarget,
        goal: "만족도와 개선점 파악",
        recognizedEntity: prompt.includes("맛나샘") ? "맛나샘" : "",
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
      verifiedFacts: [
        {
          fact: "설문 설계에 반영할 수 있는 확인된 사실입니다.",
          sourceUrl: factSourceUrl,
        },
      ],
      templateQuestions,
      aiQuestions,
      qualityCheck: {
        respondentNotMiscastAsSubject: true,
        questionsMatchSubject: true,
        noDuplicateQuestions: true,
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

test("OpenAI 요청은 서버용 Responses API 웹 검색을 강제한다", () => {
  const prompt = "대우관 만족도 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );

  assert.equal(request.model, "gpt-5.6");
  assert.equal(request.tool_choice, "required");
  assert.equal(request.store, false);
  assert.equal(request.tools[0]?.type, "web_search");
  assert.equal(request.tools[0]?.external_web_access, true);
  assert.equal(request.tools[0]?.user_location.country, "KR");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(JSON.stringify(request).includes("OPENAI_API_KEY"), false);
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

test("대우관 등하교 의견은 의견 자체가 아니라 이동 경험으로 해석한다", () => {
  const draft = analyzeSurveyPrompt("대우관 등하교에 대한 의견 조사");

  assert.equal(draft.title, "대우관 등하교 의견 조사");
  assert.equal(draft.evaluationTarget, "대우관 등하교 경험");
  assert.match(draft.templateQuestions[0].title, /대우관으로 등교하거나 대우관에서 하교한 빈도/);
  assert.doesNotMatch(draft.templateQuestions[0].title, /의견.*(?:이용|사용)/);
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
