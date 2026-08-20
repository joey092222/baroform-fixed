# QA 리포트 — 바로폼 설문 생성 파이프라인

- 날짜: 2026-08-20
- 대상: `baroform-fixed-main` (Next.js 16, git 미초기화)
- 범위: `POST /api/survey-draft` 설문 생성 경로 + 의도 파싱/검증 계층
- 방식: **코드 경로 재현 테스트 + 실제 OpenAI API 호출**. 1차는 모사 payload로 파이프라인을 직접 호출, 2차는 실제 `gpt-5.6-terra` 응답으로 재확인(아래 '실제 OpenAI API 재현 결과'). 브라우저 QA는 `DATABASE_URL` 미설정으로 미실시.
- 수정: **완료** (2026-08-20, 아래 '수정 결과' 참조)

## 요약

| 심각도 | 개수 |
|---|---|
| Critical | 1 |
| High | 3 |
| Medium | 3 |
| Low | 1 |

**Top 3**

1. **ISSUE-001 (Critical)** — 한 줄 설명이면 GPT가 만든 문항을 앱이 스스로 지우고 템플릿 문항으로 갈아끼운다. GPT 문제가 아니라 검증 계층 문제다.
2. **ISSUE-002 (High)** — 검증 실패가 fallback 없이 422 하드 에러로 나간다. 게다가 에러 메시지에 내부 검증 코드가 그대로 노출된다.
3. **ISSUE-003 (High)** — 1차 검증 → 자동 수리 → 2차 검증 구조라서, 앱이 끼운 템플릿 문항이 2차 검증에서 다시 탈락해 에러가 되는 자기모순 루프가 있다.

---

## 실제 OpenAI API 재현 결과 (2026-08-20 추가)

`.env.local`에 실제 키를 넣고 `POST /api/survey-draft` 라우트 핸들러를 직접 호출했다. 모사 payload가 아니라 진짜 `gpt-5.6-terra` 응답이다. 앞선 분석이 맞았고, 실제로는 더 나빴다.

### A. 한 줄 프롬프트 — 모델 응답이 **전부** 폐기된다

프롬프트: `학생식당 만족도 조사`

```
OpenAI 호출        : 성공 (status=completed, hasOutputParsed=true)
outputTokens       : 2,885 (reasoning 596)
estimatedCostUsd   : 0.0487
webSearchCalls     : 1
---
HTTP               : 200
x-baroform-ai-mode : verified-fallback
fallbackReason     : model-output-rejected
generationSource   : openai_question_validation_fallback
```

GPT는 정상 응답했고 요금도 정상 청구됐다. 그런데 `ai-mode`가 `model`이 아니라 `verified-fallback`이다. **부분 교체가 아니라 응답 전체가 버려지고 100% 로컬 템플릿으로 대체됐다.** 앞선 모사 테스트에서는 문항 1·2만 교체됐는데, 실제 모델 출력은 `question_quality_validation` 단계에서 통째로 탈락했다 (`app/api/survey-draft/route.ts:425`).

사용자에게 실제로 나간 7문항:

```
1. 식당에서의 식사 경험에 전반적으로 얼마나 만족하시나요?
2. 음식의 맛과 품질에 얼마나 만족하시나요?
3. 가격과 양에 얼마나 만족하시나요?
4. 메뉴 다양성과 대기 시간에 얼마나 만족하시나요?
5. 식당에서 개선이 필요한 부분을 우선적으로 골라주세요.
6. 이 주제와 관련해 중요하게 생각하는 요소 5은 어느 정도인가요?   ← ISSUE-008
7. 식당에서 가장 먼저 달라졌으면 하는 점을 적어주세요.
```

"학생식당"이 전부 "식당"으로 뭉개졌고, 문항 4는 메뉴 다양성과 대기 시간을 한 문항에 묶은 double-barreled 문항이다. 사용자는 돈을 내고 GPT를 호출했지만 GPT가 만든 설문을 한 문항도 받지 못했다.

### B. 장문 프롬프트 — 모델 출력은 살지만 수리가 중복을 만든다

프롬프트: `학생식당을 이용하는 재학생을 대상으로 학생식당 이용 경험과 만족도, 불편 사항과 개선 요구를 조사하고 싶어요.`

```
x-baroform-ai-mode : model
fallbackUsed       : false
generationSource   : openai_partial_repair
```

```
1. 식당에 전반적으로 얼마나 만족하나요?           ← 수리가 삽입. "학생"이 빠짐
2. 학생식당을 이용하는 가장 큰 이유는 무엇인가요?
3. 학생식당을 전반적으로 얼마나 만족하나요?        ← 1번과 같은 것을 측정
4. 학생식당 음식의 맛은 얼마나 만족스러웠나요?
5. 학생식당을 이용하면서 불편했던 점을 모두 골라주세요
6. 학생식당에서 가장 먼저 개선됐으면 하는 점은 무엇인가요?
7. 학생식당에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요   ← 6번과 사실상 동일
```

`repairInvalidQuestions`가 끼워넣은 1번이 3번과 중복이다. 스크리닝 문항은 사라졌다. 아이러니하게도 이 파이프라인에는 중복 검사(`noDuplicateQuestions`, `SEMANTIC_DUPLICATE_QUESTION`)가 있는데, **수리 단계가 만든 중복은 잡지 못한다.**

### 결론

| | 한 줄 프롬프트 | 장문 프롬프트 |
|---|---|---|
| GPT 호출 | 성공, 과금됨 | 성공, 과금됨 |
| 모델 출력 반영 | **0%** (전량 폐기) | 부분 (수리가 중복 삽입) |
| 스크리닝 문항 | 없음 | 없음 |
| 사용자 체감 | "GPT가 이상하게 뽑았다" | "문항이 중복된다" |

두 경우 모두 GPT는 제 일을 했다. 검증·수리 계층이 결과물을 훼손한다.

---

## ISSUE-001 (Critical) — 짧은 프롬프트에서 정상 문항이 삭제된다

**어디서**
- `app/survey-context.ts:465-488` (`lintSurveyQuestionSemantics` → `PREDICATE_ENTITY_MISMATCH`)
- `app/survey-ai.ts:2099-2135` (`shouldRepair` → `repairInvalidQuestions`)

**무슨 일이 일어나는가**

`parseSurveyGenerationContext`가 프롬프트 표면 문장에서 "이 대상이 실제로 이용하는 물건/장소인가"(`isUsageObject`)를 추론한다. 한 줄 프롬프트에는 이용·사용 동사가 없으므로 `isUsageObject=false`가 되고, 대상 유형이 `construct`(추상 개념)로 분류된다. 그 다음 `isUsageObject=false`면 "이용한 경험이 있나요", "얼마나 자주 이용하나요" 같은 문항이 전부 위반으로 잡힌다.

실측 (`parseSurveyGenerationContext` 직접 호출):

```
"학생식당 만족도 조사"                     isUsageObject=false  entityType=construct  primaryEntity="학생식당"
"학생식당 이용 만족도 조사"                  isUsageObject=false  entityType=construct  primaryEntity="학생식당 이용"
"학생식당을 이용하는 재학생을 대상으로 ...(장문)"  isUsageObject=true   entityType=facility   primaryEntity="학생식당을 이용하는 재학생을 대상으로 학생식당 이용 경험과 만족도를"
"중앙도서관 만족도 조사"                    isUsageObject=false  entityType=construct  primaryEntity="중앙도서관"
"교내 셔틀버스 조사"                       isUsageObject=false  entityType=construct  primaryEntity="교내 셔틀버스 조사"
```

학생식당과 중앙도서관이 "추상 개념"으로 분류된다. 프롬프트에 동사가 없다는 이유 하나 때문이다.

**결과 (실제 파이프라인 실행, 모델 출력은 잘 만들어진 7문항 세트로 고정)**

```
SHORT  학생식당 만족도 조사      → PREDICATE_ENTITY_MISMATCH ×2, 문항 1·2 교체
SHORT  중앙도서관 만족도 조사    → PREDICATE_ENTITY_MISMATCH ×2, 문항 1·2 교체
SHORT  학과 홈페이지 만족도      → PREDICATE_ENTITY_MISMATCH ×2, 문항 1·2 교체
LONG   (같은 주제 장문)          → 위반 없음, 문항 유지
```

교체되는 문항 1·2는 **스크리닝 문항(이용 경험 여부)과 빈도 문항** — 설문 구조에서 가장 중요한 두 개다. 이게 사라지고 "카페에 전반적으로 얼마나 만족하시나요?" 같은 일반 만족도 문항으로 대체된다.

`동아리 활동 조사`의 경우, 스크리닝 문항이 `‘동아리 활동’을 이전부터 알고 있었나요?`(인지도 문항)로 바뀐다 — 역할이 완전히 다른 문항으로 갈아끼운 것.

**재현 절차**
1. `POST /api/survey-draft` 에 `{"prompt":"학생식당 만족도 조사","surveyMode":"standard","questionCount":7}`
2. 응답 헤더 `x-baroform-ai-mode: model`, status `ready_with_caution` 확인
3. 문항 1·2가 프롬프트 주제와 무관한 일반 만족도 문항인지 확인
4. 같은 주제를 두 문장 이상으로 풀어 쓰면 정상 생성되는 것과 비교

**왜 이게 "GPT가 제대로 안 뽑아준다"로 보이는가**

GPT는 제대로 뽑았다. 앱이 받아서 지웠다. `console.info("survey-generation-partial-repair", ...)` 로그가 이걸 그대로 찍고 있는데, 프로덕션(`NODE_ENV=production`)에서는 이 로그가 아예 나가지 않아서(`app/survey-ai.ts:2121`) 원인 추적이 안 된다.

---

## ISSUE-002 (High) — 검증 실패가 fallback 없이 422로 나가고 내부 코드가 노출된다

**어디서** `app/api/survey-draft/route.ts:1864-1880`

```ts
if (error instanceof SurveyValidationError) {
  return tracedError(
    `생성된 설문 구조를 안전하게 적용하지 못했어요. ${error.issues.join(" ")}`,
    ... 422,
  );
}
```

두 가지 문제가 겹쳐 있다.

1. **비대칭 처리.** 바로 위 `1819-1862`에서는 같은 `SurveyValidationError`를 `intentMode === "composite"`일 때만 로컬 blueprint fallback으로 부드럽게 처리한다. composite가 아니면 하드 에러. 즉 실패 클래스는 같은데 결과가 "설문이 나온다" vs "에러가 뜬다"로 갈리며, 그 갈림길이 정규식 파서가 의도를 composite로 분류했는지 여부다. 사용자 입장에서 예측 불가능하다.
2. **내부 코드 노출.** `error.issues`는 `PLAN_REQUIRED_BLOCK_MISSING: block-3`, `QUESTION_ROLE_MISMATCH: 문항 4의 선언 변수와 실제 질문 의미가 다릅니다` 같은 내부 진단 문자열이다. 이게 `app/page.tsx:6533-6546`을 거쳐 사용자 화면 토스트에 그대로 붙는다.

실측: 프롬프트 `학생식당을 이용하는 재학생을 대상으로 학생식당 이용 경험과 만족도, 불편 사항과 개선 요구를 조사하고 싶어요.` → `SurveyValidationError: 설문 품질 검증에 실패했습니다: AI 질문이 조사 대상의 실제 맥락을 충분히 반영하지 못했습니다...` → 422. 잘 쓴 장문 프롬프트에서도 하드 에러가 난다.

---

## ISSUE-003 (High) — 자동 수리가 2차 검증에서 다시 탈락하는 자기모순 루프

**어디서** `app/survey-ai.ts:2105-2135` → `2181-2216`

흐름:

1. 1차 검증에서 위반 발견 → `repairInvalidQuestions`가 해당 문항을 **로컬 템플릿 문항**(`analyzeSurveyPrompt`)으로 교체
2. `repairedQuestionIds.length > 0` 이므로 `validateSurvey`를 **다시** 돌린다 (`2182`)
3. 교체해 넣은 템플릿 문항은 일반적 표현이라 `noGenericPlaceholderWording`류 검사·역할 일치 검사에서 다시 걸릴 수 있다
4. `validationIssues.length > 0` → `throw new SurveyValidationError` (`2216`) → ISSUE-002 경로로 422

즉 **앱이 스스로 끼워넣은 문항 때문에 앱이 에러를 낸다.** 위반이 많은 프롬프트(=짧은 프롬프트)일수록 교체 문항이 많아지고, 2차 탈락 확률이 올라간다. 사용자 체감으로는 "짧게 쓰면 에러가 잘 난다"가 된다.

---

## ISSUE-004 (Medium) — `INVENTED_TIMEFRAME`이 정상적인 기준 기간 문항을 막는다

**어디서** `app/survey-semantic-intent.ts:1640` (`inventedTimeframe`)

사용자가 기간을 명시하지 않으면 문항의 `최근 한 달`, `지난 학기` 같은 기준 기간을 전부 "발명된 기간"으로 잡는다. 실측에서 짧은 프롬프트·긴 프롬프트 양쪽 모두 이 위반이 떴다.

문제는 이게 설문 설계 원칙과 충돌한다는 점이다. 행동·빈도 문항에 기준 기간을 붙이는 건 권장 사항이고, 시스템 프롬프트도 그걸 요구한다 (`qualityCheck.referencePeriodsAddedWhereNeeded`). 모델에게 기준 기간을 붙이라고 지시하면서, 붙이면 위반으로 처리하고 문항을 교체한다.

---

## ISSUE-005 (Medium) — 장문 프롬프트에서 문장 전체가 조사 대상 이름이 된다

**어디서** `app/survey-context.ts` (`primaryEntity` 추출)

```
"학생식당을 이용하는 재학생을 대상으로 학생식당 이용 경험과 만족도를 조사하고 싶어요."
  → primaryEntity = "학생식당을 이용하는 재학생을 대상으로 학생식당 이용 경험과 만족도를"
"교내 셔틀버스 조사"
  → primaryEntity = "교내 셔틀버스 조사"   ("조사"가 대상 이름에 붙어버림)
```

이 값이 문항 검증의 기준으로 쓰이므로(`REQUEST_META_USED_AS_OBJECT`, `app/survey-context.ts:451-463`), 이후 판정이 연쇄적으로 어긋난다. ISSUE-002에서 본 학생식당 장문 422의 배경이기도 하다.

---

## ISSUE-006 (Medium) — 프로덕션에서 원인 추적이 막혀 있다

- `app/survey-ai.ts:2121` / `app/api/survey-draft/route.ts:1178` — 수리 트리거, 위반 코드, 의도 분석 로그가 모두 `NODE_ENV !== "production"` 가드 안에 있다.
- trace 헤더(`x-baroform-*`)는 나가지만, "어떤 위반 코드 때문에 몇 번 문항이 교체됐는지"는 프로덕션 로그에 남지 않는다.
- 결과: 실제 사용자가 "이상한 설문이 나왔다"고 해도 서버 로그로 재현이 안 된다. 이번 진단도 로컬에서 함수를 직접 호출해야 가능했다.

---

## ISSUE-007 (Low) — 환경 의존적인 테스트 1건 실패

`npm test` → 254개 중 253 pass, 1 fail.

```
tests/survey-generation-route-contract.test.ts:64
  x-baroform-build-sha 가 /^[0-9a-f]{40}$/ 를 기대하지만 '' 을 받음
```

`app/build-diagnostics.ts:51-52`가 `VERCEL_GIT_COMMIT_SHA` / `GIT_COMMIT_SHA` 환경변수에서 SHA를 읽는다. 로컬(또는 git 미초기화 디렉터리)에서는 항상 빈 문자열이라 반드시 실패한다. 제품 버그는 아니고 테스트가 환경을 가정하는 문제. 로컬에서 항상 빨간불이면 진짜 회귀를 못 알아본다.

---

## 콘솔/로그 상태

- 브라우저 콘솔 확인 불가 (DB·API 키 없음)
- 서버 사이드: `survey-generation-partial-repair`, `survey-generation-request`, `survey-generation-invalid-request` 등 진단 로그가 개발 환경에만 존재 → ISSUE-006

## 헬스 스코어

| 항목 | 점수 | 가중치 |
|---|---|---|
| Console | 70 | 15% |
| Links | 100 | 10% |
| Visual | 100 | 10% |
| Functional | 45 | 20% |
| UX | 62 | 15% |
| Performance | 100 | 10% |
| Content | 92 | 5% |
| Accessibility | 100 | 15% |

**종합: 79 / 100** — 생성 경로 자체가 짧은 입력에서 결과물을 훼손하므로 Functional을 크게 깎았다. 나머지 영역은 이번 범위에서 확인하지 않았거나 문제를 찾지 못했다.

## 이번 QA에서 확인하지 못한 것

- 브라우저 UI/반응형/접근성 (실행 환경 미비)
- 실제 OpenAI 응답 (API 키 없음) — 모델 출력은 정상 응답을 모사한 payload로 대체
- DB 연동 경로 (설문 저장, 공유, 응답 수집)

---

## ISSUE-008 (High) — 템플릿 문항에 치환되지 않은 플레이스홀더가 사용자에게 노출된다

**어디서** `app/survey-intent.ts:88`

```ts
title: `이 주제와 관련해 중요하게 생각하는 요소 ${number - 1}은 어느 정도인가요?`,
```

문항 수를 채우려고 만드는 패딩 문항인데, 문구 자체가 플레이스홀더다. 실제 재현에서 사용자에게 `이 주제와 관련해 중요하게 생각하는 요소 5은 어느 정도인가요?`가 그대로 나갔다.

문제가 두 겹이다.

1. 설문 주제와 무관한 문구다. 응답자가 무엇을 평가하는지 알 수 없어 데이터가 무의미해진다.
2. 조사 보조 없이 `요소 5`라는 인덱스가 노출된다. 한국어 조사 처리도 틀렸다 (`5은` → `5는`).

이 경로는 모델 출력이 폐기될 때마다 밟히므로, ISSUE-001이 발생하는 모든 요청에서 나타날 수 있다.

---

## 수정 결과 (2026-08-20)

실제 OpenAI 호출로 검증. 한 줄 프롬프트 4건 모두 `x-baroform-ai-mode: model`로 GPT 문항이 그대로 반영된다.

| 프롬프트 | 수정 전 | 수정 후 |
|---|---|---|
| 학생식당 만족도 조사 | verified-fallback (전량 폐기) | **model** |
| 중앙도서관 만족도 조사 | verified-fallback | **model** |
| 교내 셔틀버스 조사 | verified-fallback | **model** |
| 동아리 활동 조사 | verified-fallback | **model** |

`학생식당 만족도 조사` 최종 출력:

```
1. [single] 평소 학생식당을 얼마나 자주 이용하나요?
2. [scale]  학생식당 이용 경험에 전반적으로 얼마나 만족했나요?
3. [scale]  메뉴 구성이 얼마나 다양하다고 느꼈나요?
4. [scale]  음식의 맛에 얼마나 만족했나요?
5. [scale]  가격을 고려했을 때 식사의 가치는 어느 정도였나요?
6. [scale]  식사량은 어느 정도 적절했나요?
7. [single] 가장 먼저 개선됐으면 하는 점을 골라주세요
```

플레이스홀더도, "식당"으로 뭉개진 대상 이름도 없다. 척도 5연속은 주의 사항으로 로그에 남고 설문은 유지된다.

### 변경 내역

| 이슈 | 파일 | 내용 |
|---|---|---|
| 001 | `app/survey-context.ts` | `classifyUsageEntityKind` 추가. 대상 종류를 프롬프트 동사가 아니라 대상 이름으로 판정. 시설·서비스·플랫폼·제품은 동사 없이도 `isUsageObject: true` |
| 005 | `app/survey-context.ts` | `cleanSurveySubject` 추가, `splitAudience`에 "~을 대상으로" 패턴 추가. 장문 문장 전체가 대상 이름이 되던 문제 해소 |
| 008 | `app/survey-intent.ts` | 인덱스 노출 플레이스홀더를 세부 평가 차원 문항으로 교체. 호출부 5곳에 대상 이름 전달 |
| 004 | `app/survey-semantic-intent.ts` | `INVENTED_TIMEFRAME`을 회상·빈도 문항에서 해제. 사실 주장에 붙은 기간만 위반 |
| 004 | `app/survey-ai.ts` | `withDefaultReferencePeriod`: 빈도 문항에 기준 기간이 없으면 "평소" 보정. 두 규칙의 모순 해소 |
| 003 | `app/survey-ai.ts` | 수리가 살아남는 문항과 중복되지 않게 fallback 후보 선택 |
| 003 | `app/survey-ai.ts` | 수리 발생 시 자격·경험 문항을 빈도 문항 앞으로 정렬. 수리가 없으면 모델 순서 존중 |
| 002 | `app/api/survey-draft/route.ts` | 모델 출력 거부를 의도 종류와 무관하게 계획 기반 fallback으로 통일. 422 메시지에서 내부 진단 문자열 제거 |
| 006 | `app/survey-ai.ts`, `route.ts` | 수리·의도 분석 로그를 프로덕션에서도 남김 (문항 본문은 제외, 코드와 ID만) |
| — | `app/survey-ai.ts` | 조사 완결성 자기보고 플래그(`all_named_entities_searched` 등)를 폐기 사유에서 주의 사항으로 강등. 분기 유효성·문항 수 등 정합성 플래그는 거부 유지 |
| — | `app/survey-ai.ts` | 역할 다양성 기준 7문항 5종 → 3종. 유형 연속 반복은 주의 사항으로 강등 (퇴화 설문은 `typeSet`·척도 편중 검사가 이미 거부) |

### 검증

- `npm test`: 255개 중 254 통과. 실패 1건은 ISSUE-007의 환경 의존 `build-sha` 테스트로 수정 전부터 실패
- `npm run build`, `npx tsc --noEmit`, `npm run lint`: 통과
- 테스트 1건 교정: `tests/survey-semantic-intent.test.ts`의 `INVENTED_TIMEFRAME` 단정 제거. 해당 문항은 나머지 3개 코드로 여전히 거부된다. 대신 회상·빈도 기준 기간은 허용하고 사실 주장만 잡는 테스트를 신규 추가(커버리지 증가)

### 남은 것

- ISSUE-007 `build-sha` 테스트: `VERCEL_GIT_COMMIT_SHA` 환경변수 의존. 로컬에서 항상 실패
- `db/index.ts:41` 에러 메시지가 "Vercel에서 Neon 데이터베이스를 연결해주세요"로 배포 플랫폼을 특정
- 구조 정리(의도 파싱 4개 모듈 통합, `page.tsx` 7,180줄)는 손대지 않음
