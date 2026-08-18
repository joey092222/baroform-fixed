import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  openAiUserMessages,
  type AiTraceEvent,
  withAiTraceForTest,
} from "../app/lib/ai/ai-trace";
import { withOpenAiApiKeyForTest } from "../app/lib/ai/openai-runtime";
import { createSurveyGenerationSchema } from "../app/lib/ai/survey-generation-schema";
import {
  readSurveyGenerationResponse,
  traceSurveyGenerationUiPayload,
} from "../app/survey-generation-client";
import { analyzeSurveyPrompt } from "../app/survey-intent";

type MockStructuredResponse = ReturnType<typeof structuredResponse>;

function structuredResponse(prompt: string) {
  const blueprint = analyzeSurveyPrompt(prompt);
  const roles = [
    "behavior",
    "behavior",
    "experience",
    "evaluation",
    "barrier",
    "priority",
    "open",
  ] as const;
  const questions = blueprint.aiQuestions.slice(0, 7).map((question, index) => {
    const type =
      question.type === "single"
        ? "single_choice"
        : question.type === "multiple"
          ? "multiple_choice"
          : question.type === "scale"
            ? "scale"
            : "long_text";
    return {
      id: `Q${index + 1}`,
      section_id: "S1",
      role: roles[index] ?? "open",
      type,
      text: question.title,
      helper_text: null,
      required: question.required,
      reference_period: null,
      options: (question.options ?? []).map((label, optionIndex) => ({
        id: `Q${index + 1}_O${optionIndex + 1}`,
        label,
        exclusive: /해당 없음|이용하지 않음|없음/.test(label),
        fixed_position: /기타/.test(label),
        allows_text: /기타/.test(label),
      })),
      scale:
        type === "scale"
          ? {
              min: 1,
              max: 5,
              min_label: "전혀 그렇지 않음",
              max_label: "매우 그러함",
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
        construct: question.measuredVariable ?? `측정 변수 ${index + 1}`,
        purpose: question.reason,
        variable_name: `mock_q_${index + 1}`,
        coding_notes: null,
      },
      grounding: {
        uses_external_fact: false,
        source_ids: [],
      },
    };
  });
  const parsed = createSurveyGenerationSchema(7).parse({
    status: "ready_with_caution",
    research: {
      search_status: "failed",
      entities: [],
      sources: [],
      limitations: ["외부 사실 확인이 필요하지 않은 로컬 mock 검증임"],
    },
    survey_plan: {
      survey_type: "이용 경험 조사",
      target: blueprint.respondentGroup || "일반 응답자",
      eligibility: blueprint.respondentGroup || "일반 응답자",
      primary_objective: blueprint.goal,
      sub_objectives: ["실제 경험과 개선 요구를 분리해 파악함"],
      constructs: questions.slice(0, 7).map((question) => ({
        name: question.analysis.construct,
        reason: question.analysis.purpose,
      })),
      requested_question_count: 7,
      count_rule: "max_path",
      total_question_nodes: 7,
      min_path_questions: 7,
      max_path_questions: 7,
      estimated_minutes: 4,
    },
    survey: {
      title: blueprint.title,
      intro: blueprint.description,
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
  });

  return {
    id: `resp_${crypto.randomUUID()}`,
    object: "response",
    status: "completed",
    incomplete_details: null,
    output_parsed: parsed,
    output: [
      {
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(parsed),
            annotations: [],
          },
        ],
      },
    ],
  };
}

function replaceStructuredOutput(
  response: MockStructuredResponse,
  mutate: (payload: MockStructuredResponse["output_parsed"]) => void,
) {
  mutate(response.output_parsed);
  response.output[0]!.content[0]!.text = JSON.stringify(response.output_parsed);
  return response;
}

function requestFor(prompt: string, requestId: string) {
  return new Request("http://localhost/api/survey-draft", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "user-agent": requestId,
      "x-baroform-client-request-id": requestId,
    },
    body: JSON.stringify({
      userInput: prompt,
      prompt: "이전 설문 내용이 섞이면 안 됩니다",
      surveyMode: "standard",
      targetGrade: "전학년",
      questionCount: 7,
      references: { images: [], files: [], links: [] },
    }),
  });
}

async function withMockTransport<T>(
  transport: typeof globalThis.fetch,
  operation: () => Promise<T>,
) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = transport;
  try {
    return await withOpenAiApiKeyForTest("local-test-key", operation);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function assertOrderedStages(events: AiTraceEvent[], stages: AiTraceEvent["stage"][]) {
  let previousIndex = -1;
  for (const stage of stages) {
    const index = events.findIndex(
      (event, eventIndex) => eventIndex > previousIndex && event.stage === stage,
    );
    assert.notEqual(index, -1, `${stage} trace가 없습니다.`);
    previousIndex = index;
  }
}

test("실제 POST 경로는 원문 역할·nullable 출력·후처리·UI payload를 손실 없이 연결한다", async () => {
  const prompt = "직장인의 업무 협업 플랫폼 이용 경험과 개선 의견 조사";
  const requestId = "trace-route-normal-001";
  const events: AiTraceEvent[] = [];
  let upstreamRequest: Record<string, unknown> | null = null;

  const result = await withAiTraceForTest(
    (event) => events.push(event),
    () =>
      withMockTransport(async (_input, init) => {
        upstreamRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json(structuredResponse(prompt));
      }, async () => {
        const response = await createSurveyDraft(requestFor(prompt, requestId));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-baroform-generation-source"), "openai");
        assert.equal(response.headers.get("x-baroform-fallback-count"), "0");
        assert.equal(response.headers.get("x-baroform-repair-count"), "0");
        const parsed = await readSurveyGenerationResponse<
          {
            blueprint: {
              title: string;
              description: string;
              aiQuestions: Array<{ title: string }>;
            };
          },
          Record<string, never>,
          Record<string, never>
        >(response);
        assert.equal(parsed.type, "survey");
        if (parsed.type !== "survey") throw new Error("SURVEY_RESPONSE_EXPECTED");
        traceSurveyGenerationUiPayload(parsed, requestId);
        return parsed;
      }),
  );

  assert.equal(result.requestId, requestId);
  const captured = upstreamRequest as Record<string, unknown> | null;
  assert.ok(captured);
  assert.deepEqual(openAiUserMessages(captured.input), [prompt]);
  const messages = captured.input as Array<{ role?: string; content?: unknown }>;
  assert.deepEqual(messages.map((message) => message.role), ["developer", "user"]);
  assert.doesNotMatch(String(messages[0]?.content), new RegExp(prompt));
  assert.doesNotMatch(JSON.stringify(result), /이전 설문 내용/);
  assertOrderedStages(events, [
    "server_received",
    "input_normalized",
    "prompt_built",
    "openai_request_started",
    "openai_response_received",
    "parse_started",
    "parse_succeeded",
    "postprocess_succeeded",
    "ui_payload_created",
  ]);
  const parseEvent = events.find((event) => event.stage === "parse_succeeded");
  const postprocessEvent = events.find(
    (event) => event.stage === "postprocess_succeeded",
  );
  assert.equal(
    ((parseEvent?.data as { parsedSurvey?: { aiQuestions?: unknown[] } })
      .parsedSurvey?.aiQuestions ?? []).length,
    7,
  );
  assert.equal(
    ((postprocessEvent?.data as { finalQuestionCount?: number })
      .finalQuestionCount),
    7,
  );
});

test("불완전한 Responses API 출력은 성공 설문으로 오인하지 않고 실패 trace를 남긴다", async () => {
  const events: AiTraceEvent[] = [];
  const response = await withAiTraceForTest(
    (event) => events.push(event),
    () =>
      withMockTransport(
        async () =>
          Response.json({
            id: "resp_incomplete_trace",
            object: "response",
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output_parsed: null,
            output: [],
          }),
        () =>
          createSurveyDraft(
            requestFor(
              "대학생의 온라인 학습 경험 개선 조사",
              "trace-route-incomplete-001",
            ),
          ),
      ),
  );
  const body = (await response.json()) as { ok?: boolean; code?: string };
  assert.equal(response.status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.code, "SURVEY_GENERATION_INCOMPLETE");
  assert.ok(events.some((event) => event.stage === "parse_started"));
  assert.ok(events.some((event) => event.stage === "parse_failed"));
  assert.ok(events.some((event) => event.stage === "request_failed"));
  assert.equal(events.some((event) => event.stage === "ui_payload_created"), false);
});

test("의미 검수 실패는 성공 설문으로 오인하지 않고 정확한 실패 trace를 남긴다", async () => {
  const prompt = "해오름관을 오가는 이용자들이 느끼는 접근성과 이동 불편";
  const invalid = replaceStructuredOutput(structuredResponse(prompt), (payload) => {
    payload.survey.questions[0]!.text =
      "해오름관 이동 경험에 대해를 이용한 적이 있나요?";
    payload.survey.questions[1]!.text =
      "평소 해오름관 이동 경험을 얼마나 자주 이용하나요?";
  });
  const events: AiTraceEvent[] = [];
  const response = await withAiTraceForTest(
    (event) => events.push(event),
    () =>
      withMockTransport(
        async () => Response.json(invalid),
        () =>
          createSurveyDraft(requestFor(prompt, "trace-route-semantic-001")),
      ),
  );
  const body = (await response.json()) as {
    ok?: boolean;
    type?: string;
    code?: string;
    stage?: string;
  };
  assert.equal(response.status, 422);
  assert.equal(body.ok, false);
  assert.equal(body.type, "error");
  assert.equal(body.code, "REPAIR_EXHAUSTED");
  assert.equal(typeof body.stage, "string");
  assert.ok(events.some((event) => event.stage === "parse_started"));
  assert.ok(events.some((event) => event.stage === "parse_failed"));
  assert.ok(events.some((event) => event.stage === "request_failed"));
  assert.equal(events.some((event) => event.stage === "ui_payload_created"), false);
});

test("일시적 전송 실패는 원문을 바꾸지 않고 한 번만 재시도한 뒤 정상 응답을 유지한다", async () => {
  const prompt = "청년의 디지털 학습 도구 이용 경험 조사";
  const events: AiTraceEvent[] = [];
  let attempts = 0;
  const response = await withAiTraceForTest(
    (event) => events.push(event),
    () =>
      withMockTransport(async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("temporary connection failure");
        return Response.json(structuredResponse(prompt));
      }, () => createSurveyDraft(requestFor(prompt, "trace-route-retry-001"))),
  );
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
  assert.equal(response.headers.get("x-baroform-generation-source"), "openai");
  assert.equal(response.headers.get("x-baroform-fallback-count"), "0");
  const retry = events.find((event) => event.stage === "retry_started");
  assert.ok(retry);
  assert.deepEqual(retry.data, {
    retryCount: 1,
    maximumRetryCount: 1,
    rawUserInputPreserved: true,
    promptChanged: false,
  });
  assert.ok(events.some((event) => event.stage === "parse_succeeded"));
});

test("재시도 후 전송 실패는 생성 요청을 새로 만들지 않고 명시적 fallback으로 종료한다", async () => {
  const events: AiTraceEvent[] = [];
  let attempts = 0;
  const response = await withAiTraceForTest(
    (event) => events.push(event),
    () =>
      withMockTransport(async () => {
        attempts += 1;
        throw new TypeError("persistent connection failure");
      }, () =>
        createSurveyDraft(
          requestFor(
            "일반인의 온라인 정보 탐색 경험 조사",
            "trace-route-fallback-001",
          ),
        ),
      ),
  );
  const body = (await response.json()) as { ok?: boolean; type?: string };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.type, "survey");
  assert.equal(attempts, 2);
  assert.equal(response.headers.get("x-baroform-model-calls"), "1");
  assert.equal(response.headers.get("x-baroform-fallback-count"), "1");
  assert.equal(response.headers.get("x-baroform-ai-fallback"), "responses-api-error");
  assertOrderedStages(events, [
    "openai_request_started",
    "retry_started",
    "fallback_used",
  ]);
  assert.equal(events.some((event) => event.stage === "ui_payload_created"), false);
});
