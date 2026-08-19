import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalObjectAliases,
  lintSurveyQuestionSemantics,
  predicateEntityMatchesCanonicalObject,
  resolveQuestionObjectReference,
  type ParsedSurveyContext,
  type SurveySemanticReferenceContext,
} from "../app/survey-context";

function satisfactionContext(primaryEntity: string): ParsedSurveyContext {
  return {
    rawUserInput: `${primaryEntity} 만족도 조사`,
    normalizedInput: `${primaryEntity} 만족도 조사`,
    audience: "이용자",
    primaryEntity,
    entityType: "construct",
    activity: null,
    researchGoal: `${primaryEntity} 만족도와 개선점 파악`,
    researchConstructs: ["전반적 만족도", "세부 평가", "불편", "개선 수요"],
    surveyArchetype: "satisfaction",
    isUsageObject: false,
  };
}

test("단일 canonical object의 문맥상 축약만 보수적으로 허용한다", () => {
  const context = satisfactionContext("다온 앱의 새 기능");
  const references: SurveySemanticReferenceContext = {
    canonicalObjects: ["다온 앱의 새 기능"],
    contextEntities: ["다온 앱"],
    purposeTargets: ["다온 앱의 새 기능"],
    targetCardinality: "single",
  };

  assert.deepEqual(canonicalObjectAliases(context, references), [
    "다온 앱의 새 기능",
    "새 기능",
    "기능",
  ]);
  assert.equal(
    resolveQuestionObjectReference(
      context,
      { title: "새 기능에 얼마나 만족하시나요?" },
      references,
    ),
    "contextual_alias",
  );
  assert.equal(
    predicateEntityMatchesCanonicalObject(
      context,
      {
        title: "해당 기능에 얼마나 만족하시나요?",
        measuredVariable: "새 기능 만족도",
      },
      references,
    ),
    true,
  );
  assert.equal(
    predicateEntityMatchesCanonicalObject(
      context,
      { title: "다온 앱 전반에 얼마나 만족하시나요?" },
      references,
    ),
    false,
  );
});

test("복수 object의 모호한 대명사는 canonical match로 승인하지 않는다", () => {
  const context = satisfactionContext("검색 기능 및 결제 기능");
  const references: SurveySemanticReferenceContext = {
    canonicalObjects: ["검색 기능", "결제 기능"],
    targetCardinality: "multiple",
  };
  assert.equal(
    predicateEntityMatchesCanonicalObject(
      context,
      { title: "해당 기능에 얼마나 만족하시나요?" },
      references,
    ),
    false,
  );
});

test("처음 보는 제품·프로그램의 고유 head 축약도 동일한 규칙으로 해석한다", () => {
  const fixtures = [
    ["해든 매장의 신제품", "신제품에 얼마나 만족하시나요?"],
    ["늘봄센터의 프로그램", "프로그램 만족도는 어느 정도인가요?"],
  ] as const;
  for (const [primaryEntity, title] of fixtures) {
    const context = satisfactionContext(primaryEntity);
    assert.equal(
      predicateEntityMatchesCanonicalObject(
        context,
        { title },
        { canonicalObjects: [primaryEntity], targetCardinality: "single" },
      ),
      true,
      primaryEntity,
    );
  }
});

test("부모 서비스의 이용 맥락은 허용하되 부모 서비스 만족도로 목적을 바꾸지 않는다", () => {
  const context = satisfactionContext("다온 앱의 새 기능");
  const references: SurveySemanticReferenceContext = {
    canonicalObjects: ["다온 앱의 새 기능"],
    contextEntities: ["다온 앱"],
    targetCardinality: "single",
  };
  const validQuestions = [
    {
      id: 1,
      title: "최근 3개월 동안 다온 앱을 사용한 적이 있나요?",
      measuredVariable: "다온 앱 사용 여부",
      questionPurpose: "응답 자격과 사용 맥락을 확인함.",
    },
    {
      id: 2,
      title: "최근 3개월 동안 다온 앱을 얼마나 자주 사용했나요?",
      measuredVariable: "다온 앱 사용 빈도",
      questionPurpose: "사용 맥락을 파악함.",
    },
    {
      id: 3,
      title: "새 기능을 사용하는 과정은 얼마나 편리했나요?",
      measuredVariable: "새 기능 이용 편의",
      questionPurpose: "새 기능 만족도 원인을 파악함.",
    },
  ];
  assert.deepEqual(
    lintSurveyQuestionSemantics(context, validQuestions, references),
    [],
  );

  const issues = lintSurveyQuestionSemantics(
    context,
    [{ id: 4, title: "다온 앱 전반에 얼마나 만족하시나요?" }],
    references,
  );
  assert.deepEqual(issues.map((item) => item.code), [
    "PREDICATE_ENTITY_MISMATCH",
  ]);
});

test("비이용 목적의 플랫폼 조사에서 모호한 서비스 만족도는 목적 일치로 승인하지 않는다", () => {
  const context: ParsedSurveyContext = {
    ...satisfactionContext("다온 플랫폼"),
    researchGoal: "다온 플랫폼 비이용 이유 파악",
    researchConstructs: ["비이용 이유", "이용 장벽"],
    surveyArchetype: "attitude",
  };
  assert.equal(
    predicateEntityMatchesCanonicalObject(
      context,
      { title: "이 서비스에 만족하시나요?" },
      {
        canonicalObjects: ["다온 플랫폼"],
        purposeTargets: ["비이용 이유"],
        targetCardinality: "single",
      },
    ),
    false,
  );
});
