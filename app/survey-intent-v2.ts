import { z } from "zod";

import type {
  SemanticRole,
  SurveyIntentObjectKind,
  SurveyPurposeKind,
} from "./survey-semantic-intent-core";
import type {
  SurveyPlan,
  SurveyPlanBlock,
  SurveyVariableType,
} from "./survey-planning";
import type { SurveyMode } from "./survey-mode";
import type { CanonicalSurveyIntent } from "./survey-canonical-intent";

export const SURVEY_INTENT_AUTHORITY_VERSION = "canonical-intent-v2";
export const SURVEY_INTENT_PROMPT_VERSION = "survey-ai-v2";
export const SURVEY_INTENT_SCHEMA_VERSION = "survey-generation-v2";
export const SURVEY_INTENT_REPAIR_VERSION = "canonical-only-v1";

export function intentPipelineV2Enabled() {
  return process.env.BAROFORM_INTENT_PIPELINE_V2 === "true";
}

export const intentProvenanceSchema = z.enum([
  "user_explicit",
  "attachment_explicit",
  "model_inferred",
  "system_default",
]);

export const intentEvidenceRoleSchema = z.enum([
  "target_population",
  "eligibility",
  "context_entity",
  "survey_object",
  "activity",
  "purpose",
  "predictor",
  "outcome",
  "comparison_target",
  "timeframe",
  "negation",
]);

export const intentEvidenceSpanSchema = z.object({
  text: z.string().min(1).max(240),
  start: z.number().int().min(0).max(10_000),
  end: z.number().int().min(1).max(10_000),
  normalized_form: z.string().min(1).max(240),
  role: intentEvidenceRoleSchema,
  provenance: intentProvenanceSchema,
});

const confidenceSchema = z.number().min(0).max(1);

const intentEntityTypeSchema = z.enum([
  "person_group",
  "academic_organization",
  "organization",
  "university_building",
  "place_facility",
  "service",
  "platform",
  "product",
  "program_event",
  "behavior",
  "mobility",
  "ability_skill",
  "attitude_perception",
  "satisfaction_evaluation",
  "need_demand",
  "category_set",
  "consumption_behavior",
  "multidimensional_construct",
  "relationship_analysis",
  "other",
]);

const targetPopulationSchema = z.object({
  display_text: z.string().min(1).max(180),
  head: z.string().min(1).max(100),
  qualifiers: z.array(z.string().min(1).max(100)).max(12),
  institution: z.string().max(140).nullable(),
  grade: z.string().max(80).nullable(),
  inclusion_conditions: z.array(z.string().min(1).max(160)).max(12),
  exclusion_conditions: z.array(z.string().min(1).max(160)).max(12),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(12),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const eligibilityConditionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(180),
  polarity: z.enum(["include", "exclude"]),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const contextEntitySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  entity_type: intentEntityTypeSchema,
  role: z.string().min(1).max(100),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const surveyObjectSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(180),
  entity_type: intentEntityTypeSchema,
  is_usage_object: z.boolean(),
  candidate_names: z.array(z.string().min(1).max(180)).max(8),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const activitySchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(180),
  activity_type: z.enum([
    "use",
    "purchase",
    "participate",
    "visit",
    "move",
    "learn",
    "consume",
    "evaluate",
    "other",
  ]),
  object_ids: z.array(z.string().min(1).max(80)).max(12),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const purposeSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(240),
  purpose_type: z.enum([
    "usage_experience",
    "satisfaction",
    "need_demand",
    "behavior_usage",
    "attitude_perception",
    "ability_skill",
    "decision_support",
    "relationship_analysis",
  ]),
  object_ids: z.array(z.string().min(1).max(80)).max(12),
  construct_names: z.array(z.string().min(1).max(140)).min(1).max(12),
  required: z.boolean(),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const relationshipTermSchema = z.object({
  name: z.string().min(1).max(160),
  object_ids: z.array(z.string().min(1).max(80)).max(12),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const relationshipSchema = z.object({
  id: z.string().min(1).max(80),
  relation_type: z.enum([
    "association",
    "group_comparison",
    "effect_hypothesis",
    "descriptive_breakdown",
  ]),
  predictor: relationshipTermSchema,
  outcome: relationshipTermSchema,
  comparison_targets: z.array(relationshipTermSchema).max(12),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const timeframeSchema = z.object({
  value: z.string().min(1).max(120),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(4),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
}).nullable();

const negationConstraintSchema = z.object({
  text: z.string().min(1).max(160),
  applies_to: z.enum([
    "target_population",
    "eligibility",
    "survey_object",
    "activity",
    "purpose",
  ]),
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(8),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

const clarificationSchema = z.object({
  required: z.boolean(),
  missing_roles: z.array(z.enum([
    "target_population",
    "survey_object",
    "research_purpose",
    "comparison_targets",
    "eligibility",
  ])).max(8),
  ambiguity_reasons: z.array(z.string().min(1).max(200)).max(8),
  question: z.string().max(240).nullable(),
});

export const canonicalSurveyIntentV2Schema = z.object({
  version: z.literal("2"),
  raw_user_input: z.string().min(1).max(2_000),
  normalized_user_input: z.string().min(1).max(2_000),
  target_population: targetPopulationSchema,
  eligibility_conditions: z.array(eligibilityConditionSchema).max(16),
  context_entities: z.array(contextEntitySchema).max(20),
  survey_objects: z.array(surveyObjectSchema).min(1).max(20),
  activities: z.array(activitySchema).max(20),
  target_cardinality: z.enum(["single", "multiple"]),
  purposes: z.array(purposeSchema).min(1).max(12),
  relationships: z.array(relationshipSchema).max(12),
  explicit_timeframe: timeframeSchema,
  negation_constraints: z.array(negationConstraintSchema).max(16),
  survey_mode: z.enum(["standard", "research"]),
  requested_question_count: z.number().int().min(1).max(30),
  clarification: clarificationSchema,
  evidence: z.array(intentEvidenceSpanSchema).min(1).max(40),
  confidence: confidenceSchema,
  provenance: intentProvenanceSchema,
});

export type CanonicalSurveyIntentV2 = z.infer<
  typeof canonicalSurveyIntentV2Schema
>;

export type LegacyIntentShadowSummary = {
  targetPopulation: string | null;
  surveyObjects: string[];
  purposes: string[];
  eligibilityCondition: string | null;
  clarificationRequired: boolean;
  influencedOutput: false;
};

export type LegacyIntentV2Divergence = {
  targetPopulation: boolean;
  surveyObjects: boolean;
  purposes: boolean;
  eligibility: boolean;
  clarification: boolean;
};

export function summarizeLegacyCanonicalIntent(
  intent: CanonicalSurveyIntent,
): LegacyIntentShadowSummary {
  return {
    targetPopulation: intent.surveyIntent.targetPopulation,
    surveyObjects: intent.surveyIntent.evaluationTargets,
    purposes: intent.surveyIntent.purposeBlocks.map((item) => item.text),
    eligibilityCondition: intent.surveyIntent.eligibilityCondition,
    clarificationRequired: intent.surveyIntent.requiresCreatorClarification,
    influencedOutput: false,
  };
}

function comparableSet(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((item): item is string => Boolean(item)).map(compact))]
    .filter(Boolean)
    .sort();
}

export function compareLegacyShadowToCanonicalIntentV2(
  legacy: LegacyIntentShadowSummary,
  intent: CanonicalSurveyIntentV2,
): LegacyIntentV2Divergence {
  const v2Eligibility = [
    ...intent.eligibility_conditions.map((item) => item.text),
    ...intent.target_population.inclusion_conditions,
    ...intent.target_population.exclusion_conditions,
  ];
  return {
    targetPopulation:
      compact(legacy.targetPopulation ?? "") !==
      compact(intent.target_population.display_text),
    surveyObjects:
      JSON.stringify(comparableSet(legacy.surveyObjects)) !==
      JSON.stringify(comparableSet(intent.survey_objects.map((item) => item.name))),
    purposes:
      JSON.stringify(comparableSet(legacy.purposes)) !==
      JSON.stringify(comparableSet(intent.purposes.map((item) => item.text))),
    eligibility:
      JSON.stringify(comparableSet([legacy.eligibilityCondition])) !==
      JSON.stringify(comparableSet(v2Eligibility)),
    clarification:
      legacy.clarificationRequired !== intent.clarification.required,
  };
}

export type CanonicalIntentConsistencyIssue = {
  code:
    | "RAW_INPUT_MISMATCH"
    | "NORMALIZED_INPUT_MISMATCH"
    | "EVIDENCE_SPAN_INVALID"
    | "EVIDENCE_TEXT_MISMATCH"
    | "EXPLICIT_NEGATION_NOT_PRESERVED"
    | "EXPLICIT_TIMEFRAME_NOT_PRESERVED"
    | "TARGET_OBJECT_ROLE_COLLISION"
    | "UNKNOWN_ENTITY_REFERENCE"
    | "PURPOSE_NOT_GROUNDED"
    | "RELATION_NOT_GROUNDED"
    | "REQUEST_CONSTRAINT_MISMATCH";
  path: string;
  message: string;
};

const normalizeMechanically = (value: string) =>
  value.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n+/g, " ").trim();

const compact = (value: string) =>
  normalizeMechanically(value).replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

function collectEvidence(intent: CanonicalSurveyIntentV2) {
  return [
    ...intent.evidence,
    ...intent.target_population.evidence,
    ...intent.eligibility_conditions.flatMap((item) => item.evidence),
    ...intent.context_entities.flatMap((item) => item.evidence),
    ...intent.survey_objects.flatMap((item) => item.evidence),
    ...intent.activities.flatMap((item) => item.evidence),
    ...intent.purposes.flatMap((item) => item.evidence),
    ...intent.relationships.flatMap((item) => [
      ...item.evidence,
      ...item.predictor.evidence,
      ...item.outcome.evidence,
      ...item.comparison_targets.flatMap((target) => target.evidence),
    ]),
    ...(intent.explicit_timeframe?.evidence ?? []),
    ...intent.negation_constraints.flatMap((item) => item.evidence),
  ];
}

const explicitNegationCues = [
  "비이용",
  "미이용",
  "비참여",
  "미참여",
  "미구매",
  "구매하지 않은",
  "이용하지 않은",
  "사용하지 않은",
  "참여하지 않은",
  "경험이 없는",
  "하지 않는",
];

export function validateCanonicalSurveyIntentV2(
  intent: CanonicalSurveyIntentV2,
  request: {
    rawUserInput: string;
    surveyMode: SurveyMode;
    requestedQuestionCount: number;
  },
) {
  const issues: CanonicalIntentConsistencyIssue[] = [];
  const raw = request.rawUserInput;
  if (intent.raw_user_input !== raw) {
    issues.push({
      code: "RAW_INPUT_MISMATCH",
      path: "raw_user_input",
      message: "모델이 사용자 원문을 변경했습니다.",
    });
  }
  if (intent.normalized_user_input !== normalizeMechanically(raw)) {
    issues.push({
      code: "NORMALIZED_INPUT_MISMATCH",
      path: "normalized_user_input",
      message: "기계적 정규화 결과가 사용자 원문과 일치하지 않습니다.",
    });
  }
  if (
    intent.survey_mode !== request.surveyMode ||
    intent.requested_question_count !== request.requestedQuestionCount
  ) {
    issues.push({
      code: "REQUEST_CONSTRAINT_MISMATCH",
      path: "survey_mode",
      message: "UI에서 정한 설문 방식 또는 문항 수가 변경되었습니다.",
    });
  }
  for (const [index, evidence] of collectEvidence(intent).entries()) {
    if (
      evidence.start < 0 ||
      evidence.end <= evidence.start ||
      evidence.end > raw.length
    ) {
      issues.push({
        code: "EVIDENCE_SPAN_INVALID",
        path: `evidence.${index}`,
        message: "근거 범위가 사용자 원문을 벗어났습니다.",
      });
      continue;
    }
    if (raw.slice(evidence.start, evidence.end) !== evidence.text) {
      issues.push({
        code: "EVIDENCE_TEXT_MISMATCH",
        path: `evidence.${index}`,
        message: "근거 텍스트가 지정된 원문 범위와 일치하지 않습니다.",
      });
    }
  }

  const rawNegations = explicitNegationCues.filter((cue) => raw.includes(cue));
  const preservedNegations = compact(
    [
      ...intent.negation_constraints.map((item) => item.text),
      ...intent.target_population.exclusion_conditions,
      ...intent.eligibility_conditions
        .filter((item) => item.polarity === "exclude")
        .map((item) => item.text),
    ].join(" "),
  );
  for (const cue of rawNegations) {
    if (!preservedNegations.includes(compact(cue))) {
      issues.push({
        code: "EXPLICIT_NEGATION_NOT_PRESERVED",
        path: "negation_constraints",
        message: `명시적 부정 조건 '${cue}'이 보존되지 않았습니다.`,
      });
    }
  }
  if (
    intent.explicit_timeframe &&
    !raw.includes(intent.explicit_timeframe.value)
  ) {
    issues.push({
      code: "EXPLICIT_TIMEFRAME_NOT_PRESERVED",
      path: "explicit_timeframe",
      message: "기준 기간이 사용자 원문 근거와 연결되지 않습니다.",
    });
  }

  const target = compact(intent.target_population.display_text);
  for (const [index, object] of intent.survey_objects.entries()) {
    if (
      target === compact(object.name) &&
      object.entity_type === "person_group"
    ) {
      issues.push({
        code: "TARGET_OBJECT_ROLE_COLLISION",
        path: `survey_objects.${index}`,
        message: "응답 대상이 조사 대상으로 다시 사용되었습니다.",
      });
    }
  }
  const objectIds = new Set(intent.survey_objects.map((item) => item.id));
  for (const [index, item] of intent.activities.entries()) {
    for (const objectId of item.object_ids) {
      if (!objectIds.has(objectId)) {
        issues.push({
          code: "UNKNOWN_ENTITY_REFERENCE",
          path: `activities.${index}.object_ids`,
          message: "활동이 존재하지 않는 조사 대상을 참조합니다.",
        });
      }
    }
  }
  for (const [index, purpose] of intent.purposes.entries()) {
    if (purpose.evidence.length === 0) {
      issues.push({
        code: "PURPOSE_NOT_GROUNDED",
        path: `purposes.${index}`,
        message: "조사 목적이 사용자 원문 근거와 연결되지 않았습니다.",
      });
    }
    for (const objectId of purpose.object_ids) {
      if (!objectIds.has(objectId)) {
        issues.push({
          code: "UNKNOWN_ENTITY_REFERENCE",
          path: `purposes.${index}.object_ids`,
          message: "조사 목적이 존재하지 않는 조사 대상을 참조합니다.",
        });
      }
    }
  }
  for (const [index, relation] of intent.relationships.entries()) {
    if (relation.predictor.evidence.length === 0 || relation.outcome.evidence.length === 0) {
      issues.push({
        code: "RELATION_NOT_GROUNDED",
        path: `relationships.${index}`,
        message: "관계 변수의 역할이 사용자 원문 근거와 연결되지 않았습니다.",
      });
    }
  }
  return issues;
}

export type CanonicalSurveyBriefV2 = {
  targetPopulation: string;
  eligibilityConditions: string[];
  contextEntities: string[];
  surveyObjects: string[];
  purposes: string[];
  primaryPurpose: string;
  explicitTimeframe: string | null;
  surveyMode: SurveyMode;
  requestedQuestionCount: number;
  clarification: CanonicalSurveyIntentV2["clarification"];
};

export function deriveSurveyBriefFromCanonicalIntentV2(
  intent: CanonicalSurveyIntentV2,
): CanonicalSurveyBriefV2 {
  return {
    targetPopulation: intent.target_population.display_text,
    eligibilityConditions: intent.eligibility_conditions.map((item) => item.text),
    contextEntities: intent.context_entities.map((item) => item.name),
    surveyObjects: intent.survey_objects.map((item) => item.name),
    purposes: intent.purposes.map((item) => item.text),
    primaryPurpose: intent.purposes[0]?.text ?? "사용자 요청을 측정 가능한 문항으로 조사",
    explicitTimeframe: intent.explicit_timeframe?.value ?? null,
    surveyMode: intent.survey_mode,
    requestedQuestionCount: intent.requested_question_count,
    clarification: intent.clarification,
  };
}

const purposeRole = (purpose: CanonicalSurveyIntentV2["purposes"][number]): SemanticRole => {
  switch (purpose.purpose_type) {
    case "usage_experience":
    case "behavior_usage":
      return "behavior";
    case "satisfaction":
      return "construct";
    case "need_demand":
      return "unmet_need";
    case "attitude_perception":
      return "attitude";
    case "ability_skill":
      return "ability";
    case "decision_support":
      return "decision_option";
    case "relationship_analysis":
      return "construct";
  }
};

const purposeVariableType = (
  purpose: CanonicalSurveyIntentV2["purposes"][number],
): SurveyVariableType => {
  switch (purpose.purpose_type) {
    case "usage_experience":
    case "behavior_usage":
      return "frequency";
    case "satisfaction":
    case "attitude_perception":
    case "ability_skill":
    case "need_demand":
      return "scale";
    case "decision_support":
      return "preference";
    case "relationship_analysis":
      return "numeric";
  }
};

function planBlock(
  id: string,
  variable: string,
  role: SemanticRole,
  variableType: SurveyVariableType,
  purpose: string,
  purposeBlockId: string,
  sourceEntityIds: string[],
): SurveyPlanBlock {
  return {
    id,
    kind: "measurement",
    variable,
    variableIds: sourceEntityIds,
    role,
    variableType,
    questionType:
      variableType === "scale"
        ? "scale"
        : variableType === "open_text"
          ? "long_text"
          : "single_choice",
    purpose,
    questionCount: 1,
    sourceEntityIds,
    decisionGoalIds: [],
    required: true,
    directlyAskable: true,
    purposeBlockId,
    measuredEntityIds: sourceEntityIds,
  };
}

export function deriveSurveyPlanFromCanonicalIntentV2(
  intent: CanonicalSurveyIntentV2,
): SurveyPlan {
  const objectById = new Map(intent.survey_objects.map((item) => [item.id, item]));
  const purposeBlocks = intent.purposes.map((purpose, index) => ({
    id: purpose.id,
    text: purpose.text,
    kind: purpose.purpose_type as SurveyPurposeKind,
    target: purpose.object_ids
      .map((id) => objectById.get(id)?.name)
      .filter((value): value is string => Boolean(value))
      .join(", "),
    order: index,
    relationToPrevious: index === 0 ? null : "independent" as const,
    targetEntityIds: purpose.object_ids,
    constructEntityIds: [],
  }));
  const blocks: SurveyPlanBlock[] = [];
  for (const purpose of intent.purposes) {
    const names = purpose.construct_names.length > 0
      ? purpose.construct_names
      : [purpose.text];
    for (const [index, name] of names.entries()) {
      blocks.push(planBlock(
        `${purpose.id}-measure-${index + 1}`,
        name,
        purposeRole(purpose),
        purposeVariableType(purpose),
        purpose.text,
        purpose.id,
        purpose.object_ids,
      ));
    }
  }
  for (const relation of intent.relationships) {
    blocks.push(
      planBlock(
        `${relation.id}-predictor`,
        relation.predictor.name,
        "construct",
        "numeric",
        `${relation.predictor.name}을 관계 분석의 예측 변수로 측정함.`,
        intent.purposes.find((item) => item.purpose_type === "relationship_analysis")?.id ?? intent.purposes[0].id,
        relation.predictor.object_ids,
      ),
      planBlock(
        `${relation.id}-outcome`,
        relation.outcome.name,
        "construct",
        "numeric",
        `${relation.outcome.name}을 관계 분석의 결과 변수로 측정함.`,
        intent.purposes.find((item) => item.purpose_type === "relationship_analysis")?.id ?? intent.purposes[0].id,
        relation.outcome.object_ids,
      ),
    );
  }
  const dedupedBlocks = [...new Map(blocks.map((item) => [`${item.variable}:${item.purposeBlockId}`, item])).values()]
    .slice(0, intent.requested_question_count);
  return {
    intentMode: intent.purposes.length > 1 ? "composite" : "single",
    intentKind: inferLegacyObjectKind(intent),
    targetPopulation: intent.target_population.display_text,
    evaluationTargets: intent.survey_objects.map((item) => item.name),
    targetCardinality: intent.target_cardinality,
    targetListSource: "explicit_in_prompt",
    unitOfAnalysis: intent.survey_objects.map((item) => item.name).join(", "),
    measurementMode:
      intent.relationships.length > 0
        ? "comparison"
        : intent.purposes.length > 1
          ? "composite"
          : intent.target_cardinality === "multiple"
            ? "matrix_evaluation"
            : "single_evaluation",
    screeningRequired: intent.eligibility_conditions.length > 0,
    screeningReason: intent.eligibility_conditions.map((item) => item.text).join("; ") || null,
    missingInformation: intent.clarification.missing_roles,
    primaryPurpose: intent.purposes[0]?.text ?? null,
    decisionGoals: intent.purposes.map((item) => item.text),
    purposeBlocks,
    purposeCoverage: purposeBlocks.map((purpose) => ({
      purposeBlockId: purpose.id,
      purposeKind: purpose.kind,
      plannedQuestionCount: dedupedBlocks.filter((block) => block.purposeBlockId === purpose.id).length,
    })),
    blocks: dedupedBlocks,
    requestedQuestionCount: intent.requested_question_count,
  };
}

export function inferLegacyObjectKind(
  intent: CanonicalSurveyIntentV2,
): SurveyIntentObjectKind {
  if (intent.purposes.length > 1) return "composite";
  if (intent.relationships.length > 0) return "relationship_analysis";
  const type = intent.survey_objects[0]?.entity_type;
  switch (type) {
    case "service":
    case "platform":
    case "product":
      return "service_product";
    case "university_building":
    case "place_facility":
      return "place_facility";
    case "behavior":
    case "mobility":
      return "behavior_usage";
    case "ability_skill":
      return "ability_skill";
    case "attitude_perception":
      return "attitude_perception";
    case "satisfaction_evaluation":
      return "satisfaction_evaluation";
    case "need_demand":
      return "need_demand";
    case "program_event":
      return "event_program";
    case "category_set":
      return "category_set";
    case "consumption_behavior":
      return "consumption_behavior";
    case "academic_organization":
      return "academic_organization";
    case "multidimensional_construct":
      return "multidimensional_construct";
    case "relationship_analysis":
      return "relationship_analysis";
    default:
      return "academic_construct";
  }
}

export function canonicalIntentV2PromptContract() {
  return [
    "사용자 원문을 의미 역할별로 한 번만 해석하고 canonical_intent_v2에 기록한다.",
    "응답 대상, 참여 조건, 맥락 실체, 조사 대상, 활동, 조사 목적을 서로 바꾸거나 합치지 않는다.",
    "명시적 부정 조건, 기관·학과·학년, 기간, 실제 복수 대상은 원문 evidence span과 함께 보존한다.",
    "각 evidence의 start/end는 user 메시지 원문의 UTF-16 문자열 인덱스이며 text는 해당 slice와 정확히 같아야 한다.",
    "survey_objects는 응답자 집단이 아니라 조사할 실체·행동·구성개념이다.",
    "서비스·플랫폼·제품·실제 시설만 is_usage_object=true로 둘 수 있다. 이동·경험·태도·만족도·수요는 이용 대상이 아니다.",
    "관계형 요청은 predictor와 outcome을 분리하고 두 변수를 각각 직접 측정하는 문항을 만든다.",
    "애매한 핵심 역할을 근거 없이 채우지 말고 clarification.required=true로 반환한다.",
    "survey와 survey_plan은 canonical_intent_v2만을 근거로 만들고 모든 required purpose를 포함한다.",
    "요소 N, 핵심 경험 N, 선행 값, 결과 값, 독립변수, 종속변수, 변수 A/B 같은 내부 placeholder를 쓰지 않는다.",
  ].join("\n");
}
