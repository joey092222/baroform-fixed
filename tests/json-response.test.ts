import assert from "node:assert/strict";
import test from "node:test";
import {
  JsonResponseError,
  readJsonResponse,
} from "../app/lib/http/json-response";

test("빈 500 응답은 영어 JSON SyntaxError 대신 한국어 오류로 변환한다", async () => {
  const response = new Response(null, {
    status: 500,
    headers: { "x-baroform-request-id": "request-empty" },
  });

  await assert.rejects(
    readJsonResponse(response),
    (error: unknown) => {
      assert.ok(error instanceof JsonResponseError);
      assert.equal(error.code, "SERVER_RESPONSE_EMPTY");
      assert.equal(error.status, 500);
      assert.equal(error.requestId, "request-empty");
      assert.equal(
        error.message,
        "서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      assert.doesNotMatch(error.message, /Unexpected end of JSON input/);
      return true;
    },
  );
});

test("HTML 오류 응답은 비JSON 서버 응답으로 구분한다", async () => {
  const response = new Response("<!doctype html><title>Error</title>", {
    status: 502,
    headers: { "content-type": "text/html" },
  });

  await assert.rejects(
    readJsonResponse(response),
    (error: unknown) => {
      assert.ok(error instanceof JsonResponseError);
      assert.equal(error.code, "SERVER_RESPONSE_INVALID");
      assert.equal(
        error.message,
        "생성된 설문을 불러오는 과정에서 문제가 발생했어요.",
      );
      return true;
    },
  );
});

test("구조화된 서버 오류는 요청 ID와 한국어 메시지를 보존한다", async () => {
  const response = Response.json(
    {
      ok: false,
      error: "설문 생성이 끝나기 전에 응답이 중단됐어요. 다시 시도해주세요.",
      code: "SURVEY_GENERATION_INCOMPLETE",
      requestId: "request-incomplete",
    },
    { status: 502 },
  );

  await assert.rejects(
    readJsonResponse(response),
    (error: unknown) => {
      assert.ok(error instanceof JsonResponseError);
      assert.equal(error.code, "SURVEY_GENERATION_INCOMPLETE");
      assert.equal(error.requestId, "request-incomplete");
      assert.match(error.message, /응답이 중단/);
      return true;
    },
  );
});
