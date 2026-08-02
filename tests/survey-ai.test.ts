import assert from "node:assert/strict";
import test from "node:test";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  buildSurveyAiRequest,
  parseSurveyDraftResponse,
} from "../app/survey-ai";
import {
  buildSurveyRevisionRequest,
  parseSurveyRevisionResponse,
} from "../app/survey-revision";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import { applyTargetGradeToQuestions } from "../app/survey-grade";

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

test("OpenAI 요청은 필요한 경우에만 빠른 웹 검색을 사용한다", () => {
  const prompt = "대우관 만족도 조사";
  const request = buildSurveyAiRequest(
    prompt,
    analyzeSurveyPrompt(prompt),
    "gpt-5.6",
  );

  assert.equal(request.model, "gpt-5.6");
  assert.equal(request.tool_choice, "auto");
  assert.equal(request.reasoning.effort, "medium");
  assert.equal(request.store, false);
  assert.equal(request.tools[0]?.type, "web_search");
  assert.equal(request.tools[0]?.external_web_access, true);
  assert.equal(request.tools[0]?.search_context_size, "medium");
  assert.equal(request.tools[0]?.user_location.country, "KR");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.match(requestInputText(request.input), /연세대학교 신촌캠퍼스/);
  assert.match(
    requestInputText(request.input),
    /문장이 짧다는 이유로 생성을 거절하지 마세요/,
  );
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
  assert.match(serialized, /각 링크의 실제 페이지를 확인/);
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
  assert.match(serialized, /각 파일의 실제 본문과 표를 읽고/);
  assert.equal(serialized.includes(pdfData), true);
  assert.equal(serialized.includes(sheetData), true);
  assert.equal(request.tool_choice, "auto");
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
  assert.match(requestInputText(request.input), /정확히 12개/);
  assert.equal(request.text.format.schema.properties.result.anyOf[0].properties.aiQuestions.minItems, 12);
  assert.equal(request.text.format.schema.properties.result.anyOf[0].properties.aiQuestions.maxItems, 12);
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

test("AI 결과 형식이 일시적으로 깨져도 구체적인 설문은 중단하지 않는다", async () => {
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
    const body = (await response.json()) as { status?: string };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ready");
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
