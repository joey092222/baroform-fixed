import assert from "node:assert/strict";
import test from "node:test";

import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import { analyzeSurveyPrompt, resizeSurveyQuestions } from "../app/survey-intent";

function titlesFor(input: string) {
  const canonical = parseCanonicalSurveyIntent(input);
  const blueprint = analyzeSurveyPrompt(input, canonical);
  return {
    canonical,
    blueprint,
    titles: resizeSurveyQuestions(blueprint.aiQuestions, 7).map(
      (question) => question.title,
    ),
  };
}

test("문항 수 확장은 명시적인 설계 후보만 사용하고 범용 filler를 만들지 않는다", () => {
  const base = [
    {
      id: 1,
      title: "현재 경험을 전반적으로 어떻게 평가하시나요?",
      reason: "전체 평가를 확인함.",
      type: "scale" as const,
      required: true,
      scaleMin: 1,
      scaleMax: 5,
    },
    {
      id: 2,
      title: "추가 의견을 적어주세요.",
      reason: "구체적인 의견을 수집함.",
      type: "text" as const,
      required: false,
    },
  ];
  const expansion = [
    ...base,
    {
      id: 3,
      title: "가장 만족한 부분은 무엇인가요?",
      reason: "강점 영역을 확인함.",
      type: "multiple" as const,
      required: true,
      options: ["내용", "편의성", "지원"],
    },
  ];

  const withoutCandidates = resizeSurveyQuestions(base, 7);
  const withCandidates = resizeSurveyQuestions(base, 7, expansion);

  assert.equal(withoutCandidates.length, 2);
  assert.deepEqual(
    withCandidates.map((question) => question.title),
    [
      "현재 경험을 전반적으로 어떻게 평가하시나요?",
      "가장 만족한 부분은 무엇인가요?",
      "추가 의견을 적어주세요.",
    ],
  );
  assert.ok(
    [...withoutCandidates, ...withCandidates].every(
      (question) => !/중요하게 생각하는 요소/.test(question.title),
    ),
  );
});

test("시설 인식 목적은 이용 경험 설문으로 바뀌지 않고 적격 기간을 보존한다", () => {
  const { blueprint, titles } = titlesFor(
    "시설 인식은 푸른 체육관을 최근 두 달 이용한 주민에게 조사",
  );

  assert.equal(blueprint.kind, "awareness");
  assert.equal(titles.length, 7);
  assert.match(titles[0] ?? "", /최근 두 달.*푸른 체육관.*이용.*있/);
  assert.ok(titles.some((title) => /전반적.*인상|인식/.test(title)));
  assert.ok(titles.some((title) => /긍정적인 이미지/.test(title)));
  assert.ok(titles.some((title) => /부정적으로 느끼는/.test(title)));
  assert.ok(titles.every((title) => !/중요하게 생각하는 요소/.test(title)));
});

test("전체 학생의 시설 이용 경험 조사는 학생 여부 재스크리너로 문항을 낭비하지 않는다", () => {
  const { canonical, titles } = titlesFor(
    "새길대학교 학생의 온빛 카페 이용 경험과 불편",
  );

  assert.equal(canonical.surveyIntent.targetPopulation, "새길대학교 학생");
  assert.equal(canonical.surveyIntent.screeningRequired, false);
  assert.equal(titles.length, 7);
  assert.match(titles[0] ?? "", /온빛 카페.*이용한 적/);
  assert.ok(titles.every((title) => !/대학교 또는 대학원에 재학/.test(title)));
  assert.ok(titles.some((title) => /불편/.test(title)));
});

test("단일 만족도 fallback은 7개 모두 목적이 있는 문항으로 구성한다", () => {
  const { titles } = titlesFor("온빛 카페 이용자의 카페 전체 만족도");

  assert.equal(titles.length, 7);
  assert.ok(titles.some((title) => /전반적으로 얼마나 만족/.test(title)));
  assert.ok(titles.some((title) => /추천할 의향/.test(title)));
  assert.ok(titles.every((title) => !/중요하게 생각하는 요소/.test(title)));
});

test("복수 대상 만족도 fallback은 두 대상의 직접 비교를 포함하고 filler를 만들지 않는다", () => {
  const { canonical, titles } = titlesFor(
    "온빛 카페 새 메뉴와 기존 메뉴 이용자의 만족도 비교",
  );

  assert.equal(canonical.surveyIntent.targetCardinality, "multiple");
  assert.equal(titles.length, 7);
  assert.ok(
    titles.some(
      (title) =>
        /새 메뉴/.test(title) &&
        /기존 메뉴/.test(title) &&
        /만족도.*높|차이/.test(title),
    ),
  );
  assert.ok(titles.every((title) => !/중요하게 생각하는 요소/.test(title)));
});

test("인식과 개선 요구 fallback은 조사 대상을 보존하고 범용 filler를 만들지 않는다", () => {
  const { canonical, blueprint, titles } = titlesFor(
    "새빛대학교 환경공학과 학생들의 실험실 안전 인식과 개선 요구를 조사하고 싶다.",
  );

  assert.equal(canonical.surveyIntent.surveyObject, "실험실 안전");
  assert.equal(blueprint.evaluationTarget, "실험실 안전");
  assert.equal(titles.length, 7);
  assert.ok(titles.some((title) => /전반적으로.*인식/.test(title)));
  assert.ok(titles.some((title) => /개선할 필요/.test(title)));
  assert.ok(titles.some((title) => /가장 먼저 개선/.test(title)));
  assert.ok(
    titles.every(
      (title) =>
        !/관련해 평소 가장 자주 겪는 상황|관련한 행동은 주로 어떤 상황/.test(title),
    ),
  );
});
