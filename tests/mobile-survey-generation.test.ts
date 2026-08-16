import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { JsonResponseError } from "../app/lib/http/json-response";
import {
  surveyGenerationErrorMessage,
  surveyGenerationErrorMetadata,
} from "../app/survey-generation-client";

test("모바일 제작 화면은 첨부, 제작 방식, 생성 버튼 순서로 렌더링한다", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const createView = source.slice(
    source.indexOf("function CreateView"),
    source.indexOf("function AuthModal"),
  );
  const attachments = createView.indexOf("<SurveyReferenceControls");
  const surveyMode = createView.indexOf('<fieldset className="survey-mode-setting"');
  const generateButton = createView.indexOf('<div className="create-composer-footer">');

  assert.ok(attachments >= 0);
  assert.ok(surveyMode > attachments);
  assert.ok(generateButton > surveyMode);
  assert.match(source, /useState<SurveyMode>\(defaultSurveyMode\)/);
  assert.match(source, /userInput: requestedPrompt/);
  assert.match(source, /surveyMode: selectedSurveyMode/);
  assert.match(source, /if \(analysisInFlightRef\.current\) return/);
  assert.match(source, /disabled=\{isAnalyzing \|\| !canGenerate\}/);
});

test("구조화된 서버 오류는 모바일 사용자 메시지와 추적 정보로 변환한다", () => {
  const invalidRequest = new JsonResponseError("internal", {
    code: "INVALID_REQUEST",
    status: 400,
    requestId: "server-request-1",
  });
  assert.equal(
    surveyGenerationErrorMessage(invalidRequest),
    "입력 내용을 확인하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.",
  );
  assert.deepEqual(
    surveyGenerationErrorMetadata(
      invalidRequest,
      "standard",
      "initial-request",
      "client-request-1",
    ),
    {
      status: 400,
      errorCode: "INVALID_REQUEST",
      requestId: "server-request-1",
      surveyMode: "standard",
      stage: "initial-request",
    },
  );

  assert.equal(
    surveyGenerationErrorMessage(new TypeError("Failed to fetch")),
    "서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.",
  );
});
