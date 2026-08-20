export const surveyIntentAuthorityDatasetV12 = {
  version: "v1.2-intent-authority-audited",
  sourceVersion: "v1.1-audited",
  sourceFiles: {
    dev: "evals/survey-regression/v1.1/dev.json",
    holdout: "evals/survey-regression/v1.1/holdout.json",
  },
  sha256: {
    dev: "3425b2291212feb09dcbbabed51cd742850847ba96d0603e6b40d4fb97463504",
    holdout: "89b0b5e79fb4c3d8f55d8f352646c2089a2de4ed02bdde86ed552305e4d6577f",
  },
  counts: { dev: 80, holdout: 20, total: 100 },
  auditedRoles: [
    "inputQuality",
    "expectedOutcome",
    "targetPopulation",
    "eligibility",
    "contextEntities",
    "surveyObject",
    "purposes",
    "relationships",
    "clarificationExpected",
    "negation",
    "timeframe",
  ],
  expectationChanges: 0,
} as const;
