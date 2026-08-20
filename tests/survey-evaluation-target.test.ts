import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluationTargetsSemanticallyMatch,
  resolveCanonicalEvaluationTarget,
  selectResearchEntityMatchingEvaluationTarget,
  type SurveyResearchEntityCandidate,
} from "../app/survey-evaluation-target";

const entity = (
  inputName: string,
  resolvedName: string,
  resolvedAs: string,
  confidence: SurveyResearchEntityCandidate["confidence"] = "verified",
): SurveyResearchEntityCandidate => ({
  input_name: inputName,
  resolved_name: resolvedName,
  resolved_as: resolvedAs,
  affiliation_or_location: null,
  confidence,
});

test("기관이 첫 research entity여도 canonical 시설 대상을 선택한다", () => {
  const university = entity("새봄대학교", "새봄대학교", "대학교");
  const building = entity("솔빛관", "새봄대학교 솔빛관", "대학교 건물");
  for (const researchEntities of [
    [university, building],
    [building, university],
  ]) {
    const result = resolveCanonicalEvaluationTarget({
      canonicalEvaluationTarget: "솔빛관",
      canonicalSubject: "솔빛관",
      researchEntities,
      surveyPlanTarget: "솔빛관을 이용하는 새봄대학교 학생",
      fallbackEntityType: "building",
    });
    assert.equal(result.evaluationTarget, "솔빛관");
    assert.equal(result.matchedResearchEntity, building);
    assert.equal(result.entityType, "building");
    assert.equal(result.confidence, "high");
  }
});

test("canonical 대상 entity가 없어도 기관명으로 대체하지 않는다", () => {
  const result = resolveCanonicalEvaluationTarget({
    canonicalEvaluationTarget: "솔빛관",
    canonicalSubject: "솔빛관",
    researchEntities: [entity("새봄대학교", "새봄대학교", "대학교")],
    surveyPlanTarget: "솔빛관을 이용하는 새봄대학교 학생",
    fallbackEntityType: "building",
  });
  assert.equal(result.evaluationTarget, "솔빛관");
  assert.equal(result.recognizedEntity, "솔빛관");
  assert.equal(result.matchedResearchEntity, null);
  assert.equal(result.entityType, "building");
  assert.equal(result.confidence, "low");
});

test("상위 기업보다 canonical 서비스 entity를 선택한다", () => {
  const company = entity("네이버", "네이버", "기업");
  const service = entity("네이버 웹툰", "네이버웹툰", "웹툰 플랫폼");
  const result = resolveCanonicalEvaluationTarget({
    canonicalEvaluationTarget: "네이버 웹툰",
    researchEntities: [company, service],
    fallbackEntityType: "service",
  });
  assert.equal(result.evaluationTarget, "네이버 웹툰");
  assert.equal(result.matchedResearchEntity, service);
  assert.notEqual(result.matchedResearchEntity, company);
});

test("대학교보다 소속 건물 entity를 canonical 대상에 매칭한다", () => {
  const university = entity("연세대학교", "연세대학교", "대학교");
  const building = entity("대우관", "연세대학교 대우관", "대학교 건물");
  assert.equal(
    selectResearchEntityMatchingEvaluationTarget("대우관", [
      university,
      building,
    ]),
    building,
  );
});

test("소속 정보와 대상명을 합친 canonical 표기도 같은 entity로 매칭한다", () => {
  const building = {
    ...entity("대우관", "대우관", "대학교 건물"),
    affiliation_or_location: "연세대학교",
  };
  assert.equal(
    selectResearchEntityMatchingEvaluationTarget(
      "연세대학교 대우관",
      [building],
    ),
    building,
  );
});

test("경영대 시설과 경영대학 시설의 표기 차이를 허용한다", () => {
  assert.equal(
    evaluationTargetsSemanticallyMatch("경영대 시설", "경영대학 시설"),
    true,
  );
});

test("복수 구성개념의 및·과·와 표기를 같은 대상으로 인식한다", () => {
  assert.equal(
    evaluationTargetsSemanticallyMatch(
      "학업 몰입 및 심리적 안녕",
      "학업 몰입과 심리적 안녕",
    ),
    true,
  );
  assert.equal(
    evaluationTargetsSemanticallyMatch(
      "결과 분석 및 만족도",
      "결과 분석과 만족도",
    ),
    true,
  );
});

test("단일 대상의 복수 목적을 여러 조사 대상으로 분리하지 않는다", () => {
  const facility = entity(
    "경영대 시설",
    "연세대학교 경영대학 시설",
    "대학교 시설",
  );
  const result = resolveCanonicalEvaluationTarget({
    canonicalEvaluationTarget: "경영대 시설",
    researchEntities: [
      entity("연세대학교", "연세대학교", "대학교"),
      facility,
    ],
    surveyPlanTarget: "경영대 시설의 이미지와 이용 경험",
    fallbackEntityType: "building",
  });
  assert.equal(result.evaluationTarget, "경영대 시설");
  assert.equal(result.matchedResearchEntity, facility);
  assert.equal(result.entityType, "building");
});

test("실제 복수 대상은 단일 research entity로 축소하지 않는다", () => {
  const result = resolveCanonicalEvaluationTarget({
    canonicalEvaluationTarget: "서비스 A 및 서비스 B",
    researchEntities: [
      entity("서비스 A", "서비스 A", "서비스"),
      entity("서비스 B", "서비스 B", "서비스"),
    ],
    fallbackEntityType: "service",
  });
  assert.equal(result.evaluationTarget, "서비스 A 및 서비스 B");
  assert.equal(result.matchedResearchEntity, null);
});

test("기관의 verified 신뢰도를 미확인 canonical 시설에 전용하지 않는다", () => {
  const result = resolveCanonicalEvaluationTarget({
    canonicalEvaluationTarget: "솔빛관",
    researchEntities: [
      entity("새봄대학교", "새봄대학교", "대학교", "verified"),
    ],
    fallbackEntityType: "building",
  });
  assert.equal(result.evaluationTarget, "솔빛관");
  assert.equal(result.confidence, "low");
});

test("상위 기관·브랜드·응답자를 canonical 조사 대상으로 오인하지 않는다", () => {
  assert.equal(
    evaluationTargetsSemanticallyMatch("솔빛관", "새봄대학교"),
    false,
  );
  assert.equal(
    evaluationTargetsSemanticallyMatch("네이버 웹툰", "네이버"),
    false,
  );
  assert.equal(
    evaluationTargetsSemanticallyMatch("대우관", "연세대학교"),
    false,
  );
  assert.equal(
    evaluationTargetsSemanticallyMatch("네이버 웹툰", "대학생"),
    false,
  );
});
