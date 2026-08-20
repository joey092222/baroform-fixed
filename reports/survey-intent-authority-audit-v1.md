# Survey intent authority audit v1

- Branch: `codex/unify-survey-intent-pipeline-v2`
- Baseline SHA: `40ce532ff39f19dd3589ee86982ae1a99e43ace3`
- Scope: production survey generation path ending at `POST /api/survey-draft`
- Method: static call-site and source audit. Test-only parser injection was classified separately.

## Finding

The current object named `CanonicalSurveyIntent` is the nominal aggregate, but it is not a single semantic authority. The same input is interpreted by context, semantic-intent, research-intent, canonical reconciliation, brief derivation, fallback blueprint selection, and response post-processing. Later stages can overwrite respondent, object, purpose, template, or question wording chosen earlier.

The baseline request does place the exact normalized user input in the OpenAI user role once. However, the developer message also contains six overlapping derived semantic payloads: compact `SurveyIntent`, a `CanonicalSurveyIntent` projection, `ParsedSurveyContext`, `SurveyPlan`, measurement policy, and a minimal `SurveyBrief` projection. They can disagree because they are produced or amended by different stages.

## Authority matrix

| Function / module | Reads raw or normalized input | Target population | Eligibility | Context entity | Survey object | Purpose | Type / archetype | Cardinality | Clarification | Reaches model prompt or final output | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `selectSurveyUserInput`, `normalizeUserInput` (`app/lib/ai/user-input.ts`) | yes | no | no | no | no | no | no | no | no | request input | mechanical |
| `parseSurveyGenerationContextCore` (`app/survey-context-core.ts:422`) | yes | yes | indirectly | yes | yes | yes | yes | no | no | copied into canonical and prompt | authoritative internal parser |
| `parseSurveyIntentFromCanonicalSource` (`app/survey-semantic-intent-core.ts:1224`) | yes | yes | yes | yes | yes | yes | yes | yes | yes | copied into canonical, plan, prompt, validator | authoritative internal parser |
| `parseSurveyResearchIntentCore` (`app/survey-research-intent-core.ts:441`) | yes | option-derived | no | no | relation variables | analysis goals | relation type | relationship | relation failure | copied into semantic intent and prompt | authoritative internal parser |
| `parseCanonicalSurveyIntent` (`app/survey-canonical-intent.ts:3072`) | yes | yes | yes | yes | yes | yes | yes | yes | yes | route source and prompt | nominal authority plus reconciliation authority |
| `parseSurveyGenerationContext`, `parseSurveyIntent`, `parseSurveyResearchIntent` wrappers | yes | projection | projection | projection | projection | projection | projection | projection | projection | public legacy API | canonical wrapper, except research test injection |
| `parseSurveySemantics` (`app/survey-intent.ts:977`) | yes | yes | yes | yes | yes | yes | yes | no | no | legacy fallback / direct-request helpers | legacy semantic authority |
| `parseSurveyBrief` (`app/survey-intent.ts:1446`) | yes | yes | yes | yes | yes | yes | yes | projection | projection | prompt and final metadata | downstream semantic authority |
| `analyzeSurveyPrompt` / `generateSurvey` (`app/survey-intent.ts:6409,6517`) | yes | from brief | from intent | yes | yes | via template | yes | via intent | no | fallback, repair source, UI defaults | fallback/template authority |
| `createSurveyPlan` (`app/survey-planning.ts:1110`) | no raw input | projection | projection | projection | projection | converts purpose to required blocks | projection | projection | projection | prompt, coverage validator, repair | downstream planning authority |
| `buildSurveyAiRequest` (`app/survey-ai.ts:3059`) | yes | serializes several versions | serializes | serializes | serializes | serializes | serializes | serializes | serializes | OpenAI request authority | prompt composition authority |
| `parseSurveyDraftResponse` (`app/survey-ai.ts:2271`) | yes | can replace model target | validates / repairs | validates | resolves target again | validates coverage | no | validates | no | final response | post-process authority |
| `validateSurveyIntentCandidate`, `validateSurvey`, plan coverage and repair helpers | indirectly through intent + prompt | validates | validates | validates | validates | validates | no | validates | no | can trigger repair or fallback | output gate / repair authority |

## Production call graph

```text
POST /api/survey-draft
  -> selectSurveyUserInput
  -> normalizeUserInput
  -> parseCanonicalSurveyIntent
       -> normalizeSurveyRequest
       -> parseSurveyGenerationContextCore
       -> parseSurveyIntentFromCanonicalSource
            -> parseSurveyGenerationContextCore (when no seed)
            -> parseSurveyResearchIntentCore
       -> canonical resolver/reconciliation chain
       -> sufficiency / clarification
  -> createSurveyPlan(canonical.surveyIntent)
  -> early clarification OR cache / model path
  -> analyzeSurveyPrompt + parseSurveyBrief (fallback is prepared)
  -> buildSurveyAiRequest
       -> parseSurveyBrief again
       -> createSurveyPlan again when not supplied
       -> developer message with six derived semantic payloads
       -> user message with exact input once
  -> OpenAI Responses API
  -> parseSurveyDraftResponse
       -> canonical fallback if caller omitted it
       -> analyzeSurveyPrompt
       -> parseSurveyBrief
       -> schema / semantic / quality / plan coverage validation
       -> metadata normalization, per-question repair, or local fallback
  -> final SurveyDraftResult
```

Background polling reconstructs canonical intent and plan again from stored prompt metadata at `app/api/survey-draft/route.ts:2458-2463`.

## Static metrics

- Production functions that directly read raw/normalized survey input and participate in semantic behavior: **9**.
- Functions/stages able to determine or overwrite target population: **5**.
- Functions/stages able to determine or overwrite survey object/evaluation target: **6**.
- Functions/stages able to determine or overwrite purpose/required coverage: **5**.
- Nominal authoritative compilers: **1**, but authoritative internal subparsers/reconcilers: **3+**.
- Distinct derived semantic payloads placed in the developer request: **6**.
- Exact normalized raw input occurrences in the current model request: **1** in user role, **0** in developer role after string removal.
- Minimum overwrite/reconciliation sites after the first semantic parse: **8** (comparison, relational clause, academic satisfaction, consumption, research relation, awareness+usage, facility usage, and context/object echo correction).

The three main semantic files alone contain 273 regex tests, 81 regex matches, and 120 replacements (`survey-canonical-intent.ts`, `survey-context-core.ts`, `survey-semantic-intent-core.ts`). This number is diagnostic only; not every regex is incorrect.

## Boundary defects to remove in v2

1. `CanonicalSurveyIntent` is assembled from already interpreted legacy outputs rather than being the model-produced source of truth.
2. `parseSurveyBrief` receives canonical intent but still reparses the raw request, derives respondents, and rewrites research subject and goal.
3. `analyzeSurveyPrompt` still branches on raw strings and can select deterministic semantic templates.
4. `parseSurveyDraftResponse` can reconstruct semantic state from raw prompt and can replace the model target with legacy/canonical/fallback values.
5. Fallback and repair are allowed to obtain question meaning from legacy blueprint text rather than one immutable canonical intent.
6. Cache keys have no semantic-authority namespace, so legacy and future v2 results are not isolated.

## Migration decision

The v2 path will be Preview-feature-flagged. Under that flag the OpenAI structured response must contain `CanonicalSurveyIntentV2`, plan, survey, and quality evidence in one call. Legacy parsers may execute only as shadow diagnostics. They must not determine clarification, prompt context, validation expectations, repair context, fallback content, cache identity, or the final response.

