import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySurveyEntryQuestionRole,
  parseSurveyIntent,
  validateSurveyIntentCandidate,
} from "../app/survey-semantic-intent";

function screeningCodes(input: string, title: string, options = ["예", "아니요"]) {
  const intent = parseSurveyIntent(input);
  const question = {
    id: "Q1",
    role: "screening",
    type: "single_choice",
    title,
    options,
  };
  return {
    intent,
    role: classifySurveyEntryQuestionRole(intent, question),
    codes: validateSurveyIntentCandidate(intent, { questions: [question] }).map(
      (item) => item.code,
    ),
  };
}

test("전체 population의 이용 여부는 탈락형 screening이 아닌 routing으로 본다", () => {
  const result = screeningCodes(
    "새봄대학교 학생의 별마루 카페 이용 경험과 불편",
    "별마루 카페를 이용한 적이 있나요?",
  );

  assert.equal(result.intent.targetPopulation, "새봄대학교 학생");
  assert.equal(result.intent.screeningRequired, false);
  assert.equal(result.role, "non_disqualifying_usage_routing");
  assert.equal(result.codes.includes("UNNECESSARY_SCREENING"), false);
});

test("명시적 이용자 eligibility와 비이용자 eligibility는 screening으로 유지한다", () => {
  const users = screeningCodes(
    "최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페 만족도 조사",
    "최근 한 달 동안 별마루 카페를 이용한 적이 있나요?",
  );
  const nonUsers = screeningCodes(
    "별마루 카페 비이용 학생의 비이용 이유 조사",
    "별마루 카페를 이용한 적이 있나요?",
  );

  assert.equal(users.role, "eligibility_screening");
  assert.equal(nonUsers.role, "eligibility_screening");
});

test("행사 참여자 만족도는 참여 eligibility screening을 유지한다", () => {
  const result = screeningCodes(
    "봄빛 축제 참여자의 행사 만족도 조사",
    "봄빛 축제에 참여한 적이 있나요?",
  );

  assert.equal(result.role, "eligibility_screening");
});

test("전체 학생의 시설 이미지와 이용 경험은 이용 여부 routing을 허용한다", () => {
  const result = screeningCodes(
    "전체 학생의 해든관 이용 경험과 시설 이미지 조사",
    "해든관을 이용한 적이 있나요?",
  );

  assert.equal(result.role, "non_disqualifying_usage_routing");
  assert.equal(result.codes.includes("UNNECESSARY_SCREENING"), false);
});

test("원문에 없는 학생 여부와 대상 없는 사용 여부는 불필요한 screening이다", () => {
  const demographic = screeningCodes(
    "새봄대학교 학생의 별마루 카페 이용 경험과 불편",
    "현재 학생인가요?",
  );
  const unrelated = screeningCodes(
    "새봄대학교 학생의 별마루 카페 이용 경험과 불편",
    "어떤 서비스를 이용한 적이 있나요?",
  );

  assert.equal(demographic.role, "unnecessary_screening");
  assert.equal(demographic.codes.includes("UNNECESSARY_SCREENING"), true);
  assert.equal(unrelated.role, "unnecessary_screening");
  assert.equal(unrelated.codes.includes("UNNECESSARY_SCREENING"), true);
});
