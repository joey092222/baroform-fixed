import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";

type ManualJudgment =
  | "true_pass"
  | "true_failure"
  | "evaluator_false_positive"
  | "evaluator_false_negative"
  | "ambiguous_specification";

type AuditedCase = {
  caseId: string;
  split: "dev" | "holdout";
  input: string;
  generationSource: string;
  classification: string;
  regradedFatalCodes: string[];
  manualJudgment: ManualJudgment;
};

type ClusterKey =
  | "canonical_role_preservation"
  | "model_output_rejection_fallback"
  | "request_execution_contract"
  | "clarification_policy"
  | "question_plan_quality";

type ClusterDefinition = {
  title: string;
  severity: number;
  generalizationCoefficient: number;
  firstFailureStage: string;
  relatedCode: string;
  hypothesis: string;
  traceEvidence: string[];
  generalRule: string;
  regressionRisk: string;
};

const root = process.cwd();
const auditPath = resolve(
  root,
  "reports/survey-regression-v1-evaluator-audit-cases.json",
);
const resultsPath = resolve(
  root,
  ".artifacts/survey-regression/v1/preview-100-v1/results.json",
);
const [auditRaw, resultsRaw] = await Promise.all([
  readFile(auditPath, "utf8"),
  readFile(resultsPath, "utf8"),
]);
const audited = JSON.parse(auditRaw) as AuditedCase[];
const results = JSON.parse(resultsRaw) as SurveyRegressionResult[];
const resultById = new Map(results.map((result) => [result.caseId, result]));

const definitions: Record<ClusterKey, ClusterDefinition> = {
  canonical_role_preservation: {
    title: "Canonical intent role preservation",
    severity: 5,
    generalizationCoefficient: 1,
    firstFailureStage: "canonical intent parsing and role extraction",
    relatedCode:
      "app/survey-canonical-intent.ts::parseCanonicalSurveyIntent -> app/survey-context-core.ts::parseSurveyGenerationContextCore / app/survey-semantic-intent-core.ts::parseSurveyIntentFromCanonicalSource",
    hypothesis:
      "응답 대상, 조사 대상, 활동, 부정 조건, 관계 목적을 분리하기 전에 자유 입력의 일부 또는 전체를 targetPopulation/evaluationTarget으로 재사용하여 이후 plan과 model prompt가 이미 왜곡된 의미를 전달함.",
    traceEvidence: [
      "dev-complex-001은 OpenAI 호출 전 canonical surveyObject가 중앙도서관이라는 단일 시설이 아니라 만족도·혼잡·예약 기능까지 합친 긴 목적어로 저장됨.",
      "dev-complex-009는 canonical evaluationTarget에 '에게 ... 묻고 싶어'라는 요청 문장 조각이 남고 mobility 입력이 attitude로 분류됨.",
      "dev-general-013은 canonical surveyObject가 실제 플랫폼 온새미가 아니라 기관인 새봄대학교로 축약됨.",
      "dev-past-004와 dev-past-009는 각각 비이용 조건 또는 전체 대학생 범위가 canonical targetPopulation 단계에서 유실·축소됨.",
    ],
    generalRule:
      "사용자 원문을 역할별 구조로 분리하고 canonical respondent, object, activity, purpose, negation을 단일 권한으로 유지하며 하위 parser와 plan은 이를 재해석하지 않고 파생만 함.",
    regressionRisk:
      "기존 service/facility usage 입력에서 정상적으로 좁혀진 이용자 조건까지 과도하게 넓힐 수 있으므로 이용자·비이용자·전체 집단 control이 필요함.",
  },
  model_output_rejection_fallback: {
    title: "Model-output rejection and hard fallback",
    severity: 5,
    generalizationCoefficient: 0.95,
    firstFailureStage: "model output parse, semantic/quality validation, and fallback selection",
    relatedCode:
      "app/survey-ai.ts::parseSurveyDraftResponse and app/api/survey-draft/route.ts::respondWithPlanBasedFallback / fallbackResponse / outputRejectionFallbackSource",
    hypothesis:
      "복구 가능한 모델 출력과 치명적 출력이 같은 거절 경로로 합쳐지고 validator 또는 required-block 복구가 실패하면 정상 질문까지 폐기한 뒤 범용 blueprint 설문으로 교체함.",
    traceEvidence: [
      "19개 hard fallback 중 17개가 fallbackReason=model-output-rejected 및 generationSource=openai_question_validation_fallback으로 수렴함.",
      "같은 경로가 음식, 관계, 디지털 서비스, 이동, 다중 대상 비교 등 서로 다른 도메인에서 반복됨.",
      "fallback 결과는 질문 수를 채우더라도 원래 목적 coverage와 역할 정보를 잃어 경로 기준과 의미 기준을 모두 실패함.",
    ],
    generalRule:
      "parse/semantic/quality issue를 복구 가능성과 치명도로 구분하고, 결정적 metadata만 정규화하며 정상 질문은 보존하고 hard fallback은 최후 수단으로 제한함.",
    regressionRisk:
      "validator 완화가 실제 의미 오류를 통과시킬 수 있으므로 복구 가능한 metadata와 질문·선택지의 치명적 오류 경계를 회귀 테스트로 고정해야 함.",
  },
  request_execution_contract: {
    title: "Request execution and response contract failure",
    severity: 5,
    generalizationCoefficient: 0.9,
    firstFailureStage: "route-level parse/repair/fallback response validation",
    relatedCode:
      "app/api/survey-draft/route.ts::fallbackResponse and POST /api/survey-draft error/contract branches",
    hypothesis:
      "Responses API가 completed이고 output_parsed가 존재하는 경우에도 parse·repair·fallback 검증 뒤 422로 종료되며, fallback 자체가 schema/semantic 검사를 통과하지 못하면 구조화된 survey 대신 request failure를 반환함.",
    traceEvidence: [
      "15개 request failure 중 13개가 HTTP 422이고 2개가 HTTP 500임.",
      "대부분의 422 사례에서 upstream response.status=completed이며 output_parsed도 존재해 네트워크나 모델 timeout보다 서버 후처리 계약이 최초 실패 지점임.",
      "route의 fallbackResponse는 대체 설문 validation issue가 남으면 REPAIR_EXHAUSTED 422를 반환하므로 fallback이 실패를 흡수하지 못하고 요청 전체 실패로 승격됨.",
    ],
    generalRule:
      "OpenAI 결과, repair, fallback, 최종 response contract를 같은 SurveyPlan과 검증 계약으로 연결하고 각 실패 stage를 보존하며, 정상 입력은 유효한 survey 또는 명시적 clarification으로만 종료함.",
    regressionRisk:
      "422를 단순 200으로 바꾸면 불완전 설문을 노출할 수 있으므로 최종 schema·semantic·question-count gate는 유지해야 함.",
  },
  clarification_policy: {
    title: "Clarification policy mismatch",
    severity: 4,
    generalizationCoefficient: 0.8,
    firstFailureStage: "ambiguity detection before generation",
    relatedCode:
      "canonical intent completeness checks and POST /api/survey-draft clarification branch",
    hypothesis:
      "대상 또는 목적이 실제로 모호한 입력과 짧지만 충분히 명확한 입력을 같은 완성도 규칙으로 처리하여 불필요한 설문 생성 또는 불필요한 clarification을 만듦.",
    traceEvidence: [
      "dev-clarify-001, dev-clarify-003, holdout-clarify-001처럼 필수 역할이 없는 입력에도 임의 설문이 생성됨.",
      "dev-clarify-006처럼 생성 가능한 입력에는 반대로 clarification이 반환됨.",
      "clarification 기대·비기대 사례가 모두 실패해 단일 문장 표현보다 completeness policy 결함을 가리킴.",
    ],
    generalRule:
      "canonical role completeness와 후보 신뢰도를 기준으로 clarification을 결정하고, 질문은 실제로 빠진 역할 하나를 해소하도록 만듦.",
    regressionRisk:
      "threshold 조정으로 명확한 입력을 막거나 모호한 입력을 억지 생성할 수 있으므로 양방향 control이 필요함.",
  },
  question_plan_quality: {
    title: "Question-plan coverage and quality",
    severity: 4,
    generalizationCoefficient: 0.8,
    firstFailureStage: "SurveyPlan block coverage and final question quality validation",
    relatedCode:
      "app/survey-planning.ts::createSurveyPlan and app/survey-intent.ts::validateSurvey",
    hypothesis:
      "canonical 역할이 비교적 보존되고 요청이 성공해도 복수 목적의 required block, 직접 만족도, 문항 수, screener 위치와 중복 construct가 최종 질문에 일관되게 연결되지 않음.",
    traceEvidence: [
      "dev-general-017과 dev-past-012 등은 필요한 결과 구조 또는 직접 측정 block이 빠져 request/quality issue로 이어짐.",
      "dev-general-028은 이용 여부 screener가 경험 문항 뒤에 배치되고 dev-past-017은 불편 construct가 중복되는 반면 전반 만족도는 누락됨.",
      "서로 다른 목적·문항 유형에서 required concept와 실제 질문 역할 연결이 끊김.",
    ],
    generalRule:
      "SurveyPlan block ID를 최종 질문 역할과 연결하고 문항 수·순서·직접 측정·중복 방지를 동일한 plan-aware validator로 검증함.",
    regressionRisk:
      "필수 block을 기계적으로 추가하면 문항 수 초과나 중복이 생길 수 있으므로 교체 우선순위와 requestedQuestionCount를 단일 source로 유지해야 함.",
  },
};

const canonicalCodes = new Set([
  "TARGET_POPULATION_MISMATCH",
  "SURVEY_OBJECT_MISMATCH",
  "NAMED_TERM_LOST",
  "NEGATION_LOST",
  "MALFORMED_SEMANTIC_PHRASE",
  "FORBIDDEN_CONCEPT_PRESENT",
]);

const assignCluster = (item: AuditedCase): ClusterKey => {
  if (item.classification === "request_failure") {
    return "request_execution_contract";
  }
  if (item.classification === "hard_fallback") {
    return "model_output_rejection_fallback";
  }
  const result = resultById.get(item.caseId);
  if (!result) throw new Error(`CLUSTER_RESULT_MISSING:${item.caseId}`);
  if (
    result.expected.clarificationExpected ||
    item.classification === "clarification"
  ) {
    return "clarification_policy";
  }
  if (item.regradedFatalCodes.some((code) => canonicalCodes.has(code))) {
    return "canonical_role_preservation";
  }
  return "question_plan_quality";
};

const failures = audited.filter(
  (item) =>
    item.manualJudgment === "true_failure" ||
    item.manualJudgment === "evaluator_false_negative",
);
if (failures.length !== 92) {
  throw new Error(`CLUSTER_TRUE_FAILURE_COUNT:${failures.length}`);
}

const assignments = failures.map((item) => {
  const result = resultById.get(item.caseId);
  if (!result) throw new Error(`CLUSTER_RESULT_MISSING:${item.caseId}`);
  return {
    caseId: item.caseId,
    split: item.split,
    category: result.expected.category,
    input: item.input,
    cluster: assignCluster(item),
    classification: item.classification,
    generationSource: item.generationSource,
    fallbackReason: result.fallbackReason,
    fatalCodes: item.regradedFatalCodes,
  };
});

const summaries = (Object.keys(definitions) as ClusterKey[])
  .map((key) => {
    const members = assignments.filter((item) => item.cluster === key);
    const definition = definitions[key];
    return {
      key,
      ...definition,
      caseCount: members.length,
      devCount: members.filter((item) => item.split === "dev").length,
      seenHoldoutCount: members.filter((item) => item.split === "holdout").length,
      domainCount: new Set(members.map((item) => item.category)).size,
      domains: [...new Set(members.map((item) => item.category))].sort(),
      representativeCaseIds: members.slice(0, 5).map((item) => item.caseId),
      generationPaths: Object.fromEntries(
        [...members.reduce((map, item) => {
          map.set(item.classification, (map.get(item.classification) ?? 0) + 1);
          return map;
        }, new Map<string, number>())].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      expectedResolvedCount: members.length,
      priorityScore:
        members.length * definition.severity * definition.generalizationCoefficient,
    };
  })
  .sort((left, right) => right.priorityScore - left.priorityScore);

const topThreeCount = summaries
  .slice(0, 3)
  .reduce((total, cluster) => total + cluster.caseCount, 0);
const topThreeCoverage = topThreeCount / failures.length;
if (topThreeCoverage < 0.6) {
  throw new Error(`CLUSTER_TOP_THREE_COVERAGE:${topThreeCoverage}`);
}
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const escapeCell = (value: string) => value.replaceAll("|", "\\|");
const summaryRows = summaries
  .map(
    (cluster, index) =>
      `| ${index + 1} | ${cluster.title} | ${cluster.caseCount} | ${cluster.devCount} | ${cluster.seenHoldoutCount} | ${cluster.domainCount} | ${cluster.severity} | ${cluster.generalizationCoefficient.toFixed(2)} | ${cluster.priorityScore.toFixed(2)} |`,
  )
  .join("\n");
const clusterSections = summaries
  .map(
    (cluster) => `## ${cluster.title}

- Cases: ${cluster.caseCount} (Dev ${cluster.devCount}, regression-v1-seen-holdout ${cluster.seenHoldoutCount})
- Representative cases: ${cluster.representativeCaseIds.map((id) => `\`${id}\``).join(", ")}
- Distinct domains: ${cluster.domainCount} (${cluster.domains.join(", ")})
- First failure stage: ${cluster.firstFailureStage}
- Related files/functions: ${cluster.relatedCode}
- Final generation paths: \`${JSON.stringify(cluster.generationPaths)}\`
- Severity: ${cluster.severity}/5
- Generalization coefficient: ${cluster.generalizationCoefficient.toFixed(2)}
- Priority score: ${cluster.priorityScore.toFixed(2)}
- Expected resolved cases: ${cluster.expectedResolvedCount}

### Causal hypothesis

${cluster.hypothesis}

### Common trace evidence

${cluster.traceEvidence.map((evidence) => `- ${evidence}`).join("\n")}

### General fix principle

${cluster.generalRule}

### Regression risk

${cluster.regressionRisk}`,
  )
  .join("\n\n");
const assignmentRows = assignments
  .sort((left, right) => left.caseId.localeCompare(right.caseId))
  .map(
    (item) =>
      `| ${item.caseId} | ${item.split === "holdout" ? "regression-v1-seen-holdout" : "dev"} | ${item.category} | ${definitions[item.cluster].title} | ${item.classification} | ${escapeCell(item.fatalCodes.join(", "))} |`,
  )
  .join("\n");
const report = `# Survey Regression v1 Failure Clusters

## Method

- Frozen run: \`preview-100-v1\`
- Application baseline: \`b2c52ca82af1c5c16fae3fb72af20bf34436f8c7\`
- Manually confirmed failures: ${failures.length}
- Ambiguous specifications excluded: 3
- OpenAI calls during clustering: 0
- Assignment rule: each actual failure receives exactly one earliest/root cluster; later symptoms remain evaluator codes, not extra root counts.
- Existing holdout status: \`regression-v1-seen-holdout\` because its outputs have already been inspected.

## Priority summary

Priority score = case count × severity × generalization coefficient.

| Rank | Root cluster | Cases | Dev | Seen holdout | Domains | Severity | Generalization | Score |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaryRows}

The top three clusters explain ${topThreeCount}/${failures.length} actual failures (${percent(topThreeCoverage)}), exceeding the required 60% threshold. These are the only production-code candidates to address first; later clusters remain gated behind replay and control tests.

${clusterSections}

## First-root assignment

| Case | Split | Domain | First/root cluster | Final path | Regraded fatal codes |
| --- | --- | --- | --- | --- | --- |
${assignmentRows}
`;

await Promise.all([
  writeFile(
    resolve(root, "reports/survey-regression-v1-failure-clusters.json"),
    `${JSON.stringify(
      {
        baselineSha: "b2c52ca82af1c5c16fae3fb72af20bf34436f8c7",
        actualFailureCount: failures.length,
        ambiguousSpecificationCount: 3,
        topThreeCount,
        topThreeCoverage,
        clusters: summaries,
        assignments,
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/survey-regression-v1-failure-clusters.md"),
    report,
    "utf8",
  ),
]);

console.log(
  JSON.stringify(
    {
      actualFailures: failures.length,
      topThreeCount,
      topThreeCoverage: percent(topThreeCoverage),
      clusters: summaries.map((cluster) => ({
        key: cluster.key,
        cases: cluster.caseCount,
        dev: cluster.devCount,
        seenHoldout: cluster.seenHoldoutCount,
        domains: cluster.domainCount,
        priorityScore: cluster.priorityScore,
      })),
    },
    null,
    2,
  ),
);
