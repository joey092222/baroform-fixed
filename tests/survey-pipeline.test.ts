import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSurveyPrompt,
  generateSurvey,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";

const awarenessUsageCases = [
  {
    input: "교내 네이버 웨일 브라우저 인식 및 사용 행태 조사",
    subject: "네이버 웨일 브라우저",
    context: "교내",
  },
  {
    input: "네이버 웨일 브라우저 인지도와 이용 행태 조사",
    subject: "네이버 웨일 브라우저",
    context: null,
  },
  {
    input: "대학생들의 생성형 AI 인식 및 사용 행태 조사",
    subject: "생성형 AI",
    context: null,
  },
  {
    input: "대학생들의 SNS 인식과 사용 현황 조사",
    subject: "SNS",
    context: null,
  },
  {
    input: "교내 도서관 인식 및 이용 경험 조사",
    subject: "도서관",
    context: "교내",
  },
] as const;

for (const item of awarenessUsageCases) {
  test(`인식·이용 복합 조사에서 실제 대상을 분리함: ${item.input}`, () => {
    const brief = parseSurveyBrief(item.input);
    const survey = analyzeSurveyPrompt(item.input);
    const renderedQuestions = JSON.stringify(survey.aiQuestions);
    const frequency = survey.aiQuestions.find((question) =>
      /최근 1개월 동안.*얼마나 자주/.test(question.title),
    );

    assert.equal(brief.researchSubject, item.subject);
    assert.equal(brief.researchContext, item.context);
    assert.equal(survey.subject, item.subject);
    assert.equal(survey.aiQuestions.length, 7);
    assert.doesNotMatch(brief.researchSubject, /(?:과|와|및)$/);
    assert.doesNotMatch(renderedQuestions, /(?:과|와|및)(?:을|를|은|는|이|가|의)/);
    assert.doesNotMatch(renderedQuestions, /상황이나 기능/);
    assert.match(renderedQuestions, /이전부터 알고 있었나요/);
    assert.match(renderedQuestions, /주로 어떤 목적으로 이용하나요/);
    assert.ok(frequency?.options);
    assert.deepEqual(frequency.options, [
      "이용하지 않음",
      "월 1회",
      "월 2~3회",
      "월 4~7회",
      "월 8회 이상",
    ]);
    assert.deepEqual(validateSurvey(item.input, brief, survey), []);
  });
}

const cases = [
  {
    name: "네이버 웹툰 조사 의뢰문",
    input:
      "현재 국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험을 분석하고 싶어",
    subject: "네이버 웹툰",
    respondents: "대학생",
  },
  {
    name: "교내 학식당 조사 의뢰문",
    input:
      "연세대학교 학생들의 교내 학식당 이용 경험과 만족도를 조사하고 싶어",
    subject: "연세대학교 교내 학식당",
    respondents: "연세대학교 학생",
  },
  {
    name: "팀플 협업 조사 의뢰문",
    input: "대학생들이 팀플에서 겪는 갈등과 협업 경험을 분석하고 싶어",
    subject: "대학생의 팀플 협업 경험",
    respondents: "팀플 경험이 있는 대학생",
  },
  {
    name: "배달 앱 조사 의뢰문",
    input: "직장인의 배달 앱 이용 빈도와 불편 사항을 알아보고 싶어",
    subject: "배달 앱",
    respondents: "직장인",
  },
] as const;

for (const item of cases) {
  test(item.name, () => {
    const brief = parseSurveyBrief(item.input);
    const survey = generateSurvey(brief);

    assert.equal(brief.researchSubject, item.subject);
    assert.equal(brief.targetRespondents, item.respondents);
    assert.deepEqual(validateSurvey(item.input, brief, survey), []);

    const rendered = JSON.stringify(survey);
    assert.equal(rendered.includes(item.input), false);
    assert.doesNotMatch(rendered, /분석하고 싶어|조사하고 싶어|알아보고 싶어/);
    assert.doesNotMatch(rendered, /사용하거나 이용/);
  });
}

test("조사 목적은 한국어 조사를 맞추고 응답자 접두어를 중복하지 않는다", () => {
  const webtoonBrief = parseSurveyBrief(cases[0].input);
  const teamworkBrief = parseSurveyBrief(cases[2].input);

  assert.match(webtoonBrief.researchGoal, /서비스 만족도를 파악한다/);
  assert.doesNotMatch(webtoonBrief.researchGoal, /만족도을/);
  assert.match(
    teamworkBrief.researchGoal,
    /^팀플 경험이 있는 대학생의 팀플 협업 경험 관련/,
  );
  assert.doesNotMatch(teamworkBrief.researchGoal, /대학생의 대학생의/);
  assert.match(teamworkBrief.researchGoal, /소통 방식과 참여도를 파악한다/);
});

test("콘텐츠 설문에는 범용 업무용 선택지가 섞이지 않는다", () => {
  const brief = parseSurveyBrief(cases[0].input);
  const survey = generateSurvey(brief);
  const rendered = JSON.stringify(survey);

  assert.doesNotMatch(rendered, /정보 탐색|과제·업무|구매·신청|기록·관리/);
  assert.match(rendered, /최근 1개월/);
  assert.match(rendered, /콘텐츠|장르/);
});

test("검증기는 조사 의뢰문 복사와 기간 없는 빈도를 거부한다", () => {
  const input = cases[0].input;
  const brief = parseSurveyBrief(input);
  const survey = generateSurvey(brief);
  const invalid = {
    ...survey,
    aiQuestions: [
      {
        ...survey.aiQuestions[0],
        title: `‘${input}’를 얼마나 자주 이용하시나요?`,
      },
      ...survey.aiQuestions.slice(1),
    ],
  };

  const issues = validateSurvey(input, brief, invalid);
  assert.ok(issues.some((issue) => issue.includes("그대로 사용")));
  assert.ok(issues.some((issue) => issue.includes("기준 기간")));
});

test("검증기는 이중 질문과 겹치는 객관식 범위를 거부한다", () => {
  const input = cases[3].input;
  const brief = parseSurveyBrief(input);
  const survey = generateSurvey(brief);
  const invalid = {
    ...survey,
    aiQuestions: [
      {
        ...survey.aiQuestions[0],
        title: "배달 앱의 만족도와 불편 사항은 어느 정도인가요?",
        options: ["월 1~3회", "월 3~5회", "월 6회 이상"],
      },
      ...survey.aiQuestions.slice(1),
    ],
  };

  const issues = validateSurvey(input, brief, invalid);
  assert.ok(issues.some((issue) => issue.includes("두 개 이상의 개념")));
  assert.ok(issues.some((issue) => issue.includes("선택지 범위")));
});

test("검증기는 맞닿은 시간 구간을 겹침으로 오판하지 않는다", () => {
  const input = cases[0].input;
  const brief = parseSurveyBrief(input);
  const survey = generateSurvey(brief);
  const durationQuestion = survey.aiQuestions.find((item) =>
    /한 번.*이용|이용 시간|오래/.test(item.title),
  );
  assert.ok(durationQuestion);

  const candidate = {
    ...survey,
    aiQuestions: survey.aiQuestions.map((item) =>
      item.id === durationQuestion.id
        ? {
            ...item,
            options: [
              "10분 미만",
              "10분 이상~30분 미만",
              "30분 이상~1시간 미만",
              "1시간 이상~2시간 미만",
              "2시간 이상",
            ],
          }
        : item,
    ),
  };

  assert.equal(
    validateSurvey(input, brief, candidate).some((issue) => issue.includes("선택지 범위")),
    false,
  );
});

test("검증기는 지속 이용과 추천 의향을 합친 문항을 거부한다", () => {
  const input = cases[0].input;
  const brief = parseSurveyBrief(input);
  const survey = generateSurvey(brief);
  const invalid = {
    ...survey,
    aiQuestions: survey.aiQuestions.map((item, index) =>
      index === survey.aiQuestions.length - 1
        ? {
            ...item,
            title: "앞으로도 계속 이용하거나 주변에 추천할 의향이 있나요?",
          }
        : item,
    ),
  };

  const issues = validateSurvey(input, brief, invalid);
  assert.ok(issues.some((issue) => issue.includes("두 개 이상의 개념")));
});
