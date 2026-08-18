import assert from "node:assert/strict";
import test from "node:test";
import { JsonResponseError } from "../app/lib/http/json-response";
import {
  readSurveyGenerationResponse,
  surveyGenerationErrorMessage,
} from "../app/survey-generation-client";
import {
  createSurveyGenerationTrace,
  recordSurveyContextTrace,
  recordSurveyFallback,
  recordSurveyModelCall,
  recordSurveyModelResponseTrace,
  recordSurveyPlanTrace,
  recordSurveyPostprocessTrace,
  recordSurveyRequestTrace,
  recordSurveySemanticDiagnostics,
  surveyGenerationTraceSnapshot,
} from "../app/survey-generation-trace";

type SurveyPayload = { blueprint?: { title: string } };
type ClarificationPayload = { clarification?: { question: string } };
type BackgroundPayload = { responseId?: string; jobToken?: string };

const readResponse = (response: Response) =>
  readSurveyGenerationResponse<
    SurveyPayload,
    ClarificationPayload,
    BackgroundPayload
  >(response);

test("서버 오류의 requestId, code, stage와 생성 진단을 그대로 보존한다", async () => {
  const response = Response.json(
    {
      requestId: "request-server-error",
      type: "error",
      ok: false,
      status: "error",
      code: "SURVEY_GENERATION_OUTPUT_MISSING",
      stage: "output-parsing",
      generationSource: "openai",
      fallbackReason: "output-parsed-missing",
      error: "생성된 설문 구조를 확인하지 못했어요.",
    },
    {
      status: 502,
      headers: { "x-baroform-request-id": "header-lower-priority" },
    },
  );

  await assert.rejects(readResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.requestId, "request-server-error");
    assert.equal(error.code, "SURVEY_GENERATION_OUTPUT_MISSING");
    assert.equal(error.stage, "output-parsing");
    assert.equal(error.generationSource, "openai");
    assert.equal(error.fallbackReason, "output-parsed-missing");
    assert.equal(error.responseType, "error");
    assert.equal(error.responseStatus, "error");
    assert.notEqual(error.code, "SURVEY_GENERATION_INCOMPLETE");
    return true;
  });
});

test("본문에 requestId가 없으면 응답 헤더의 requestId를 보존한다", async () => {
  const response = Response.json(
    {
      type: "survey",
      ok: true,
      status: "ready",
      code: null,
      stage: "response-ready",
      generationSource: "openai",
      fallbackReason: null,
      blueprint: { title: "테스트 설문" },
    },
    {
      headers: { "x-baroform-request-id": "request-from-header" },
    },
  );

  const result = await readResponse(response);
  assert.equal(result.type, "survey");
  assert.equal(result.requestId, "request-from-header");
});

test("성공 survey에서도 generationSource와 fallbackReason을 읽을 수 있다", async () => {
  const response = Response.json({
    requestId: "request-fallback",
    type: "survey",
    ok: true,
    status: "ready_with_caution",
    code: null,
    stage: "response-ready",
    generationSource: "semantic_validation_fallback",
    fallbackReason: "semantic-validation-failed",
    blueprint: { title: "대체 설문" },
  });

  const result = await readResponse(response);
  assert.equal(result.type, "survey");
  assert.equal(result.generationSource, "semantic_validation_fallback");
  assert.equal(result.fallbackReason, "semantic-validation-failed");
});

test("clarification 응답을 불완전한 survey로 오인하지 않는다", async () => {
  const response = Response.json({
    requestId: "request-clarification",
    type: "clarification",
    ok: true,
    status: "needs_clarification",
    code: null,
    stage: "response-ready",
    generationSource: "clarification",
    fallbackReason: null,
    clarification: { question: "어떤 대상을 평가할까요?" },
  });

  const result = await readResponse(response);
  assert.equal(result.type, "clarification");
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.generationSource, "clarification");
});

test("background 응답은 survey 검증 없이 polling 상태로 보존한다", async () => {
  const response = Response.json({
    requestId: "request-background",
    type: "background",
    ok: true,
    status: "in_progress",
    code: null,
    stage: "background-poll",
    generationSource: "openai",
    fallbackReason: null,
    responseId: "resp_background_1234",
    jobToken: "job-token",
  });

  const result = await readResponse(response);
  assert.equal(result.type, "background");
  assert.equal(result.status, "in_progress");
  assert.equal(result.requestId, "request-background");
});

test("알 수 없는 survey status를 실제 status와 함께 기록한다", async () => {
  const response = Response.json({
    requestId: "request-unknown-status",
    type: "survey",
    ok: true,
    status: "partially_ready",
    code: null,
    stage: "response-ready",
    generationSource: "openai_partial_repair",
    fallbackReason: null,
  });

  await assert.rejects(readResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.code, "INVALID_SURVEY_STATUS");
    assert.equal(error.requestId, "request-unknown-status");
    assert.equal(error.responseType, "survey");
    assert.equal(error.responseStatus, "partially_ready");
    assert.equal(error.generationSource, "openai_partial_repair");
    assert.match(error.message, /partially_ready/);
    return true;
  });
});

test("알 수 없는 응답 type은 계약 오류로 구분한다", async () => {
  const response = Response.json({
    requestId: "request-unknown-type",
    type: "partial",
    ok: true,
    status: "ready",
    code: null,
    stage: "response-ready",
    generationSource: "openai",
    fallbackReason: null,
  });

  await assert.rejects(readResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.code, "CLIENT_RESPONSE_CONTRACT_INVALID");
    assert.equal(error.requestId, "request-unknown-type");
    assert.equal(error.responseType, "partial");
    return true;
  });
});

test("성공·실패 분석에 필요한 생성 trace 필드를 requestId 단위로 보존한다", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousTraceFlag = mutableEnv.BAROFORM_AI_TRACE;
  mutableEnv.BAROFORM_AI_TRACE = "true";
  const trace = createSurveyGenerationTrace("request-trace");
  recordSurveyRequestTrace(trace, {
    httpMethod: "POST",
    contentType: "application/json",
    surveyMode: "standard",
    questionCount: 7,
    targetGrade: "전학년",
    attachmentCount: 0,
  });
  recordSurveyContextTrace(
    trace,
    {
      rawUserInput: "연세대학교 학생들의 대우관 등하교 경험에 대해 조사하고 싶다",
      normalizedInput: "연세대학교 학생들의 대우관 등하교 경험",
      audience: "연세대학교 학생",
      primaryEntity: "대우관",
      entityType: "university_building",
      activity: "대우관을 오가는 이동",
      researchGoal: "대우관 등하교 경험 파악",
      researchConstructs: ["이동 빈도", "불편"],
      surveyArchetype: "mobility_experience",
      isUsageObject: false,
    },
    "mobility_experience_blueprint",
  );
  recordSurveyPlanTrace(trace, {
    intentKind: "mobility_experience",
    purposeKinds: ["behavior_usage", "problem_discovery"],
    purposeBlockCount: 2,
    blocks: ["movement-frequency", "movement-friction"],
  });
  recordSurveyModelCall(trace);
  recordSurveyModelResponseTrace(trace, {
    status: "completed",
    incomplete_details: null,
    output_parsed: { survey: true },
    output: [{ type: "message" }, { type: "web_search_call" }],
  });
  recordSurveyPostprocessTrace(trace, {
    before: ["생성 전 문항"],
    final: ["최종 문항"],
  });
  recordSurveySemanticDiagnostics(trace, {
    violationCodes: ["MALFORMED_TOPIC_PARTICLE"],
    qualityViolationCodes: ["QUESTION_COUNT_MISMATCH"],
  });
  recordSurveyFallback(
    trace,
    "semantic-validation-failed",
    "semantic_repair_fallback",
  );

  const snapshot = surveyGenerationTraceSnapshot(trace);
  assert.equal(snapshot.requestId, "request-trace");
  assert.equal(snapshot.httpMethod, "POST");
  assert.equal(snapshot.contentType, "application/json");
  assert.equal(snapshot.surveyMode, "standard");
  assert.equal(snapshot.requestedQuestionCount, 7);
  assert.equal(snapshot.targetGrade, "전학년");
  assert.equal(snapshot.attachmentCount, 0);
  assert.match(snapshot.rawUserInput ?? "", /대우관/);
  assert.match(snapshot.normalizedInput ?? "", /등하교/);
  assert.equal(snapshot.extractedAudience, "연세대학교 학생");
  assert.deepEqual(snapshot.extractedEntities, ["대우관"]);
  assert.deepEqual(snapshot.extractedActivities, ["대우관을 오가는 이동"]);
  assert.deepEqual(snapshot.extractedResearchGoals, ["대우관 등하교 경험 파악"]);
  assert.deepEqual(snapshot.extractedStudyPurposes, [
    "behavior_usage",
    "problem_discovery",
  ]);
  assert.equal(snapshot.selectedSurveyType, "mobility_experience");
  assert.equal(snapshot.selectedTemplateKey, "mobility_experience_blueprint");
  assert.match(snapshot.selectedBlueprint ?? "", /movement-frequency/);
  assert.equal(snapshot.rawModelResponsePresent, true);
  assert.equal(snapshot.responseStatus, "completed");
  assert.equal(snapshot.responseIncompleteReason, null);
  assert.equal(snapshot.outputParsedPresent, true);
  assert.deepEqual(snapshot.outputItemTypes, ["message", "web_search_call"]);
  assert.deepEqual(snapshot.questionsBeforePostprocess, ["생성 전 문항"]);
  assert.deepEqual(snapshot.finalQuestions, ["최종 문항"]);
  assert.equal(snapshot.generationSource, "semantic_validation_fallback");
  assert.equal(snapshot.fallbackUsed, true);
  assert.equal(snapshot.fallbackReason, "semantic-validation-failed");
  assert.deepEqual(snapshot.semanticViolationCodes, [
    "MALFORMED_TOPIC_PARTICLE",
  ]);
  assert.deepEqual(snapshot.qualityViolationCodes, [
    "QUESTION_COUNT_MISMATCH",
  ]);
  assert.equal(snapshot.modelCallCount, 1);
  assert.equal(snapshot.repairCount, 0);
  assert.equal(snapshot.fallbackCount, 1);
  assert.ok(snapshot.totalElapsedMs >= 0);
  if (previousTraceFlag === undefined) delete mutableEnv.BAROFORM_AI_TRACE;
  else mutableEnv.BAROFORM_AI_TRACE = previousTraceFlag;
});

test("Preview의 불완전 출력 오류는 code, stage, requestId를 사용자 진단에 포함한다", async () => {
  const response = Response.json(
    {
      requestId: "request-preview-schema",
      type: "error",
      ok: false,
      status: "error",
      code: "OUTPUT_SCHEMA_INVALID",
      stage: "structured-output-schema-validation",
      generationSource: "openai",
      fallbackReason: null,
      error: "생성된 설문 구조를 확인하지 못했어요.",
    },
    {
      status: 422,
      headers: { "x-baroform-environment": "preview" },
    },
  );

  await assert.rejects(readResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.deploymentEnvironment, "preview");
    const message = surveyGenerationErrorMessage(error);
    assert.match(message, /코드: OUTPUT_SCHEMA_INVALID/);
    assert.match(message, /단계: structured-output-schema-validation/);
    assert.match(message, /요청 ID: request-preview-schema/);
    return true;
  });
});

test("Production의 불완전 출력 오류는 기존 친절한 문구만 표시한다", async () => {
  const response = Response.json(
    {
      requestId: "request-production-schema",
      type: "error",
      ok: false,
      status: "error",
      code: "OUTPUT_SCHEMA_INVALID",
      stage: "structured-output-schema-validation",
      generationSource: "openai",
      fallbackReason: null,
      error: "생성된 설문 구조를 확인하지 못했어요.",
    },
    {
      status: 422,
      headers: { "x-baroform-environment": "production" },
    },
  );

  await assert.rejects(readResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.deploymentEnvironment, "production");
    assert.equal(
      surveyGenerationErrorMessage(error),
      "완전한 설문 응답을 받지 못해 적용하지 않았어요. 다시 시도해주세요.",
    );
    return true;
  });
});

test("OpenAI parse failure fallback의 경로와 실제 원인을 구분한다", () => {
  const trace = createSurveyGenerationTrace("request-parse-fallback");
  recordSurveyFallback(
    trace,
    "output-parse-failed",
    "openai_parse_failure_fallback",
  );

  const snapshot = surveyGenerationTraceSnapshot(trace);
  assert.equal(snapshot.generationSource, "openai_parse_failure_fallback");
  assert.equal(snapshot.fallbackReason, "output-parse-failed");
  assert.equal(snapshot.fallbackCount, 1);
});

test("운영 trace는 원문을 숨기고 분류·개수·Responses 상태만 남긴다", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = "production";
  try {
    const trace = createSurveyGenerationTrace("request-production-trace");
    recordSurveyContextTrace(
      trace,
      {
        rawUserInput: "사용자 원문",
        normalizedInput: "정규화 원문",
        audience: "대학생",
        primaryEntity: "특정 대상",
        entityType: "construct",
        activity: null,
        researchGoal: "연구 목적",
        researchConstructs: ["구성개념"],
        surveyArchetype: "attitude",
        isUsageObject: false,
      },
      "attitude_blueprint",
    );
    recordSurveyModelResponseTrace(trace, {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_parsed: null,
      output: [{ type: "message" }],
    });
    recordSurveyPostprocessTrace(trace, {
      before: ["생성 전 문항"],
      final: ["최종 문항"],
    });

    const snapshot = surveyGenerationTraceSnapshot(trace);
    assert.equal(snapshot.rawUserInput, null);
    assert.equal(snapshot.normalizedInput, null);
    assert.equal(snapshot.parsedSurveyContext, null);
    assert.equal(snapshot.rawModelResponse, null);
    assert.deepEqual(snapshot.questionsBeforePostprocess, []);
    assert.deepEqual(snapshot.finalQuestions, []);
    assert.equal(snapshot.selectedSurveyType, "attitude");
    assert.equal(snapshot.selectedTemplateKey, "attitude_blueprint");
    assert.equal(snapshot.questionsBeforePostprocessCount, 1);
    assert.equal(snapshot.finalQuestionCount, 1);
    assert.equal(snapshot.responseStatus, "incomplete");
    assert.equal(snapshot.responseIncompleteReason, "max_output_tokens");
    assert.equal(snapshot.outputParsedPresent, false);
    assert.deepEqual(snapshot.outputItemTypes, ["message"]);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
  }
});
