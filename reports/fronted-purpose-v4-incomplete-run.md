# Fronted-purpose incomplete Preview run

- Run ID: `fronted-purpose-v5-7a385bb-20260820`
- Status: `incomplete_transport_interruption`
- Branch: `codex/fix-survey-regression-root-causes-v1`
- Build SHA: `7a385bb1dcaa94817c69cf73bd3d9e3bdf1271ab`
- Expected cases: 20
- Completed semantic cases: 8
- Transport failures before a server response: 1
- Not executed: 11
- Valid for the 20-case gate: **No**

## Completed paths

- `deterministic_metadata_normalization`: 7
- `partial_repair`: 1
- `hard_fallback`: 0
- request failure after a model call: 0
- clarification: 0 (not all clarification cases were reached)

## Screening audit

### `fronted-clear-001`

The first three questions were:

1. 최근 한 달 동안 별마루 카페를 이용한 적이 있나요?
2. 최근 한 달 동안 별마루 카페를 얼마나 자주 방문했나요?
3. 최근 한 달 동안 별마루 카페의 새 메뉴를 먹거나 마셔 본 적이 있나요?

Questions 1 and 2 measure the cafe visit qualification and cafe visit frequency. They do not assume that the respondent tried the new menu. Question 3 appears before the new-menu choice reason, satisfaction, and improvement questions that depend on trying the new menu. The stored `MISPLACED_SCREENING_QUESTION` finding is therefore an evaluator false positive, not evidence for reordering production questions.

### `fronted-clear-005`

The third question was `다온 플랫폼을 사용하지 않는 가장 큰 이유는 무엇인가요?`. It directly measures the requested non-use reason. It does not qualify or disqualify the respondent, so treating it as a screening question is an evaluator false positive.

## Partial repair audit

`fronted-clear-002` (`requestId=c645cf0b-c2ad-4561-8925-dc9c99503c48`) changed question `2`, field `title`, and was correctly recorded as respondent-facing `partial_repair`. The same-request Preview trace shows one model call and one repair, with no final missing blocks, incompatible question IDs, semantic duplicates, schema issues, semantic violations, or quality violations. The repair made the explicit reference-period contract respondent-facing; metadata-only normalization could not correct that question wording. This is therefore classified as a necessary partial repair. The incomplete artifact did not expose the full pre-repair title, so no wording is reconstructed or invented here.

## Transport interruption

`fronted-noisy-001` stopped before a valid HTTP response with `VERCEL_CURL_EXIT_1`. No server request ID, HTTP status, or model call was observed. This is an environment transport failure and is excluded from product meaning statistics. The remaining cases were not executed after the circuit breaker stopped the run.
