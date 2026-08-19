import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isAiTraceEnabled,
  openAiUserMessages,
  redactSensitiveData,
  traceAiEvent,
  withAiTraceForTest,
} from "../app/lib/ai/ai-trace";
import {
  normalizeUserInput,
  selectSurveyUserInput,
} from "../app/lib/ai/user-input";
import { buildSurveyAiRequest } from "../app/survey-ai";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import { validateSurveyIntentCandidate } from "../app/survey-semantic-intent-core";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";

const representativeInputs = [
  "경영대에 대한 연세대 경영대생들 만족도",
  "연세대학교 학생들의 대우관 등하교 경험",
  "국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험",
  "연세대학교 학생들의 한경관 학식 이용 경험",
  "맛나샘을 이용하는 학생들의 만족도와 개선 의견",
] as const;

const virtualEntityInputs = [
  "솔빛관을 이용하는 새봄대학교 학생들의 만족도와 개선 의견",
  "별마루 서비스를 이용하지 않는 청년들이 이용하지 않는 이유",
  "해오름관을 오가는 이용자들이 느끼는 접근성과 이동 불편",
  "온새미 플랫폼을 사용하는 직장인의 이용 빈도와 유료 결제 경험",
  "새봄대학교 전체 학생이 바라보는 창의관 시설의 이미지와 이용 경험",
  "경영학부 재학생의 전공 수업·학습 공간·행정 지원 만족도",
] as const;

const allInvariantInputs = [...representativeInputs, ...virtualEntityInputs] as const;

const regressionInvariantInputs = [
  "동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기",
  "자전거와 전동킥보드로 출퇴근하는 사람들의 이동 시간과 안전 경험 비교",
  "네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지",
  "새봄대학교 심리학과 1학년의 이번 학기 온라인 강의 만족도",
  "통계학 강의와 프로그래밍 강의가 데이터 분석 자신감에 미치는 영향을 비교",
  "시설 이용",
  "서비스 개선",
] as const;

test("허용된 줄바꿈 정규화와 trim 외에는 사용자 원문을 바꾸지 않는다", () => {
  for (const input of representativeInputs) {
    assert.equal(normalizeUserInput(input), input);
  }
  assert.equal(normalizeUserInput("  첫 줄\r\n둘째 줄  "), "첫 줄\n둘째 줄");
});

test("새 userInput 필드를 우선하고 legacy prompt 요청도 호환한다", () => {
  assert.deepEqual(
    selectSurveyUserInput({ userInput: "현재 원문", prompt: "이전 필드" }),
    { rawUserInput: "현재 원문", sourceField: "userInput" },
  );
  assert.deepEqual(selectSurveyUserInput({ prompt: "이전 필드" }), {
    rawUserInput: "이전 필드",
    sourceField: "prompt",
  });
});

test("실제 API route도 userInput 원문과 클라이언트 requestId를 그대로 사용한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const requestId = "client-trace-body-001";
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "x-baroform-client-request-id": requestId,
        },
        body: JSON.stringify({
          userInput: "대학생들 중 자취를 하는 학생의 비율을 조사해달라",
          prompt: "대학생 수면 시간 조사",
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 1,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      blueprint?: { title?: string; aiQuestions?: Array<{ title?: string }> };
    };
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-baroform-request-id"), requestId);
    assert.match(body.blueprint?.title ?? "", /자취/);
    assert.match(body.blueprint?.aiQuestions?.[0]?.title ?? "", /자취/);
    assert.doesNotMatch(JSON.stringify(body.blueprint), /수면 시간/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("대표·가상 입력은 OpenAI의 별도 user role에 정확히 한 번만 포함된다", () => {
  for (const input of [...allInvariantInputs, ...regressionInvariantInputs]) {
    const request = buildSurveyAiRequest(input, null, "gpt-test", {
      surveyMode: "standard",
      questionCount: 7,
    });
    assert.deepEqual(openAiUserMessages(request.input), [input]);
    const serialized = JSON.stringify({
      instructions: request.instructions,
      input: request.input,
    });
    assert.equal(serialized.split(input).length - 1, 1, input);
    assert.deepEqual(
      (request.input as Array<{ role: string }>).map((message) => message.role),
      ["developer", "user"],
    );
    const developerMessage = (request.input as Array<{ content: unknown }>)[0]
      ?.content;
    const developerText =
      typeof developerMessage === "string"
        ? developerMessage
        : JSON.stringify(developerMessage);
    assert.doesNotMatch(developerText, /"rawUserInput"|"normalizedInput"/);
    assert.doesNotMatch(developerText, new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(
      developerText,
      /구조는 힌트이며 사용자 원문과 실제 검색 결과가 더 우선한다/,
    );
  }
});

test("대표 입력의 canonical 대상과 응답자를 서로 바꾸지 않는다", () => {
  const academic = parseCanonicalSurveyIntent(representativeInputs[0]);
  assert.equal(academic.audience?.text, "연세대 경영대생");
  assert.equal(academic.entities.find((entity) => entity.role === "primary_entity")?.text, "경영대");
  assert.equal(academic.generationContext.entityType, "academic_organization");

  const movement = parseCanonicalSurveyIntent(representativeInputs[1]);
  assert.equal(movement.generationContext.primaryEntity, "대우관");
  assert.equal(movement.surveyArchetype, "mobility_experience");
  assert.equal(movement.generationContext.isUsageObject, false);

  const platform = parseCanonicalSurveyIntent(representativeInputs[2]);
  assert.equal(
    platform.generationContext.audience,
    "대학생",
  );
  assert.match(platform.generationContext.primaryEntity, /네이버 웹툰/);
  assert.equal(platform.surveyArchetype, "platform_usage");

  const cafeteria = parseCanonicalSurveyIntent(representativeInputs[3]);
  assert.equal(
    cafeteria.generationContext.audience,
    "연세대학교 학생",
  );
  assert.equal(cafeteria.generationContext.primaryEntity, "한경관 학식");

  const serviceSatisfaction = parseCanonicalSurveyIntent(representativeInputs[4]);
  assert.equal(
    serviceSatisfaction.generationContext.audience,
    "맛나샘을 이용하는 학생",
  );
  assert.equal(serviceSatisfaction.generationContext.primaryEntity, "맛나샘");
  assert.equal(serviceSatisfaction.generationContext.entityType, "service");
  assert.equal(serviceSatisfaction.surveyArchetype, "satisfaction");
});

test("처음 보는 관형절에서도 응답자·대상·행동·목적의 관계를 보존한다", () => {
  const perspective = parseCanonicalSurveyIntent(
    "연세대 전체 학생이 바라보는 경영대 시설의 이미지와 이용 경험",
  );
  assert.equal(perspective.generationContext.audience, "연세대 전체 학생");
  assert.equal(perspective.generationContext.primaryEntity, "경영대 시설");
  assert.equal(perspective.surveyArchetype, "mixed");
  assert.deepEqual(perspective.generationContext.researchConstructs, [
    "이미지",
    "이용 경험",
  ]);
  assert.equal(perspective.surveyIntent.intentMode, "single");
  assert.equal(perspective.generationContext.isUsageObject, true);

  const nonUser = parseCanonicalSurveyIntent(
    "맛나샘을 이용하지 않는 연세대 학생들이 이용하지 않는 이유",
  );
  assert.equal(
    nonUser.generationContext.audience,
    "맛나샘을 이용하지 않는 연세대 학생",
  );
  assert.equal(nonUser.generationContext.primaryEntity, "맛나샘");
  assert.equal(nonUser.generationContext.isUsageObject, false);
  assert.match(nonUser.generationContext.researchGoal, /비이용 이유|이용 장벽/);
  assert.equal(nonUser.surveyIntent.intentMode, "single");

  for (const intent of [perspective.surveyIntent, nonUser.surveyIntent]) {
    const schemaCodes = validateSurveyIntentCandidate(intent, {
      title: intent.studyTitle?.text ?? undefined,
      description: intent.purpose ?? undefined,
      questions: [],
    }).map((item) => item.code);
    assert.doesNotMatch(
      schemaCodes.join(" "),
      /MULTIPLE_TARGETS_STORED_AS_SINGLE_STRING|PROPOSED_SOLUTION_NOT_SEPARATED/,
    );
  }

  const mobility = parseCanonicalSurveyIntent(
    "대우관을 오가는 학생들이 느끼는 접근성, 혼잡도와 이동 불편",
  );
  assert.equal(mobility.generationContext.audience, "대우관을 오가는 학생");
  assert.equal(mobility.generationContext.primaryEntity, "대우관");
  assert.equal(mobility.surveyArchetype, "mobility_experience");
  assert.deepEqual(mobility.generationContext.researchConstructs, [
    "접근성",
    "혼잡도",
    "이동 불편",
  ]);

  const platform = parseCanonicalSurveyIntent(
    "네이버 웹툰을 쓰는 대학생의 이용 빈도와 유료 결제 경험",
  );
  assert.equal(platform.generationContext.audience, "네이버 웹툰을 쓰는 대학생");
  assert.equal(platform.generationContext.primaryEntity, "네이버 웹툰");
  assert.equal(platform.surveyArchetype, "platform_usage");
  assert.deepEqual(platform.generationContext.researchConstructs, [
    "이용 빈도",
    "유료 결제 경험",
  ]);

  const multidimensional = parseCanonicalSurveyIntent(
    "연세대 경영대생의 경영대 수업·시설·행정 서비스 만족도",
  );
  assert.equal(multidimensional.generationContext.audience, "연세대 경영대생");
  assert.equal(
    multidimensional.generationContext.primaryEntity,
    "경영대 수업·시설·행정 서비스",
  );
  assert.equal(multidimensional.surveyArchetype, "multidimensional_construct");
  assert.deepEqual(multidimensional.generationContext.researchConstructs, [
    "경영대 수업 만족도",
    "시설 만족도",
    "행정 서비스 만족도",
    "개선 수요",
  ]);
});

test("가상 고유명사에서도 응답자·대상·행동·목적의 의미 역할을 일반화한다", () => {
  const satisfaction = parseCanonicalSurveyIntent(virtualEntityInputs[0]);
  assert.match(satisfaction.generationContext.audience ?? "", /새봄대학교 학생/);
  assert.equal(satisfaction.generationContext.primaryEntity, "솔빛관");
  assert.equal(satisfaction.generationContext.entityType, "university_building");
  assert.equal(satisfaction.surveyArchetype, "satisfaction");
  assert.match(satisfaction.generationContext.researchGoal, /만족|개선/);

  const nonUser = parseCanonicalSurveyIntent(virtualEntityInputs[1]);
  assert.match(nonUser.generationContext.audience ?? "", /별마루 서비스를 이용하지 않는 청년/);
  assert.equal(nonUser.generationContext.primaryEntity, "별마루 서비스");
  assert.equal(nonUser.generationContext.isUsageObject, false);
  assert.equal(nonUser.surveyIntent.includesNonUsers, true);
  assert.match(nonUser.generationContext.researchGoal, /비이용|장벽/);

  const mobility = parseCanonicalSurveyIntent(virtualEntityInputs[2]);
  assert.match(mobility.generationContext.audience ?? "", /해오름관을 오가는 이용자/);
  assert.equal(mobility.generationContext.primaryEntity, "해오름관");
  assert.equal(mobility.surveyArchetype, "mobility_experience");
  assert.equal(mobility.generationContext.isUsageObject, false);
  assert.deepEqual(mobility.generationContext.researchConstructs, [
    "접근성",
    "이동 불편",
  ]);

  const platform = parseCanonicalSurveyIntent(virtualEntityInputs[3]);
  assert.match(platform.generationContext.audience ?? "", /온새미 플랫폼을 사용하는 직장인/);
  assert.equal(platform.generationContext.primaryEntity, "온새미 플랫폼");
  assert.equal(platform.generationContext.entityType, "platform");
  assert.equal(platform.surveyArchetype, "platform_usage");
  assert.deepEqual(platform.generationContext.researchConstructs, [
    "이용 빈도",
    "유료 결제 경험",
  ]);

  const perspective = parseCanonicalSurveyIntent(virtualEntityInputs[4]);
  assert.match(perspective.generationContext.audience ?? "", /새봄대학교 전체 학생/);
  assert.equal(perspective.generationContext.primaryEntity, "창의관 시설");
  assert.equal(perspective.surveyArchetype, "mixed");
  assert.deepEqual(perspective.generationContext.researchConstructs, [
    "이미지",
    "이용 경험",
  ]);

  const facilityExperience = parseCanonicalSurveyIntent(
    "새봄대학교 학생들의 솔빛관 이용 경험과 개선 의견",
  );
  assert.equal(
    facilityExperience.generationContext.audience,
    "새봄대학교 학생",
  );
  assert.equal(facilityExperience.generationContext.primaryEntity, "솔빛관");
  assert.equal(
    facilityExperience.generationContext.entityType,
    "university_building",
  );
  assert.equal(facilityExperience.surveyArchetype, "facility_usage");
  assert.equal(facilityExperience.generationContext.isUsageObject, true);
  assert.equal(facilityExperience.surveyIntent.intentMode, "single");
  assert.deepEqual(facilityExperience.generationContext.researchConstructs, [
    "이용 여부",
    "이용 빈도",
    "이용 목적",
    "만족도",
    "불편",
    "개선 의견",
  ]);

  const multidimensional = parseCanonicalSurveyIntent(virtualEntityInputs[5]);
  assert.match(multidimensional.generationContext.audience ?? "", /경영학부 재학생/);
  assert.equal(multidimensional.surveyArchetype, "multidimensional_construct");
  assert.deepEqual(multidimensional.generationContext.researchConstructs, [
    "전공 수업 만족도",
    "학습 공간 만족도",
    "행정 지원 만족도",
    "개선 수요",
  ]);

  for (const [index, input] of virtualEntityInputs.entries()) {
    const intent = parseCanonicalSurveyIntent(input);
    assert.notEqual(intent.generationContext.primaryEntity, input, `case ${index + 1}`);
    assert.doesNotMatch(
      intent.generationContext.primaryEntity ?? "",
      /조사하고|알아보고|설문을 만들/,
      `case ${index + 1}`,
    );
  }
});

test("trace는 환경변수 없이 메모리 sink로 검증하고 민감값과 첨부 본문을 가린다", async () => {
  assert.equal(isAiTraceEnabled(), false);
  assert.equal(
    traceAiEvent(
      { requestId: "trace-off", stage: "server_received", data: {} },
      () => assert.fail("비활성 trace가 기록되면 안 됩니다."),
    ),
    null,
  );

  const events: unknown[] = [];
  const event = await withAiTraceForTest((payload) => events.push(payload), () =>
    traceAiEvent(
      {
        requestId: "trace-on",
        stage: "server_received",
        data: {
          rawUserInput: "설문 원문",
          authorization: "Bearer secret",
          file_data: "data:application/pdf;base64,AAAA",
        },
      },
    ),
  );
  assert.ok(event);
  assert.equal(events.length, 1);
  assert.deepEqual(event?.data, {
    rawUserInput: "설문 원문",
    authorization: "[REDACTED]",
    file_data: "[REDACTED]",
  });
  assert.equal(isAiTraceEnabled(), false);
});

test("민감 데이터 redaction은 중첩된 쿠키·토큰도 제거한다", () => {
  assert.deepEqual(
    redactSensitiveData({ cookie: "a=b", nested: { accessToken: "secret" } }),
    { cookie: "[REDACTED]", nested: { accessToken: "[REDACTED]" } },
  );
});

test("실 API 평가는 helper가 아니라 운영 Route Handler와 클라이언트 파서를 통과한다", () => {
  const source = readFileSync(
    new URL("../scripts/ai-eval-real.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /POST as createSurveyDraft/);
  assert.match(source, /readSurveyGenerationResponse/);
  assert.match(source, /BAROFORM_ALLOW_LIVE_AI_TESTS/);
  assert.match(source, /ALLOW_REAL_OPENAI_IN_NON_PRODUCTION/);
  assert.match(source, /LIVE_AI_PRODUCTION_FORBIDDEN/);
  assert.match(source, /totalModelCalls > 12/);
  assert.doesNotMatch(source, /from ["']openai["']/);
  assert.doesNotMatch(source, /buildSurveyAiRequest/);
});
