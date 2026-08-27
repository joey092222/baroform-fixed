import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { JsonResponseError } from "../app/lib/http/json-response";
import {
  surveyGenerationErrorMessage,
  surveyGenerationErrorMetadata,
} from "../app/survey-generation-client";

test("제작 화면은 주제·첨부 → 목적·대상 → 생성 버튼 순서로 렌더링한다", async () => {
  const [createView, draftState, draftRequest, generationFlow] = await Promise.all([
    readFile(new URL("../app/ui/views/create.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/ux/state/use-survey-draft.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/ux/data/survey-draft.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/ux/state/use-survey-generation.ts", import.meta.url),
      "utf8",
    ),
  ]);

  // 단계 순서를 마크업 순서로 확인합니다. 첨부가 주제와 같은 단계에 있어야
  // 하고(별도 단계로 빼면 있는 줄도 모릅니다), 목적·대상이 그 뒤, 생성 버튼이
  // 마지막이어야 합니다.
  const topic = createView.indexOf('aria-label="조사할 주제"');
  const attachments = createView.indexOf("<SurveyReferenceControls");
  const purpose = createView.indexOf("이 설문을 어디에 쓰나요?");
  const audience = createView.indexOf("<b>응답 대상</b>");
  const generateButton = createView.indexOf("onClick={finish}");

  assert.ok(topic >= 0, "주제 입력이 없습니다");
  assert.ok(attachments > topic, "첨부가 주제와 같은 단계에 없습니다");
  assert.ok(purpose > attachments, "목적이 첨부 뒤에 오지 않습니다");
  assert.ok(audience > purpose, "응답 대상이 목적 뒤에 오지 않습니다");
  assert.ok(generateButton > audience, "생성 버튼이 마지막이 아닙니다");
  // 생성 중 두 번 눌리지 않아야 합니다.
  assert.match(createView, /disabled=\{isAnalyzing\}/);
  // 템플릿·빈 설문은 생성을 거치지 않고 편집기로 갑니다.
  assert.match(createView, /onUseQuestions\(/);
  assert.match(draftState, /useState<SurveyMode>\(defaultSurveyMode\)/);
  assert.match(draftRequest, /userInput: input\.prompt/);
  assert.match(generationFlow, /surveyMode: selectedSurveyMode/);
  // Guards a second concurrent generation while one is already running.
  assert.match(generationFlow, /if \(inFlightRef\.current\)/);
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
      clientRequestId: "client-request-1",
      responseType: null,
      responseStatus: null,
      generationSource: null,
      fallbackReason: null,
      surveyMode: "standard",
      stage: "initial-request",
    },
  );

  assert.equal(
    surveyGenerationErrorMessage(new TypeError("Failed to fetch")),
    "서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.",
  );

  const repairFailure = new JsonResponseError("internal", {
    code: "REPAIR_EXHAUSTED",
    status: 422,
    requestId: "server-repair-42",
    stage: "repair-validation",
  });
  const repairMessage = surveyGenerationErrorMessage(repairFailure);
  assert.match(repairMessage, /요청 ID: server-repair-42/);
  if (process.env.NODE_ENV !== "production") {
    assert.match(repairMessage, /REPAIR_EXHAUSTED.*repair-validation/);
  }
});
