import assert from "node:assert/strict";
import test from "node:test";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { JsonResponseError } from "../app/lib/http/json-response";
import { readSurveyGenerationResponse } from "../app/survey-generation-client";

type SurveyPayload = { blueprint?: { title?: string } };

const readRouteResponse = (response: Response) =>
  readSurveyGenerationResponse<SurveyPayload, object, object>(response);

test("실제 설문 생성 Route 오류의 requestId, code, stage가 클라이언트까지 유지된다", async () => {
  const response = await createSurveyDraft(
    new Request("http://localhost/api/survey-draft", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "user-agent": "baroform-generation-contract-invalid-json",
      },
      body: '{"prompt":"대학생 수면 시간 조사"',
    }),
  );
  const headerRequestId = response.headers.get("x-baroform-request-id");
  assert.equal(response.headers.get("x-baroform-error-code"), "INVALID_JSON");
  assert.equal(
    response.headers.get("x-baroform-error-stage"),
    "input-parsing",
  );

  await assert.rejects(readRouteResponse(response), (error: unknown) => {
    assert.ok(error instanceof JsonResponseError);
    assert.equal(error.code, "INVALID_JSON");
    assert.equal(error.requestId, headerRequestId);
    assert.equal(error.stage, "input-parsing");
    assert.equal(error.responseType, "error");
    assert.equal(error.responseStatus, "error");
    assert.notEqual(error.code, "SURVEY_GENERATION_INCOMPLETE");
    return true;
  });
});

test("실제 설문 생성 Route 성공 응답에 generationSource와 fallbackReason이 포함된다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-generation-contract-success",
        },
        body: JSON.stringify({
          prompt: "교내 휴게 공간 이용 만족도 조사",
          surveyMode: "standard",
          questionCount: 7,
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("x-baroform-build-sha") ?? "",
      /^[0-9a-f]{40}$/,
    );
    assert.equal(response.headers.get("x-baroform-environment"), "test");
    assert.equal(response.headers.get("x-baroform-app-version"), "0.1.0");
    const result = await readRouteResponse(response);
    assert.equal(result.type, "survey");
    assert.match(result.status, /^ready/);
    assert.ok(result.requestId);
    assert.equal(result.code, null);
    assert.equal(result.stage, "response-ready");
    assert.ok(result.generationSource);
    assert.ok(result.fallbackReason);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});
