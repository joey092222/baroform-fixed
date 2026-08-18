import assert from "node:assert/strict";
import test from "node:test";

import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";

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
