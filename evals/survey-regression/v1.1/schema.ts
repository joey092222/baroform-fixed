import { z } from "zod";

import {
  surveyRegressionCaseSchema,
  surveyRegressionInputQualitySchema,
  surveyRegressionSplitSchema,
} from "../v1/schema";

export const auditedSurveyRegressionCaseSchema = surveyRegressionCaseSchema.extend({
  inputQuality: surveyRegressionInputQualitySchema,
  contextEntities: z.array(z.string().min(1)),
  expectedEligibilityConditions: z.array(z.string().min(1)),
  screeningExpected: z.boolean(),
  forbiddenPurposeConcepts: z.array(z.string().min(1)),
});

export const auditedSurveyRegressionDatasetSchema = z.object({
  version: z.literal("v1.1-audited"),
  sourceVersion: z.literal("v1-original"),
  split: surveyRegressionSplitSchema,
  seed: z.string().min(8),
  generatedAt: z.string().datetime(),
  auditedAt: z.string().datetime(),
  cases: z.array(auditedSurveyRegressionCaseSchema),
});

export type AuditedSurveyRegressionCase = z.infer<
  typeof auditedSurveyRegressionCaseSchema
>;
export type AuditedSurveyRegressionDataset = z.infer<
  typeof auditedSurveyRegressionDatasetSchema
>;
