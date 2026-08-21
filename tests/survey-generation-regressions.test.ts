import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import { parseSurveyIntent } from "../app/survey-semantic-intent";

// 사용자 제보 1: "설문 내용을 안전하게 다듬지 못했어요" 토스트로 생성이 막혔다.
// 생성기는 "지각 빈도"를 "수업이나 약속에 늦은 빈도"로 표현하는데
// questionCoversVariable에는 "지각 횟수"만 등록되어 있었고, validateSurvey가
// measuredVariable 메타데이터를 넘기지 않아 제목 문자열 매칭만 남았다.
// 결과적으로 정상 문항이 미측정으로 오판되어 422로 폐기됐다.
const relationalPrompts = [
  "대학생들의 수면 시간과 그들의 지각 빈도 간 관계 조사",
  "대학생들의 수면 시간과 그에 따른 지각 빈도 조사",
];

for (const prompt of relationalPrompts) {
  test(`관계형 프롬프트는 검증을 통과한다: ${prompt}`, () => {
    const brief = parseSurveyBrief(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);

    assert.deepEqual(validateSurvey(prompt, brief, blueprint), []);
    assert.equal(blueprint.aiQuestions.length, 7);
  });
}

test("지각 빈도는 응답자 수준 변수로 추출되고 대명사가 섞이지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const research = parseSurveyIntent(prompt).researchIntent;
  const names = research.variables
    .filter((item) => item.scope === "respondent_level")
    .map((item) => item.name);

  assert.deepEqual(names, ["수면 시간", "지각 빈도"]);
  for (const name of names) {
    assert.doesNotMatch(name, /그들의|이들의|해당\s/);
  }
});

test("관계형 설문 제목과 문항에 대명사가 노출되지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = [
    blueprint.title,
    blueprint.description,
    ...blueprint.aiQuestions.map((item) => item.title),
  ].join(" ");

  assert.equal(blueprint.title, "대학생의 수면 시간과 지각 빈도 조사");
  assert.doesNotMatch(corpus, /그들의|이들의/);
});

test("사용자가 기간을 적지 않으면 문항이 기간을 지어내지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  // INVENTED_TIMEFRAME 규칙과 같은 패턴. 생성기가 스스로 위반하면 안 된다.
  assert.doesNotMatch(
    corpus,
    /(?:최근|지난)\s*(?:\d+\s*(?:일|주|개월|달|년)|한\s*(?:주|달|해)|일주일)|(?:이번|지난)\s*(?:학기|학년도)/,
  );
});

test("사용자가 기간을 적으면 그 기간을 문항에 사용한다", () => {
  const prompt = "대학생들의 이번 학기 수면 시간과 그에 따른 지각 빈도 조사";
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.match(corpus, /이번 학기/);
});

// 사용자 제보 2: 문항 5가 "sns 이용 시간을 주로 어떤 목적으로 쓰나요?"로 나왔다.
// focus("SNS 이용")가 이미 행위 명사로 끝나는데 템플릿이 "시간"을 다시 붙여,
// 목적을 묻는 대상이 행위가 아니라 시간이 됐다.
test("시간 측정 설문의 목적 문항은 시간이 아니라 행위를 묻는다", () => {
  const blueprint = analyzeSurveyPrompt("대학생들의 SNS 이용 시간 조사");
  const purpose = blueprint.aiQuestions.find((item) =>
    /어떤 목적으로/.test(item.title),
  );

  assert.equal(purpose?.title, "SNS를 주로 어떤 목적으로 이용하나요?");
  assert.doesNotMatch(
    blueprint.aiQuestions.map((item) => item.title).join(" "),
    /시간을 주로 어떤 목적으로 쓰나요/,
  );
});

test("두문자어는 사용자가 소문자로 입력해도 대문자로 표기된다", () => {
  const blueprint = analyzeSurveyPrompt("대학생들의 sns 이용 시간 조사");
  const corpus = [
    blueprint.title,
    ...blueprint.aiQuestions.map((item) => item.title),
  ].join(" ");

  assert.match(blueprint.title, /SNS/);
  assert.doesNotMatch(corpus, /\bsns\b/);
});

test("행위 대상이 없는 시간 측정은 목적 문항 대신 맥락 문항을 쓴다", () => {
  // "통학 시간" → focus "통학". "통학을 어떤 목적으로 통학하나요?"가 되면 안 된다.
  const blueprint = analyzeSurveyPrompt("직장인의 통학 시간 조사");
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.doesNotMatch(corpus, /통학하나요\?/);
});
