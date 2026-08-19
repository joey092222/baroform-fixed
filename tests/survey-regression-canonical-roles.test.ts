import assert from "node:assert/strict";
import test from "node:test";

import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import { analyzeSurveyPrompt } from "../app/survey-intent";

type ExpectedRoles = {
  input: string;
  audience: RegExp;
  object: RegExp;
  forbiddenObject?: RegExp;
  includesNonUsers?: boolean;
};

const assertRoles = (fixture: ExpectedRoles) => {
  const canonical = parseCanonicalSurveyIntent(fixture.input);
  const audience = canonical.surveyIntent.targetPopulation ?? "";
  const object =
    canonical.surveyIntent.evaluationTargets.join(" ") ||
    canonical.surveyIntent.surveyObject ||
    canonical.generationContext.primaryEntity;

  assert.match(audience, fixture.audience, `audience: ${fixture.input}`);
  assert.match(object, fixture.object, `object: ${fixture.input}`);
  if (fixture.forbiddenObject) {
    assert.doesNotMatch(object, fixture.forbiddenObject, `object: ${fixture.input}`);
  }
  if (fixture.includesNonUsers !== undefined) {
    assert.equal(
      canonical.surveyIntent.includesNonUsers,
      fixture.includesNonUsers,
      `non-user scope: ${fixture.input}`,
    );
  }
};

test("실제 실패 구조: 이용자 관형절 뒤의 복수 목적을 조사 대상으로 평탄화하지 않는다", () => {
  const fixtures: ExpectedRoles[] = [
    {
      input: "새봄대학교 중앙도서관 한 곳의 좌석 만족도, 혼잡 경험, 예약 기능 수요",
      audience: /새봄대학교 중앙도서관.*이용자/,
      object: /새봄대학교 중앙도서관$/,
      forbiddenObject: /만족도|혼잡|예약 기능/,
    },
    {
      input: "학생상담 프로그램을 모르는 재학생의 인지도, 비이용 이유, 이용 의향",
      audience: /학생상담 프로그램.*(?:모르는|이용하지 않는).*재학생/,
      object: /^학생상담 프로그램$/,
      forbiddenObject: /인지도|비이용 이유|이용 의향/,
      includesNonUsers: true,
    },
    {
      input: "지역 체육관을 다니는 주민의 이용 패턴, 불편, 재등록 의향",
      audience: /지역 체육관.*다니는 주민/,
      object: /^지역 체육관$/,
      forbiddenObject: /이용 패턴|불편|재등록/,
    },
  ];

  fixtures.forEach(assertRoles);
});

test("가상 고유명사: 기관·대상·목적을 서로 다른 역할로 보존한다", () => {
  const fixtures: ExpectedRoles[] = [
    {
      input: "푸른대학교 해솔관 이용자의 공간 만족도, 대기 불편, 개선 수요",
      audience: /해솔관.*이용자/,
      object: /해솔관$/,
      forbiddenObject: /만족도|대기 불편|개선 수요/,
    },
    {
      input: "다온 플랫폼을 사용하지 않는 지역 청년의 인지도와 비사용 이유",
      audience: /다온 플랫폼.*사용하지 않는.*청년/,
      object: /^다온 플랫폼$/,
      forbiddenObject: /인지도|비사용 이유/,
      includesNonUsers: true,
    },
  ];

  fixtures.forEach(assertRoles);
});

test("control: 명시된 서비스 이용자와 시설 이용 대상은 기존처럼 유지한다", () => {
  const service = parseCanonicalSurveyIntent(
    "온새미 플랫폼을 사용하는 직장인의 이용 빈도와 오류 경험",
  );
  assert.match(service.surveyIntent.targetPopulation ?? "", /온새미 플랫폼.*사용하는 직장인/);
  assert.match(service.surveyIntent.evaluationTargets.join(" "), /^온새미 플랫폼$/);
  assert.equal(service.generationContext.isUsageObject, true);

  const facility = parseCanonicalSurveyIntent(
    "새봄대학교 학생들의 솔빛관 내부 시설 이용 경험과 만족도",
  );
  assert.match(facility.surveyIntent.targetPopulation ?? "", /새봄대학교 학생/);
  assert.match(facility.surveyIntent.evaluationTargets.join(" "), /솔빛관.*시설/);
  assert.equal(facility.generationContext.isUsageObject, true);
});

test("반대 조건: 전체 학생 조사와 실제 이용자 조사를 같은 모집단으로 축소하지 않는다", () => {
  const allStudents = parseCanonicalSurveyIntent(
    "대학생들의 네이버 웹툰 이용 현황과 경험",
  );
  const users = parseCanonicalSurveyIntent(
    "네이버 웹툰을 이용하는 대학생의 이용 빈도와 만족도",
  );

  assert.match(allStudents.surveyIntent.targetPopulation ?? "", /^대학생$/);
  assert.doesNotMatch(allStudents.surveyIntent.targetPopulation ?? "", /이용하는/);
  assert.match(users.surveyIntent.targetPopulation ?? "", /네이버 웹툰.*이용하는 대학생/);
});

test("행동의 측정 기준을 별도 서비스 이용 대상으로 승격하지 않는다", () => {
  const intent = parseCanonicalSurveyIntent("대학생들의 카공 빈도를 조사하라");

  assert.equal(intent.objectKind, "behavior_usage");
  assert.equal(intent.generationContext.isUsageObject, false);
  assert.match(intent.surveyIntent.surveyObject ?? "", /카공/);
  assert.doesNotMatch(intent.surveyIntent.surveyObject ?? "", /빈도.*이용/);
});

test("이용자 조건과 그 이용자가 평가하는 별도 대상을 분리한다", () => {
  const intent = parseCanonicalSurveyIntent("새봄 서비스 이용자들의 학교생활 만족도");

  assert.match(intent.surveyIntent.targetPopulation ?? "", /새봄 서비스 이용자/);
  assert.equal(intent.surveyIntent.surveyObject, "학교생활");
  assert.equal(intent.generationContext.isUsageObject, false);
});

test("응답자 조건의 기준 기간과 조사 대상 서비스명을 분리한다", () => {
  const intent = parseCanonicalSurveyIntent(
    "최근 6주 동안 다온 플랫폼을 이용한 청년 대상 다온 플랫폼 이용 현황 조사",
  );

  assert.match(intent.surveyIntent.targetPopulation ?? "", /최근 6주.*다온 플랫폼.*청년/);
  assert.equal(intent.surveyIntent.surveyObject, "다온 플랫폼");
  assert.equal(intent.surveyIntent.explicitTimeframe, "최근 6주 동안");
  assert.doesNotMatch(intent.surveyIntent.surveyObject ?? "", /최근 6주/);
});

test("명확한 사전 적격 응답자 문장은 대상·자격·맥락·평가 대상을 분리한다", () => {
  const intent = parseCanonicalSurveyIntent(
    "최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사하고 싶다.",
  );

  assert.match(intent.surveyIntent.targetPopulation ?? "", /최근 한 달.*별마루 카페.*이용한 주민/);
  assert.match(intent.surveyIntent.eligibilityCondition ?? "", /최근 한 달.*별마루 카페.*이용한 주민/);
  assert.equal(intent.surveyIntent.surveyObject, "별마루 카페의 새 메뉴");
  assert.match(intent.surveyIntent.purpose ?? "", /새 메뉴.*만족도/);
  assert.ok(intent.surveyIntent.contexts.some((item) => item.text === "별마루 카페"));
  assert.equal(intent.surveyIntent.explicitTimeframe, "최근 한 달 동안");
  assert.equal(intent.surveyIntent.screeningRequired, true);
  assert.equal(intent.generationContext.isUsageObject, false);
});

test("목적 선행형 noisy 문장도 명확한 문장과 같은 핵심 역할로 복원한다", () => {
  const clear = parseCanonicalSurveyIntent(
    "최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사하고 싶다.",
  );
  const noisy = parseCanonicalSurveyIntent(
    "새 메뉴 만족도는 별마루 카페를 최근 한 달 이용한 주민한테 조사",
  );

  assert.match(noisy.surveyIntent.targetPopulation ?? "", /최근 한 달.*별마루 카페.*이용한 주민/);
  assert.match(noisy.surveyIntent.eligibilityCondition ?? "", /최근 한 달.*별마루 카페.*이용한 주민/);
  assert.equal(noisy.surveyIntent.surveyObject, clear.surveyIntent.surveyObject);
  assert.equal(noisy.surveyIntent.purpose, clear.surveyIntent.purpose);
  assert.equal(noisy.surveyIntent.screeningRequired, true);
  assert.doesNotMatch(noisy.surveyIntent.surveyObject ?? "", /만족도.*카페|주민|최근 한 달/);
});

test("목적 선행형 역할 복원은 앱·프로그램·제품·비이용자 도메인에 일반화된다", () => {
  const fixtures = [
    {
      input: "새 기능 만족도는 다온 앱을 최근 3개월 사용한 대학생에게 조사",
      target: /최근 3개월.*다온 앱.*사용한 대학생/,
      object: "다온 앱의 새 기능",
      purpose: /새 기능.*만족도/,
      context: "다온 앱",
      negative: false,
    },
    {
      input: "프로그램 만족도는 늘봄센터 프로그램에 이번 학기 참여한 학부모에게 조사",
      target: /이번 학기.*늘봄센터 프로그램.*참여한 학부모/,
      object: "늘봄센터 프로그램",
      purpose: /프로그램.*만족도/,
      context: "늘봄센터 프로그램",
      negative: false,
    },
    {
      input: "신제품 만족도는 해든 매장에서 최근 한 달 구매한 고객에게 조사",
      target: /최근 한 달.*해든 매장.*구매한 고객/,
      object: "신제품",
      purpose: /신제품.*만족도/,
      context: "해든 매장",
      negative: false,
    },
    {
      input: "서비스 비이용 이유는 다온 플랫폼을 사용하지 않는 직장인에게 조사",
      target: /다온 플랫폼.*사용하지 않는 직장인/,
      object: "다온 플랫폼",
      purpose: /비이용 이유/,
      context: "다온 플랫폼",
      negative: true,
    },
  ];

  for (const fixture of fixtures) {
    const intent = parseCanonicalSurveyIntent(fixture.input);
    assert.match(intent.surveyIntent.targetPopulation ?? "", fixture.target, fixture.input);
    assert.equal(intent.surveyIntent.surveyObject, fixture.object, fixture.input);
    assert.match(intent.surveyIntent.purpose ?? "", fixture.purpose, fixture.input);
    assert.ok(
      intent.surveyIntent.contexts.some((item) => item.text === fixture.context),
      fixture.input,
    );
    assert.equal(intent.surveyIntent.screeningRequired, true, fixture.input);
    assert.equal(intent.surveyIntent.includesNonUsers, fixture.negative, fixture.input);
  }
});

test("역할 연결어가 없는 bare 명사열은 억지 설문 대신 clarification으로 남긴다", () => {
  const intent = parseCanonicalSurveyIntent("별마루 카페 새 메뉴 주민 조사");

  assert.equal(intent.ambiguity.requiresClarification, true);
  assert.equal(intent.surveyIntent.requiresCreatorClarification, true);
  assert.equal(intent.ambiguity.code, "ENTITY_RESOLUTION_AMBIGUOUS");
});

test("적격 조건은 만족도 목적과 분리된 screening 문항으로 계획된다", () => {
  const input =
    "최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사하고 싶다.";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  const titles = blueprint.aiQuestions.map((question) => question.title);

  assert.equal(titles.length, 7);
  assert.match(titles[0] ?? "", /최근 한 달.*별마루 카페.*(?:이용|방문|구매).*있/);
  assert.ok(titles.some((title) => /새 메뉴.*만족|만족.*새 메뉴/.test(title)));
  assert.equal(
    canonical.surveyIntent.purposeBlocks.some((purpose) => /이용 경험/.test(purpose.text)),
    false,
  );
});

test("control: 이용 경험·전체 만족도·복수 대상 비교는 새 메뉴 목적과 섞이지 않는다", () => {
  const usage = parseCanonicalSurveyIntent(
    "새봄대학교 학생의 별마루 카페 이용 경험과 불편",
  );
  const overall = parseCanonicalSurveyIntent(
    "별마루 카페 이용자의 카페 전체 만족도",
  );
  const comparison = parseCanonicalSurveyIntent(
    "별마루 카페 새 메뉴와 기존 메뉴 이용자의 만족도 비교",
  );

  assert.match(usage.surveyIntent.surveyObject ?? "", /별마루 카페/);
  assert.equal(usage.generationContext.isUsageObject, true);
  assert.doesNotMatch(usage.surveyIntent.purpose ?? "", /새 메뉴/);
  assert.match(overall.surveyIntent.purpose ?? "", /전체.*만족|만족/);
  assert.doesNotMatch(overall.surveyIntent.surveyObject ?? "", /새 메뉴/);
  assert.equal(comparison.surveyIntent.targetCardinality, "multiple");
  assert.match(comparison.surveyIntent.evaluationTargets.join(" "), /새 메뉴/);
  assert.match(comparison.surveyIntent.evaluationTargets.join(" "), /기존 메뉴/);
});

test("control: 분석 기간은 적격 조건이 아니며 사전 선별 대상은 재스크리닝하지 않는다", () => {
  const analysisPeriod = parseCanonicalSurveyIntent(
    "최근 한 달 동안 별마루 카페의 일별 방문 건수 추이 분석",
  );
  const prefiltered = parseCanonicalSurveyIntent(
    "사전 선별된 최근 한 달 동안 별마루 카페 이용 주민에게 별마루 카페의 새 메뉴 만족도 조사",
  );

  assert.equal(analysisPeriod.surveyIntent.screeningRequired, false);
  assert.equal(prefiltered.surveyIntent.surveyObject, "별마루 카페의 새 메뉴");
  assert.match(prefiltered.surveyIntent.eligibilityCondition ?? "", /최근 한 달.*별마루 카페.*이용한 주민/);
  assert.equal(prefiltered.surveyIntent.screeningRequired, false);
});
