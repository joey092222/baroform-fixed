import assert from "node:assert/strict";
import test from "node:test";

import { buildSurveyAiRequest } from "../app/survey-ai";
import { openAiMessageText } from "../app/lib/ai/ai-trace";
import {
  analyzeSurveyPrompt,
  generateSurvey,
  parseSurveyBrief,
  parseSurveySemantics,
} from "../app/survey-intent";
import {
  canUseUsageBlueprint,
  lintSurveyQuestionSemantics,
  parseSurveyGenerationContext,
} from "../app/survey-context";

const mobilityPrompt =
  "연세대학교 학생들의 대우관 등하교 경험에 대해 조사하고 싶다";

function questionCorpus(prompt: string) {
  const blueprint = analyzeSurveyPrompt(prompt);
  return blueprint.aiQuestions
    .flatMap((item) => [item.title, item.reason, ...(item.options ?? [])])
    .join(" ");
}

test("대우관 등하교 요청은 대상·건물·이동·목적을 분리한다", () => {
  const context = parseSurveyGenerationContext(mobilityPrompt);
  assert.deepEqual(
    {
      audience: context.audience,
      primaryEntity: context.primaryEntity,
      entityType: context.entityType,
      activity: context.activity,
      researchGoal: context.researchGoal,
      surveyArchetype: context.surveyArchetype,
      isUsageObject: context.isUsageObject,
    },
    {
      audience: "연세대학교 학생",
      primaryEntity: "대우관",
      entityType: "university_building",
      activity: "대우관 수업이나 활동을 위해 오가는 이동",
      researchGoal: "대우관 등하교 및 이동 경험 파악",
      surveyArchetype: "mobility_experience",
      isUsageObject: false,
    },
  );
  assert.equal(context.normalizedInput, "연세대학교 학생들의 대우관 등하교 경험");

  const semantics = parseSurveySemantics(mobilityPrompt);
  const brief = parseSurveyBrief(mobilityPrompt);
  assert.equal(semantics.evaluationTarget, "대우관 등하교 경험");
  assert.equal(brief.researchSubject, "대우관 등하교 경험");
  assert.equal(brief.targetRespondents, "연세대학교 학생");
});

test("이동 경험 설문은 이동 변수로 구성하고 generic usage 문구를 만들지 않는다", () => {
  const blueprint = analyzeSurveyPrompt(mobilityPrompt);
  const corpus = questionCorpus(mobilityPrompt);

  assert.equal(blueprint.selectedTemplateKey, "mobility_experience_blueprint");
  assert.match(corpus, /등교하거나.*하교하는 빈도/);
  assert.match(corpus, /이동 수단/);
  assert.match(corpus, /편도.*얼마나 걸리/);
  assert.match(corpus, /혼잡/);
  assert.match(corpus, /이동 안전/);
  assert.match(corpus, /겪은 불편/);
  assert.match(corpus, /가장 먼저 필요한 변화/);
  assert.doesNotMatch(corpus, /에\s*대해를|에\s*관해를|경험(?:에\s*대해)?를\s*이용/);
  assert.doesNotMatch(corpus, /대우관.*얼마나\s*자주\s*이용/);
  assert.doesNotMatch(corpus, /이용 경험이 있는 응답자와 비이용자|이용 빈도를 구간별/);
});

test("서비스·시설 이용과 이동 경험을 서로 다른 archetype으로 분류한다", () => {
  const webtoon = parseSurveyGenerationContext(
    "대학생의 네이버 웹툰 이용 경험을 조사하고 싶다",
  );
  assert.equal(webtoon.surveyArchetype, "platform_usage");
  assert.equal(webtoon.isUsageObject, true);
  assert.match(questionCorpus("대학생의 네이버 웹툰 이용 경험을 조사하고 싶다"), /이용한 적/);

  const facility = parseSurveyGenerationContext(
    "대우관 내부 시설 이용 경험을 조사하고 싶다",
  );
  assert.equal(facility.surveyArchetype, "facility_usage");
  assert.equal(facility.isUsageObject, true);
  assert.match(questionCorpus("대우관 내부 시설 이용 경험을 조사하고 싶다"), /이용/);

  const commute = parseSurveyGenerationContext(
    "대학생들의 통학 경험과 통학 중 불편을 조사하고 싶다",
  );
  assert.equal(commute.surveyArchetype, "mobility_experience");
  assert.equal(commute.isUsageObject, false);
  assert.doesNotMatch(
    questionCorpus("대학생들의 통학 경험과 통학 중 불편을 조사하고 싶다"),
    /통학(?:을|를).*이용한 적|통학.*얼마나 자주 이용/,
  );
});

test("복합 이용 경험·신규 서비스 수요는 mixed로 유지한다", () => {
  const prompt =
    "학교 근처 카페 이용 경험과 빈좌석 알림 서비스 도입 수요를 조사하고 싶다";
  const context = parseSurveyGenerationContext(prompt);
  const corpus = questionCorpus(prompt);

  assert.equal(context.surveyArchetype, "mixed");
  assert.equal(context.entityType, "mixed");
  assert.match(corpus, /카페/);
  assert.match(corpus, /빈좌석 알림 서비스/);
  assert.match(corpus, /현재 이용|이용 빈도|얼마나 자주/);
  assert.match(corpus, /필요|도입|이용할 의향/);
  assert.doesNotMatch(corpus, /이용 경험과 빈좌석 알림 서비스.*(?:를|을) 이용/);
});

test("predicate semantic lint가 조사 메타 표현과 실체-서술어 불일치를 검출한다", () => {
  const context = parseSurveyGenerationContext(mobilityPrompt);
  const issues = lintSurveyQuestionSemantics(context, [
    {
      id: 1,
      title: "대우관 등하교 경험에 대해를 이용한 적이 있나요?",
      reason: "이용 경험이 있는 응답자와 비이용자의 답변을 함께 해석함.",
    },
    {
      id: 2,
      title: "평소 대우관 등하교 경험에 대해를 얼마나 자주 이용하나요?",
      reason: "이용 빈도를 구간별로 비교함.",
    },
  ]);
  const codes = new Set(issues.map((item) => item.code));
  assert.ok(codes.has("MALFORMED_TOPIC_PARTICLE"));
  assert.ok(codes.has("PREDICATE_ENTITY_MISMATCH"));
});

test("OpenAI 요청에도 분리된 이동 컨텍스트와 predicate 정책을 전달한다", () => {
  const request = buildSurveyAiRequest(
    mobilityPrompt,
    analyzeSurveyPrompt(mobilityPrompt),
    "gpt-5.6-terra",
  );
  const input = openAiMessageText(request.input);
  assert.match(input, /\[실체·활동·조사목적 분리 컨텍스트\]/);
  assert.match(input, /"surveyArchetype":"mobility_experience"/);
  assert.match(input, /"primaryEntity":"대우관"/);
  assert.match(input, /"isUsageObject":false/);
  assert.match(input, /generic usage 문항을 금지/);
});

test("generic usage blueprint는 실제 이용 가능한 대상에만 허용한다", () => {
  const mobility = parseSurveyGenerationContext(mobilityPrompt);
  const platform = parseSurveyGenerationContext(
    "대학생의 네이버 웹툰 이용 경험을 조사하고 싶다",
  );

  assert.equal(canUseUsageBlueprint(mobility), false);
  assert.equal(canUseUsageBlueprint(platform), true);
  assert.equal(
    canUseUsageBlueprint(platform, "네이버 웹툰 이용 경험에 대해 조사하고 싶다"),
    false,
  );
});

test("이동 요청은 요청형·명사형 진입점 모두 같은 mobility blueprint를 사용한다", () => {
  for (const prompt of [
    mobilityPrompt,
    "대우관 등하교에 대한 의견 조사",
    "대학생들의 통학 경험과 통학 중 불편을 조사하고 싶다",
  ]) {
    const context = parseSurveyGenerationContext(prompt);
    const brief = parseSurveyBrief(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);
    const generated = generateSurvey(brief);

    assert.equal(context.surveyArchetype, "mobility_experience");
    assert.equal(context.isUsageObject, false);
    assert.equal(brief.parsedSurveyContext.surveyArchetype, "mobility_experience");
    assert.equal(blueprint.selectedTemplateKey, "mobility_experience_blueprint");
    assert.equal(generated.selectedTemplateKey, "mobility_experience_blueprint");
    assert.doesNotMatch(
      [...blueprint.aiQuestions, ...generated.aiQuestions]
        .map((item) => item.title)
        .join(" "),
      /경험(?:에\s*대해)?(?:을|를)\s*이용|얼마나\s*자주\s*이용/,
    );
  }
});
