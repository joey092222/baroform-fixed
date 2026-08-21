# QA 리포트 — 바로폼 설문 생성 오류 코드 분석

- 날짜: 2026-08-21
- 대상: `joey092222/baroform-fixed` @ `18fc7c7`
- 방식: 코드 정적 분석 + 로컬 파이프라인 재현 (`node --import tsx`)
- 범위: 사용자가 제보한 2건 (생성 실패 / 이상 문항)
- 상태: **4건 모두 수정 완료** — 하단 "수정 내역" 참고

---

## 요약

| ID | 제목 | 심각도 | 재현 |
|----|------|--------|------|
| ISSUE-001 | "관계 조사" 프롬프트가 항상 422로 실패 (`SEMANTIC_VALIDATION_FAILED`) | Critical | 100% |
| ISSUE-002 | 시간 측정 설문 5번 문항이 문법적으로 깨진 채 생성 | High | 100% |
| ISSUE-003 | 관계 변수명에 대명사 "그들의"가 그대로 남음 | Medium | 100% |
| ISSUE-004 | 로컬 폴백 검증 경로가 `measuredVariable` 메타데이터를 버림 | Medium | 코드상 확정 |

핵심: **생성기와 검증기가 서로 다른 어휘를 쓴다.** 생성기가 만든 정상 설문을 검증기가 못 알아보고 전량 폐기한다.

---

## ISSUE-001 — "관계 조사" 프롬프트가 항상 실패 (Critical)

### 사용자가 본 것
입력: `대학생들의 수면 시간과 그들의 지각 빈도 간 관계 조사`
토스트: `설문 내용을 안전하게 다듬지 못했어요. 요청 ID: 09fc9cc3-4f6f-b1c0-50c81442da79`

### 재현 결과

로컬에서 같은 프롬프트를 파이프라인에 넣으면 **정상적인 설문 7문항이 만들어진다**:

```
[1] 평소 수업이 있는 날 하루에 몇 시간 정도 자나요?        ← 수면 시간 측정
[2] 수업이나 약속에 늦은 빈도는 어느 정도인가요?           ← 지각 빈도 측정
[3] 이번 학기에 일주일 평균 수업이 있는 날은 며칠인가요?
[4] 이번 학기에 오전 10시 이전에 시작하는 수업은 일주일에 며칠인가요?
[5] 평소 등교할 때 편도 통학 시간은 어느 정도인가요?
[6] 이번 학기에 수업에 지각한 주된 이유를 모두 골라주세요.
[7] 수면이나 등교 준비와 관련해 덧붙이고 싶은 상황이 있다면 적어주세요.
```

그런데 `validateSurvey()`가 5개 위반을 뱉는다:

```
! INVENTED_TIMEFRAME:            사용자가 지정하지 않은 기간이 사실 진술로 문항에 추가됨.
! VARIABLE_COVERAGE_MISSING:     관계 분석에 필요한 응답자 수준 변수가 문항에서 측정되지 않음.
! MULTI_VARIABLE_INTENT_FLATTENED: 복수 변수 조사 요청이 하나의 주제로 평탄화됨.
! ANALYSIS_GOAL_NOT_SUPPORTED:   생성된 문항으로 요청한 관계·집단 비교 분석을 수행할 수 없음.
! RELATION_COVERAGE_MISSING:     분석 관계의 양쪽 변수가 각각 독립된 문항으로 측정되지 않음.
```

문항 1이 수면 시간을, 문항 2가 지각 빈도를 **실제로 측정하고 있는데도** 미측정이라고 판정한다. 전부 오탐.

### 근본 원인 — 생성기/검증기 어휘 불일치

**생성기** `app/survey-intent.ts:5218`:
```ts
if (/지각\s*빈도/.test(name)) {
  return question(
    id,
    `${timeframe}수업이나 약속에 늦은 빈도는 어느 정도인가요?`,   // "지각"이라는 단어를 일부러 안 씀
```

**검증기** `app/survey-semantic-intent.ts:2150`:
```ts
if (/지각\s*횟수/.test(variable.name)) {                        // 빈도 아님, 횟수만 등록됨
  return /지각.*(?:횟수|몇\s*회)|몇\s*회.*지각/.test(questionText);
}
```

`questionCoversVariable`(`app/survey-semantic-intent.ts:2103-2171`)은 변수명 → 문항 텍스트 정규식을 손으로 나열한 화이트리스트다. 등록된 항목은 통학 시간, 수면 시간, 나이, 지각 **횟수**, 공부 시간, 근무 시간, 거주 지역, 운동 빈도, 이용/사용 빈도 뿐이고 마지막에 `return false`로 끝난다.

- `지각 빈도`는 화이트리스트에 없음 → 어떤 문항도 매칭 안 됨
- 일반 매칭(2118-2125)은 문항 제목에 변수명 문자열이 들어있는지만 본다. 생성기가 "지각"을 회피했으므로 실패
- `수면 시간`은 2144행 규칙이 `몇 시간 ... 자` 패턴을 잡아서 통과 → 2개 중 1개만 커버

### 연쇄 전파

```
missingVariables = [지각 빈도]                                          → VARIABLE_COVERAGE_MISSING  (2186)
requiredVariables(2) - missing(1) = 1 < 2                              → MULTI_VARIABLE_INTENT_FLATTENED (2195)
                                                                       → ANALYSIS_GOAL_NOT_SUPPORTED     (2203)
relation.toIndexes.length === 0                                        → RELATION_COVERAGE_MISSING       (2214)
```

하나의 매칭 실패가 4개 위반으로 증폭된다.

`INVENTED_TIMEFRAME`(`app/survey-semantic-intent.ts:1640`)은 별개 오탐이다. 정규식이 `(?:이번|지난)\s*(?:학기|학년도)`를 잡는데, 문항 3·4·6의 "이번 학기에"는 **생성기가 직접 붙인 것**이다. 앱이 자기 출력에 자기 규칙을 위반했다고 판정한다.

### 왜 사용자에게 에러가 뜨는가 — all-or-nothing 게이트

`app/survey-ai.ts:2360`:
```ts
if (validationIssues.length > 0) {
  recordSurveyModelOutputRejection(trace, { at: "final_acceptance", ... });
  throw new SurveyValidationError(validationIssues);     // 쓸 만한 blueprint를 통째로 버림
}
```

→ `app/api/survey-draft/route.ts:1922` 에서 `SEMANTIC_VALIDATION_FAILED` + 422
→ `app/survey-generation-client.ts:202-211` 에서 사용자 문구로 변환

```ts
case "SEMANTIC_VALIDATION_FAILED":
case "REPAIR_FAILED":
case "REPAIR_EXHAUSTED": {
  return `설문 내용을 안전하게 다듬지 못했어요. 요청 ID: ${requestId}${debug}`;
}
```

폴백 경로(`route.ts:462-483`)도 `REPAIR_EXHAUSTED` 422로 끝나고 같은 문구를 탄다. **탈출구가 없다.**

또한 `shouldEnforceSurveyIntentValidation`(`app/survey-semantic-intent.ts:271`)은
```ts
return intent.rawInput.trim().length > 0;   // 입력이 있으면 무조건 true
```
라서 이 검증을 끌 방법이 없다.

### 영향 범위

이 프롬프트만의 문제가 아니다. 같은 5개 위반이 다음에서도 재현됐다:

```
"대학생들의 수면 시간과 그에 따른 지각 빈도 조사"   → 동일하게 5 issues
```

`relationParts`(`app/survey-research-intent.ts:154-206`)의 9개 관계 패턴 중 하나라도 걸리고, 추출된 변수명이 `questionCoversVariable` 화이트리스트에 없으면 **전부 실패**한다. 즉 "A와 B의 관계", "A에 따른 B", "A별 B", "A가 B에 미치는 영향" 계열 프롬프트에서 화이트리스트 밖 변수를 쓰면 구조적으로 100% 실패한다. 학술/연구 설문 사용자가 정확히 이 문장 형태를 쓴다.

### 개선 방향 (참고, 미적용)

1. `questionCoversVariable`의 화이트리스트 방식을 폐기하거나, 최소한 생성기가 실제로 쓰는 표현과 동기화. `app/survey-intent.ts:5199-5240`의 변수별 문항 생성기와 `app/survey-semantic-intent.ts:2126-2169`의 매처를 **하나의 테이블에서 파생**시켜야 다시 어긋나지 않는다.
2. 생성기가 문항을 만들 때 `measuredVariable: variable.name`을 심고, 매처가 텍스트가 아니라 그 필드를 신뢰하게 한다. (ISSUE-004 참조)
3. `severity: "repairable"` 위반만 남았을 때는 에러 대신 초안을 내보내고 경고로 표시. 사용자가 직접 고칠 수 있는 편집기가 이미 있는데 422로 막을 이유가 없다.
4. `INVENTED_TIMEFRAME`은 생성기가 붙인 기간(`timeframe` 변수 유래)을 화이트리스트 처리.

---

## ISSUE-002 — 시간 측정 설문 5번 문항이 깨진 채 생성 (High)

### 사용자가 본 것
문항 05: `sns 이용 시간을 주로 어떤 목적으로 쓰나요?`
선택지: 학업·업무 / 정보 탐색 / 소통·교류 / 오락·휴식 / 습관적으로 / 기타

### 재현 결과 (스크린샷과 완전 일치)

입력 `sns 이용 시간` → 7문항 생성, 5번이 정확히 그 문장. 검증 통과(0 issues)라서 **그대로 사용자에게 나간다.**

### 근본 원인

`app/survey-intent.ts:3898-3960` `durationMeasurementBlueprint`:

```ts
const focus = measurement.target;                          // "sns 이용"
const isRepeatableActivity =
  /(이용|사용|시청|게임|공부|학습|운동|독서|통학|등하교|근무)$/.test(focus);   // true

isRepeatableActivity
  ? question(
      5,
      `${focus} 시간을 주로 어떤 목적으로 쓰나요?`,        // ← 3948행
```

`focus`는 `measurementFromTopic`(`app/survey-intent.ts:344-361`)에서 나온다:

```ts
const durationMatch = normalized.match(
  /((?:이용|사용|소요|체류|대기|공부|학습|운동|시청|게임|통학|등하교|근무|활동|수면)\s*)?시간$/,
);
if (durationMatch) {
  const target = normalized.replace(/\s*시간$/, "").trim();   // "sns 이용 시간" → "sns 이용"
```

즉 `focus`는 이미 행위 명사("이용")로 끝나는데, 템플릿이 뒤에 `시간`을 다시 붙인다. 결과적으로 **"시간을 어떤 목적으로 쓰나"** 를 묻게 되어 질문의 대상이 행위가 아니라 시간이 된다. 선택지(학업·업무, 소통·교류…)는 *행위의 목적*을 나열한 것이라 질문과 어긋난다.

같은 파일에 **올바른 템플릿이 이미 존재한다** (`app/survey-intent.ts:3069`):

```ts
`${contextPrefix}${labelWithParticle(subject, "을", "를")} 주로 어떤 목적으로 이용하나요?`
```

`isRepeatableActivity === true`면 `focus`에서 꼬리 `이용/사용`을 떼고 이 형태를 써야 한다 → `SNS를 주로 어떤 목적으로 이용하나요?`

### 부수 결함

- **대소문자 정규화 없음.** `survey-intent.ts` 전체에 `toUpperCase` 호출이 0건이다. 사용자가 `sns`로 치면 제목·전 문항에 `sns`가 소문자로 박힌다 (`sns 이용 시간 조사`, `평일 하루 평균 sns 이용 시간은...`). SNS/OTT/AI/MBTI 같은 두문자어 화이트리스트가 필요하다.
- **`researchSubject`가 `"sns"`로 잘림.** `이용 시간`이 measurement로 분리되면서 주제어에서 사라진다. 지금은 눈에 안 띄지만 `validateSurvey`의 `researchSubject` 기반 규칙(`survey-intent.ts:5856`, `5926`)의 판단 근거가 빈약해진다.

---

## ISSUE-003 — 관계 변수명에 대명사가 남음 (Medium)

입력 `대학생들의 수면 시간과 그들의 지각 빈도 간 관계 조사` →
```
research.variables: [["수면 시간","predictor"], ["그들의 지각 빈도","outcome"]]
                                                 ^^^^^^
title: 대학생의 수면 시간과 그들의 지각 빈도 조사
```

`app/survey-research-intent.ts:113-132` `removePopulationPhrases`는 `대학생들의`를 지우지만, 조응 대명사 `그들의`는 목록에 없다.
`app/survey-research-intent.ts:134-144` `cleanVariableLabel`은 선두 접속어를 지우는데 목록이 `그리고 | 또한 | 그에 따른 | 그에 따라` 뿐이라 `그들의 / 그 / 해당 / 이들의`를 못 잡는다.

결과: 변수명·설문 제목·설명에 대명사가 그대로 노출되고, ISSUE-001의 문자열 매칭 실패를 한 겹 더 악화시킨다.

단, ISSUE-001의 **주원인은 아니다** — `그에 따른`(대명사 정리가 되는 형태)으로 바꿔도 동일하게 5개 위반이 난다.

---

## ISSUE-004 — 폴백 검증 경로가 메타데이터를 버림 (Medium)

`questionCoversVariable`은 `compactMetadata`(= `measuredVariable` + `measuredConstruct`)로도 매칭을 시도한다 (`app/survey-semantic-intent.ts:2109-2122`). 이건 텍스트 매칭보다 훨씬 정확한 경로다.

그런데 호출부가 두 갈래인데 넘기는 필드가 다르다:

| 호출부 | 전달 필드 |
|--------|----------|
| `app/survey-ai.ts:2027-2038` (모델 출력) | id, title, type, options, **measuredConstruct, measuredVariable, measuredRole**, planBlockId, ... |
| `app/survey-intent.ts:5953-5958` (`validateSurvey`) | id, title, options, reason — **끝** |

`validateSurvey` 경로에서는 `compactMetadata`가 항상 빈 문자열이라 메타데이터 매칭이 죽는다. 게다가 `candidateQuestionText`(`app/survey-semantic-intent.ts:1607`)는 `title`만 읽고 `reason`은 무시한다. 문항 2의 reason에 `"...지각 빈도를 측정함"`이라고 정확히 적혀 있는데도(`survey-intent.ts:5222`) 매칭에 쓰이지 않는다.

정보는 이미 있는데 전달선이 끊겨 있다.

---

## 재현 방법

```bash
cd baroform-fixed && npm install
```

`_repro.ts`를 루트에 두고:

```bash
node --import tsx _repro.ts
```

스크립트 사본: `<scratchpad>/baroform-repro.ts`

---

## 수정 내역

변경 파일 3개 (+59 / -18), 회귀 테스트 9개 신규.

| # | 파일 | 변경 |
|---|------|------|
| 1 | `app/survey-intent.ts` `validateSurvey` | `measuredVariable`·`measuredConstruct`·`measuredRole` 등을 검증기에 전달. 제목 문자열 매칭 의존 제거 (ISSUE-004, ISSUE-001 주 수정) |
| 2 | `app/survey-semantic-intent.ts:2150` | 매처를 `지각 횟수` → `지각 (횟수\|빈도)`로 확장하고 생성기가 쓰는 "늦은 빈도" 표현 인식 (ISSUE-001) |
| 3 | `app/survey-intent.ts` `relationalIntentBlueprint` | 하드코딩 "이번 학기에" 제거. 사용자가 기간을 준 경우만 그 기간 사용, 아니면 "평소" (ISSUE-001 `INVENTED_TIMEFRAME`) |
| 4 | `app/survey-research-intent.ts` `cleanVariableLabel` | 선두 대명사 `그들의/이들의/그/이/해당/위 집단의` 제거 (ISSUE-003) |
| 5 | `app/survey-intent.ts` `durationMeasurementBlueprint` | 행위 동사와 대상을 분리해 `SNS를 주로 어떤 목적으로 이용하나요?` 생성. 대상이 없는 경우(통학·게임)는 맥락 문항으로 폴백 (ISSUE-002) |
| 6 | `app/survey-intent.ts` `normalizePrompt` | 두문자어 표기 정규화 (`sns` → `SNS` 외 16종) (ISSUE-002 부수) |

### 검증 결과

수정 전 → 후:

```
"대학생들의 수면 시간과 그들의 지각 빈도 간 관계 조사"
  5 issues (422 에러)  →  0 issues (설문 정상 생성)

"대학생들의 수면 시간과 그에 따른 지각 빈도 조사"
  5 issues             →  0 issues

"대학생들의 SNS 이용 시간 조사"  문항 5
  "sns 이용 시간을 주로 어떤 목적으로 쓰나요?"
  → "SNS를 주로 어떤 목적으로 이용하나요?"
```

- `npx tsc --noEmit` — 통과
- `npx eslint` (변경 파일) — 통과. 프로젝트 전체에는 `.qa-ab.ts`의 기존 `no-explicit-any` 3건이 남아 있으나 이번 변경과 무관
- 테스트 264개 중 263 pass / 1 fail. 유일한 실패는 수정 전 베이스라인에도 있던 `tests/survey-sharing.test.ts`의 `.env.example` ENOENT (해당 파일이 저장소에 없음)
- 신규 `tests/survey-generation-regressions.test.ts` 9개 전부 통과

### 의도적으로 손대지 않은 것

`app/survey-ai.ts:2360`의 all-or-nothing 게이트는 그대로 뒀다.

```ts
if (validationIssues.length > 0) throw new SurveyValidationError(validationIssues);
```

이번 수정은 **오탐을 없앤 것**이지 게이트를 느슨하게 한 게 아니다. 게이트를 풀면 진짜 품질 문제가 있는 설문까지 통과하므로, 안전 속성은 유지하는 쪽을 택했다.

다만 구조적 위험은 남아 있다: `questionCoversVariable`은 여전히 손으로 관리하는 화이트리스트고, `researchVariableQuestion`의 변수별 문항 생성기와 별도로 유지된다. 지금은 `measuredVariable` 메타데이터가 1차 경로라 화이트리스트는 폴백이 됐지만, 메타데이터가 없는 모델 출력 경로에서는 같은 종류의 오탐이 재발할 수 있다. 두 테이블을 하나의 소스에서 파생시키는 리팩터링이 근본 해법이다.

---

## 우선순위 (수정 전 기준)

1. **ISSUE-001** — 연구·관계형 프롬프트 전체가 막힌다. 사용자가 우회할 방법이 없다.
2. **ISSUE-002** — 실패가 아니라 조용한 품질 저하라 더 오래 방치된다.
3. **ISSUE-004** — ISSUE-001의 정석 수정 경로.
4. **ISSUE-003** — 표시 품질.
