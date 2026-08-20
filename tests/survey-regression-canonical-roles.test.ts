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

test("소유격 뒤 응답자와 이용 현황이 이어져도 응답자를 조사 대상에 붙이지 않는다", () => {
  const intent = parseCanonicalSurveyIntent(
    "현재 국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생 이용 현황과 경험을 분석하고 싶어",
  ).surveyIntent;

  assert.equal(intent.targetPopulation, "대학생");
  assert.equal(intent.surveyObject, "네이버 웹툰");
  assert.doesNotMatch(intent.surveyObject ?? "", /대학생|이용 현황|경험/u);
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
      targetMustInclude: /다온 앱을 사용한 대학생/,
      targetMustExclude: /다온 앱에 사용|다온 앱에서 사용/,
      activity: /다온 앱 사용/,
      negative: false,
    },
    {
      input: "프로그램 만족도는 늘봄센터 프로그램에 이번 학기 참여한 학부모에게 조사",
      target: /이번 학기.*늘봄센터 프로그램.*참여한 학부모/,
      object: "늘봄센터 프로그램",
      purpose: /프로그램.*만족도/,
      context: "늘봄센터 프로그램",
      targetMustInclude: /늘봄센터 프로그램에 참여한 학부모/,
      targetMustExclude: /늘봄센터 프로그램을 참여한/,
      activity: /늘봄센터 프로그램에 참여/,
      negative: false,
    },
    {
      input: "신제품 만족도는 해든 매장에서 최근 한 달 구매한 고객에게 조사",
      target: /최근 한 달.*해든 매장.*구매한 고객/,
      object: "신제품",
      purpose: /신제품.*만족도/,
      context: "해든 매장",
      targetMustInclude: /해든 매장에서 구매한 고객/,
      targetMustExclude: /해든 매장을 구매한/,
      activity: /해든 매장에서 구매/,
      negative: false,
    },
    {
      input: "서비스 비이용 이유는 다온 플랫폼을 사용하지 않는 직장인에게 조사",
      target: /다온 플랫폼.*사용하지 않는 직장인/,
      object: "다온 플랫폼",
      purpose: /비이용 이유/,
      context: "다온 플랫폼",
      targetMustInclude: /다온 플랫폼을 사용하지 않는 직장인/,
      targetMustExclude: /다온 플랫폼에 사용하지/,
      activity: null,
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
    assert.match(
      intent.surveyIntent.targetPopulation ?? "",
      fixture.targetMustInclude,
      fixture.input,
    );
    assert.doesNotMatch(
      intent.surveyIntent.targetPopulation ?? "",
      fixture.targetMustExclude,
      fixture.input,
    );
    if (fixture.activity) {
      assert.match(
        intent.surveyIntent.activities.map((activity) => activity.text).join(" "),
        fixture.activity,
        fixture.input,
      );
    }
  }
});

test("목적 선행형 적격 조건은 장소·프로그램·서비스의 문법 관계를 보존한다", () => {
  const fixtures = [
    {
      input: "상품 만족도는 솔나래 상점에서 지난 두 달 구매한 소비자에게 조사",
      audience: /솔나래 상점에서 구매한 소비자/,
      activity: /솔나래 상점에서 구매/,
      forbidden: /솔나래 상점을 구매한/,
    },
    {
      input: "교육 만족도는 해오름 교육에 이번 학기 참여한 교직원에게 조사",
      audience: /해오름 교육에 참여한 교직원/,
      activity: /해오름 교육에 참여/,
      forbidden: /해오름 교육을 참여한/,
    },
    {
      input: "기능 평가는 모아 앱을 최근 두 달 사용한 고객에게 조사",
      audience: /모아 앱을 사용한 고객/,
      activity: /모아 앱 사용/,
      forbidden: /모아 앱에서 사용한/,
    },
    {
      input: "시설 인식은 솔빛 체육관 최근 두 달 이용한 주민한테 조사",
      audience: /최근 두 달 솔빛 체육관을 이용한 주민/,
      activity: /솔빛 체육관 이용/,
      forbidden: /솔빛 체육관에 이용한/,
    },
  ];

  for (const fixture of fixtures) {
    const canonical = parseCanonicalSurveyIntent(fixture.input);
    assert.match(canonical.surveyIntent.targetPopulation ?? "", fixture.audience);
    assert.doesNotMatch(canonical.surveyIntent.targetPopulation ?? "", fixture.forbidden);
    assert.match(
      canonical.surveyIntent.activities.map((activity) => activity.text).join(" "),
      fixture.activity,
    );
  }
});

test("목적 선행형 비이용·불참·미구매 조건은 부정을 잃지 않는다", () => {
  const fixtures = [
    {
      input: "서비스 비이용 이유는 누리 플랫폼을 사용하지 않은 직장인에게 조사",
      audience: /누리 플랫폼을 사용하지 않은 직장인/,
      forbidden: /누리 플랫폼을 사용한 직장인/,
    },
    {
      input: "프로그램 불참 이유는 새길 교육에 이번 학기 참여하지 않은 교직원에게 조사",
      audience: /이번 학기 새길 교육에 참여하지 않은 교직원/,
      forbidden: /새길 교육을 참여하지/,
    },
    {
      input: "상품 미구매 이유는 온빛 상점에서 최근 한 달 구매하지 않은 고객에게 조사",
      audience: /최근 한 달 온빛 상점에서 구매하지 않은 고객/,
      forbidden: /온빛 상점을 구매하지/,
    },
  ];

  for (const fixture of fixtures) {
    const canonical = parseCanonicalSurveyIntent(fixture.input);
    assert.match(canonical.surveyIntent.targetPopulation ?? "", fixture.audience);
    assert.doesNotMatch(canonical.surveyIntent.targetPopulation ?? "", fixture.forbidden);
    assert.equal(canonical.surveyIntent.includesNonUsers, true);
    assert.equal(canonical.surveyIntent.screeningRequired, true);
  }
});

test("전체 집단의 이용 경험 조사는 적격 이용자로 응답 대상을 축소하지 않는다", () => {
  const input = "새봄대학교 학생의 별마루 카페 이용 경험과 불편";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);

  assert.equal(canonical.surveyIntent.targetPopulation, "새봄대학교 학생");
  assert.equal(canonical.surveyIntent.screeningRequired, false);
  assert.equal(blueprint.respondentGroup, "새봄대학교 학생");
  assert.ok(blueprint.aiQuestions.some((question) => /이용한 적|이용 여부/.test(question.title)));
});

test("명시된 이동 경험 모집단은 방문자로 축소하지 않고 비경험 경로를 유지한다", () => {
  const input = "새길대학교 학생들의 온빛관 등하교 경험";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);

  assert.equal(canonical.surveyIntent.targetPopulation, "새길대학교 학생");
  assert.equal(canonical.surveyIntent.includesNonUsers, true);
  assert.equal(blueprint.respondentGroup, "새길대학교 학생");
  assert.ok(
    blueprint.aiQuestions[0]?.options?.some((option) => /경험 없음/.test(option)),
  );
});

test("복수 대상만 명시된 비교는 전체 요청을 대상화하지 않고 공통 경험자를 파생한다", () => {
  const input = "새길대학교 온빛 식당과 별하 식당의 가격·맛·대기시간 비교";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  const corpus = blueprint.aiQuestions.map((question) => question.title).join(" ");

  assert.equal(canonical.surveyIntent.targetCardinality, "multiple");
  assert.match(canonical.surveyIntent.targetPopulation ?? "", /온빛 식당.*별하 식당.*모두 이용/);
  assert.deepEqual(canonical.surveyIntent.evaluationTargets, [
    "새길대학교 온빛 식당",
    "별하 식당",
  ]);
  assert.equal(blueprint.evaluationTarget, "새길대학교 온빛 식당·별하 식당");
  assert.match(corpus, /새길대학교 온빛 식당.*가격/);
  assert.match(corpus, /별하 식당.*가격/);
  assert.match(corpus, /새길대학교 온빛 식당.*맛/);
  assert.match(corpus, /별하 식당.*맛/);
  assert.match(corpus, /새길대학교 온빛 식당.*대기시간/);
  assert.match(corpus, /별하 식당.*대기시간/);
  assert.doesNotMatch(corpus, /가격·맛·대기시간 비교를 이용/);
});

test("플랫폼 비교는 두 이용 대상을 보존하고 사용성과 지속 사용 의향을 각각 측정한다", () => {
  const input = "iOS용 공부 앱과 안드로이드용 공부 앱의 사용성 및 지속 사용 의향 비교";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  const corpus = blueprint.aiQuestions.map((question) => question.title).join(" ");

  assert.equal(canonical.surveyIntent.targetCardinality, "multiple");
  assert.match(canonical.surveyIntent.targetPopulation ?? "", /iOS용 공부 앱.*안드로이드용 공부 앱.*모두 사용/);
  assert.deepEqual(canonical.surveyIntent.evaluationTargets, [
    "iOS용 공부 앱",
    "안드로이드용 공부 앱",
  ]);
  assert.match(corpus, /iOS용 공부 앱.*사용성/);
  assert.match(corpus, /안드로이드용 공부 앱.*사용성/);
  assert.match(corpus, /iOS용 공부 앱.*계속 이용할 의향/);
  assert.match(corpus, /안드로이드용 공부 앱.*계속 이용할 의향/);
  assert.doesNotMatch(corpus, /사용성 및 지속 사용 의향 비교를 이용/);
});

test("역할 연결어가 없는 bare 명사열은 억지 설문 대신 clarification으로 남긴다", () => {
  const intent = parseCanonicalSurveyIntent("별마루 카페 새 메뉴 주민 조사");

  assert.equal(intent.ambiguity.requiresClarification, true);
  assert.equal(intent.surveyIntent.requiresCreatorClarification, true);
  assert.equal(intent.ambiguity.code, "ENTITY_RESOLUTION_AMBIGUOUS");
});

test("구체적인 대상이나 목적이 빠진 짧은 입력만 clarification으로 보낸다", () => {
  const fixtures = [
    {
      input: "시설 이용",
      missing: ["survey_object", "research_purpose", "target_population"],
    },
    {
      input: "학생들 생각",
      missing: ["survey_object", "research_purpose"],
    },
    {
      input: "두 개 비교",
      missing: ["comparison_targets", "survey_object", "research_purpose"],
    },
  ];

  for (const fixture of fixtures) {
    const canonical = parseCanonicalSurveyIntent(fixture.input);
    assert.equal(canonical.surveyIntent.requiresCreatorClarification, true, fixture.input);
    assert.equal(canonical.ambiguity.requiresClarification, true, fixture.input);
    for (const role of fixture.missing) {
      assert.ok(canonical.ambiguity.missingRoles?.includes(role as never), `${fixture.input}: ${role}`);
    }
    assert.ok((canonical.ambiguity.reasons ?? []).length > 0, fixture.input);
  }
});

test("측정 대상과 목적을 복원할 수 있는 noisy 입력은 clarification으로 오인하지 않는다", () => {
  const comparison = parseCanonicalSurveyIntent(
    "통계학 강의와 프로그래밍 강의가 데이터 분석 자신감에 미치는 영향을 비교",
  );
  assert.equal(comparison.surveyIntent.requiresCreatorClarification, false);
  assert.equal(comparison.surveyIntent.targetCardinality, "multiple");
  assert.deepEqual(comparison.surveyIntent.evaluationTargets, [
    "통계학 강의",
    "프로그래밍 강의",
  ]);
  assert.match(comparison.surveyIntent.purpose ?? "", /데이터 분석 자신감.*영향.*비교/);

  const colloquial = parseCanonicalSurveyIntent(
    "경영대생들 경영대 시설 괜찮았는지랑 불편했던 점 조사",
  );
  assert.equal(colloquial.surveyIntent.requiresCreatorClarification, false);
  assert.equal(colloquial.surveyIntent.targetPopulation, "경영대생");
  assert.equal(colloquial.surveyIntent.surveyObject, "경영대 시설");
  assert.match(colloquial.surveyIntent.purpose ?? "", /전반적 만족도/);
  assert.match(colloquial.surveyIntent.purpose ?? "", /불편/);
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

test("부정 응답자 관형절과 후행 복수 목적을 survey object와 분리한다", () => {
  const fixtures = [
    {
      input: "동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기",
      target: /동아리.*참여하지 않은 신입생/,
      object: "동아리",
      purposes: [/학교 적응/, /미가입 이유/],
    },
    {
      input: "네웹 안 쓰는 대학생들 왜 안 쓰는지 앞으로 쓸 생각 있는지",
      target: /네웹.*이용하지 않는 대학생/,
      object: "네웹",
      purposes: [/비이용 이유/, /향후 사용 의향/],
    },
    {
      input: "프로그램에 참여하지 않은 학부모의 비참여 이유와 향후 참여 의향",
      target: /프로그램.*참여하지 않은 학부모/,
      object: "프로그램",
      purposes: [/비참여 이유/, /향후 참여 의향/],
    },
    {
      input: "앱을 쓰지 않는 직장인의 비이용 이유와 향후 사용 의향",
      target: /앱.*쓰지 않는 직장인/,
      object: "앱",
      purposes: [/비이용 이유/, /향후 사용 의향/],
    },
    {
      input: "제품을 구매하지 않은 소비자의 장벽과 구매 가능성",
      target: /제품.*구매하지 않은 소비자/,
      object: "제품",
      purposes: [/장벽/, /구매 가능성/],
    },
    {
      input: "시설을 이용하지 않는 주민의 인식과 향후 방문 의향",
      target: /시설.*이용하지 않는 주민/,
      object: "시설",
      purposes: [/인식/, /향후 방문 의향/],
    },
    {
      input: "서비스를 탈퇴한 이용자의 탈퇴 이유와 재가입 의향",
      target: /서비스.*탈퇴한 이용자/,
      object: "서비스",
      purposes: [/탈퇴 이유/, /재가입 의향/],
    },
  ];

  for (const fixture of fixtures) {
    const canonical = parseCanonicalSurveyIntent(fixture.input);
    const intent = canonical.surveyIntent;
    assert.match(intent.targetPopulation ?? "", fixture.target, fixture.input);
    assert.equal(intent.surveyObject, fixture.object, fixture.input);
    assert.equal(intent.includesNonUsers, true, fixture.input);
    assert.equal(intent.requiresCreatorClarification, false, fixture.input);
    assert.doesNotMatch(intent.surveyObject ?? "", /왜|이유|의향|생각|물어보기/u);
    for (const purpose of fixture.purposes) {
      assert.match(intent.purpose ?? "", purpose, fixture.input);
      assert.ok(
        intent.purposeBlocks.some((block) => purpose.test(block.text)),
        `${fixture.input}: ${purpose}`,
      );
    }
  }
});

test("비참여 응답자의 독립 목적은 이용 경험 템플릿으로 평탄화하지 않는다", () => {
  const input = "동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  const corpus = blueprint.aiQuestions.map((question) => question.title).join(" ");

  assert.equal(blueprint.respondentGroup, "동아리에 참여하지 않은 신입생");
  assert.equal(blueprint.evaluationTarget, "동아리");
  assert.match(corpus, /학교.*적응/);
  assert.match(corpus, /동아리.*(?:참여|가입)하지 않는.*이유/);
  assert.doesNotMatch(corpus, /동아리.*이용한 적|핵심 경험|요소\s*\d/u);
});

test("빈도 임계값이 붙은 비실천자는 응답 조건과 행동 대상을 분리한다", () => {
  const fixtures = [
    {
      input: "주 1회도 운동하지 않는 성인의 운동 방해 요인",
      audience: "주 1회도 운동하지 않는 성인",
      object: "운동",
    },
    {
      input: "월 1회도 독서하지 않는 직장인의 독서 장벽",
      audience: "월 1회도 독서하지 않는 직장인",
      object: "독서",
    },
  ];

  for (const fixture of fixtures) {
    const canonical = parseCanonicalSurveyIntent(fixture.input);
    const blueprint = analyzeSurveyPrompt(fixture.input, canonical);
    const corpus = blueprint.aiQuestions.map((question) => question.title).join(" ");

    assert.equal(canonical.surveyIntent.targetPopulation, fixture.audience);
    assert.equal(canonical.surveyIntent.surveyObject, fixture.object);
    assert.equal(canonical.surveyIntent.includesNonUsers, true);
    assert.match(canonical.surveyIntent.purpose ?? "", /비실천 이유/);
    assert.match(corpus, /실천하지 않는 가장 큰 이유|실천하기 어렵게 만드는/);
    assert.doesNotMatch(corpus, /성인의.*요인.*선택|핵심 경험|요소\s*\d/u);
  }
});

test("응답자가 두 대상을 선택하는 이유와 만족도를 비교하면 대상별 같은 척도를 만든다", () => {
  const input =
    "연세대 학생이 한경관 학식과 고를샘 식당을 선택하는 이유와 만족도 비교";
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  const titles = blueprint.aiQuestions.map((question) => question.title);

  assert.equal(canonical.surveyIntent.targetPopulation, "연세대 학생");
  assert.deepEqual(canonical.surveyIntent.evaluationTargets, [
    "한경관 학식",
    "고를샘 식당",
  ]);
  assert.deepEqual(canonical.surveyIntent.constructs, ["선택 이유", "만족도"]);
  assert.ok(titles.some((title) => /한경관 학식.*선택하는.*이유/.test(title)));
  assert.ok(titles.some((title) => /고를샘 식당.*선택하는.*이유/.test(title)));
  assert.ok(titles.some((title) => /한경관 학식.*전반적으로.*만족/.test(title)));
  assert.ok(titles.some((title) => /고를샘 식당.*전반적으로.*만족/.test(title)));
  assert.doesNotMatch(titles.join(" "), /이유와 만족도 비교.*만족/u);
});

test("축약된 비이용자 요청도 응답자·대상·이유·향후 의향으로 분리한다", () => {
  const canonical = parseCanonicalSurveyIntent(
    "별숲앱 안쓰는 자영업자 왜안씀 앞으로쓸지 조사",
  );
  const intent = canonical.surveyIntent;

  assert.equal(intent.targetPopulation, "별숲앱을 이용하지 않는 자영업자");
  assert.equal(intent.surveyObject, "별숲앱");
  assert.equal(intent.includesNonUsers, true);
  assert.equal(intent.screeningRequired, true);
  assert.deepEqual(intent.constructs, ["비이용 이유", "향후 사용 의향"]);
  assert.doesNotMatch(intent.surveyObject ?? "", /왜|안씀|앞으로|조사/u);
});

test("구체적인 서비스·시설명은 만족도 세부 항목에 의해 덮이지 않는다", () => {
  const fixtures = [
    ["한들식당 이용자의 맛, 주문, 직원 대응, 전반적 만족도", "한들식당"],
    ["누리길 앱 이용자의 앱 전체 만족도와 오류 경험", "누리길 앱"],
    ["늘해랑 보건소 이용자의 안내, 접근성, 대기 만족도", "늘해랑 보건소"],
    ["달빛장터 방문객의 행사 만족도와 재방문 의향", "달빛장터"],
  ] as const;

  for (const [input, expectedObject] of fixtures) {
    const intent = parseCanonicalSurveyIntent(input).surveyIntent;
    assert.equal(intent.surveyObject, expectedObject, input);
    assert.doesNotMatch(
      intent.surveyObject ?? "",
      /^(?:맛|주문|직원 대응|앱 전체|오류 경험|안내|접근성|대기|행사)$/u,
      input,
    );
  }
});

test("학과 학생의 복합 인식·개선 요청은 construct와 purpose로 보존한다", () => {
  const intent = parseCanonicalSurveyIntent(
    "새빛대학교 환경공학과 학생의 실험실 안전 인식과 개선 요구 조사",
  ).surveyIntent;

  assert.equal(intent.targetPopulation, "새빛대학교 환경공학과 학생");
  assert.equal(intent.surveyObject, "실험실 안전");
  assert.deepEqual(intent.constructs, ["인식", "개선 요구"]);
  assert.match(intent.purpose ?? "", /인식/);
  assert.match(intent.purpose ?? "", /개선 요구/);
});
