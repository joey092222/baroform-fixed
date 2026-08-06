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
  isSimpleProportionSurveyRequest,
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
    assert.equal(allGrades.blueprint.respondentGroup, "연세대학교 재학생");
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
  assert.equal(
    request.text.format.schema.properties.result.anyOf[0].properties.designPlan
      .properties.referenceGrounding.minItems,
    1,
  );
  assert.match(requestInputText(request.input), /자료 근거, 분석축, 각 문항의 역할/);
  assert.match(requestInputText(request.input), /최소 두 문항/);
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
      "학교에서 집 가고 싶다는 생각을 하는 빈도는 어느 정도인가요?",
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

test("AI가 명확한 빈도 조사에 재질문해도 설문 초안으로 전환한다", () => {
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

  const parsed = parseSurveyDraftResponse(payload, prompt);

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    assert.match(
      parsed.blueprint.respondentGroup ?? "",
      /연세대(?:학교)?\s*(?:재)?학생/,
    );
    assert.equal(
      parsed.blueprint.aiQuestions[0]?.title,
      "학교에서 집 가고 싶다는 생각을 하는 빈도는 어느 정도인가요?",
    );
    assert.match(parsed.research.summary, /추가 질문 없이/);
  }
});

test("AI가 소비 습관 조사 목적을 되물어도 구체적인 초안으로 전환한다", () => {
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

  const parsed = parseSurveyDraftResponse(payload, prompt);

  assert.equal(parsed.status, "ready");
  if (parsed.status === "ready") {
    const corpus = parsed.blueprint.aiQuestions
      .flatMap((item) => [item.title, ...(item.options ?? [])])
      .join(" ");
    assert.equal(parsed.blueprint.title, "학생 소비 습관 조사");
    assert.match(corpus, /생활비/);
    assert.match(corpus, /구매할 때 중요하게 보는 기준/);
    assert.match(parsed.research.summary, /추가 질문 없이/);
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
