import { z } from "zod";
import { canonicalSurveyIntentV2Schema } from "@/app/survey-intent-v2";

export const supportedSurveyQuestionTypes = [
  "single_choice",
  "multiple_choice",
  "scale",
  "dropdown",
  "short_text",
  "long_text",
  "date",
  "time",
] as const;

export const supportedSurveyLogic =
  "현재 조건부 분기는 지원하지 않음. 모든 show_if는 빈 배열이어야 함.";

const nullableText = (maximum: number) => z.string().max(maximum).nullable();
const nullableNumber = z.number().nullable();

const researchSourceSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  // Structured Outputs does not support the JSON Schema `uri` format.
  // URL validity is enforced deterministically after parsing instead.
  url: z.string().min(1).max(600),
  source_type: z.enum(["official", "public", "academic", "news", "secondary"]),
  used_for: z.string().min(1).max(240),
});

const researchEntitySchema = z.object({
  input_name: z.string().min(1).max(120),
  resolved_name: nullableText(160),
  resolved_as: nullableText(80),
  affiliation_or_location: nullableText(180),
  confidence: z.enum(["verified", "probable", "unresolved"]),
  verified_facts: z.array(
    z.object({
      fact: z.string().min(1).max(240),
      source_ids: z.array(z.string().min(1).max(40)).max(8),
    }),
  ).max(8),
});

const questionRoleSchema = z.enum([
  "screening",
  "awareness",
  "behavior",
  "experience",
  "evaluation",
  "driver",
  "barrier",
  "priority",
  "outcome",
  "open",
  "demographic",
]);

const optionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(100),
  exclusive: z.boolean(),
  fixed_position: z.boolean(),
  allows_text: z.boolean(),
});

const conditionSchema = z.object({
  question_id: z.string().min(1).max(60),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains"]),
  value: z.string().min(1).max(120),
});

const questionSchema = z.object({
  id: z.string().min(1).max(60),
  section_id: z.string().min(1).max(60),
  role: questionRoleSchema,
  type: z.enum(supportedSurveyQuestionTypes),
  text: z.string().min(2).max(200),
  helper_text: nullableText(300),
  required: z.boolean(),
  reference_period: nullableText(120),
  options: z.array(optionSchema).max(12),
  scale: z.object({
    min: z.number().int().min(0).max(10),
    max: z.number().int().min(2).max(10),
    min_label: z.string().min(1).max(60),
    max_label: z.string().min(1).max(60),
  }).nullable(),
  randomize_options: z.boolean(),
  show_if: z.array(conditionSchema).max(0),
  validation: z.object({
    min_value: nullableNumber,
    max_value: nullableNumber,
    min_selections: nullableNumber,
    max_selections: nullableNumber,
    max_length: nullableNumber,
  }),
  analysis: z.object({
    construct: z.string().min(1).max(120),
    purpose: z.string().min(1).max(240),
    variable_name: z.string().min(1).max(80),
    coding_notes: nullableText(240),
  }),
  grounding: z.object({
    uses_external_fact: z.boolean(),
    source_ids: z.array(z.string().min(1).max(40)).max(8),
  }),
});

const qualityCheckSchema = z.object({
  all_named_entities_searched: z.boolean(),
  all_specific_claims_grounded: z.boolean(),
  all_questions_have_analysis_purpose: z.boolean(),
  double_barreled_questions_removed: z.boolean(),
  leading_questions_removed: z.boolean(),
  duplicate_questions_removed: z.boolean(),
  response_options_checked: z.boolean(),
  all_logic_paths_valid: z.boolean(),
  question_count_valid: z.boolean(),
  mobile_readability_checked: z.boolean(),
  respondent_path_simulation_passed: z.boolean(),
  warnings: z.array(z.string().min(1).max(240)).max(10),
});

export function createSurveyGenerationSchema(questionCount: number) {
  const count = Math.min(30, Math.max(1, Math.round(questionCount)));

  return z.object({
    status: z.enum(["ready", "ready_with_caution"]),
    research: z.object({
      search_status: z.enum(["verified", "partial", "failed"]),
      entities: z.array(researchEntitySchema).max(12),
      sources: z.array(researchSourceSchema).max(20),
      limitations: z.array(z.string().min(1).max(240)).max(10),
    }),
    survey_plan: z.object({
      survey_type: z.string().min(1).max(100),
      target: z.string().min(1).max(160),
      eligibility: z.string().min(1).max(240),
      primary_objective: z.string().min(1).max(240),
      sub_objectives: z.array(z.string().min(1).max(200)).max(4),
      constructs: z.array(
        z.object({
          name: z.string().min(1).max(120),
          reason: z.string().min(1).max(240),
        }),
      ).min(1).max(8),
      requested_question_count: z.number().int().min(1).max(30),
      count_rule: z.literal("max_path"),
      total_question_nodes: z.number().int().min(1).max(30),
      min_path_questions: z.number().int().min(1).max(30),
      max_path_questions: z.number().int().min(1).max(30),
      estimated_minutes: z.number().min(1).max(60),
    }),
    survey: z.object({
      title: z.string().min(2).max(100),
      intro: z.string().min(2).max(500),
      sections: z.array(
        z.object({
          id: z.string().min(1).max(60),
          title: z.string().min(1).max(120),
          description: nullableText(240),
        }),
      ).min(1).max(12),
      questions: z.array(questionSchema).length(count),
      completion_message: z.string().min(2).max(300),
    }),
    quality_check: qualityCheckSchema,
  });
}

export function createSurveyGenerationV2Schema(questionCount: number) {
  const count = Math.min(30, Math.max(1, Math.round(questionCount)));
  const base = createSurveyGenerationSchema(count);
  const v2QuestionSchema = questionSchema.extend({
    purpose_ids: z.array(z.string().min(1).max(80)).min(1).max(12),
    object_ids: z.array(z.string().min(1).max(80)).max(12),
    relationship_ids: z.array(z.string().min(1).max(80)).max(12),
  });
  return base.extend({
    canonical_intent_v2: canonicalSurveyIntentV2Schema,
    survey: base.shape.survey.extend({
      questions: z.array(v2QuestionSchema).length(count),
    }),
  });
}

export type SurveyGeneration = z.infer<ReturnType<typeof createSurveyGenerationSchema>>;
export type SurveyGenerationV2 = z.infer<
  ReturnType<typeof createSurveyGenerationV2Schema>
>;
