# Survey regression v1 remediation

작성일: 2026-08-19  
수정 브랜치: `codex/fix-survey-regression-root-causes-v1`

## 범위와 불변 조건

- 기존 100개 dataset과 기대값은 변경하지 않았다.
- baseline 결과와 감사·군집 artifact는 수정하지 않았다.
- 학교·시설·서비스명, case ID, 실패 문장 전체를 production 분기에 추가하지 않았다.
- 토큰 절감, main 병합, Production 배포는 이 작업 범위에 포함하지 않았다.

## 원인 1 — canonical 응답자와 조사 대상 역할 손실

- 커밋: `a44a16f fix(ai): preserve canonical respondent and survey object roles`
- 수정 전: 관형절·부정 조건·비교 요청에서 응답자와 조사 대상이 서로 바뀌거나 전체 집단으로 확대됐다.
- 일반화 원칙: 사용자 원문에서 확정한 canonical audience, entity, activity, purpose의 역할을 모델 메타데이터보다 우선한다.
- 수정 계층: canonical intent, context/brief 파생, fallback 응답 메타데이터.
- 회귀 테스트: 실제 구조를 비식별화한 fixture, 가상 고유명사, 전체 집단 control, 이용·비이용 반대 조건.
- 특정 문장 하드코딩: 없음.

## 원인 2 — 복구 가능한 모델 출력의 전면 fallback

- 커밋: `2e0829b fix(ai): repair recoverable model survey output`
- 수정 전: 질문 본문은 유효하지만 metadata나 계획 연결이 일부 어긋난 출력도 전체가 hard fallback으로 교체됐다.
- 일반화 원칙: canonical intent와 SurveyPlan으로 결정적으로 복구 가능한 metadata만 제한적으로 보정하고, 질문·선택지의 의미 오류는 계속 거절한다.
- 수정 계층: 모델 결과 normalization, plan coverage validation, partial repair 분류.
- 회귀 테스트: 복구 가능한 metadata 누락, 복구 불가능한 질문/선택지 오류, 정상 출력 control.
- 특정 문장 하드코딩: 없음.

## 원인 3 — 검증 가능한 요청의 불완전 응답 계약

- 커밋: `df8d864 fix(ai): complete validated survey fallback responses`
- 수정 전: 관계형·비이용자·복합 목적 요청 일부가 schema/semantic 실패 뒤 불완전 응답으로 끝났다.
- 일반화 원칙: 동일 canonical intent와 SurveyPlan에서 검증 가능한 문항 수·필수 block·최종 응답 계약을 완성하고, sentinel 기간을 실제 기준 기간으로 취급하지 않는다.
- 수정 계층: Route Handler 최종화, plan 기반 fallback, usage blueprint 적합성 판정.
- 회귀 테스트: 관계형 기간·빈도, 비이용 이유·기능 수요, 실제 복수 대상, 단일 대상·복수 목적, 가상 명칭, 정상 서비스/행사 control.
- 특정 문장 하드코딩: 없음.

## 추가 요청 계약 결함 — 사용자 원문의 비-user 메시지 중복

- 커밋: `6f54b38 fix(ai): keep raw survey input in one model message`
- 발견 경로: 수정 코드로 100개 static evaluation을 실행하자 36개 요청에서 raw input이 canonical evidence와 파생 문맥을 통해 developer 메시지에 반복됐다.
- 수정 전: user role에는 원문이 한 번 있었지만 developer/instructions에도 같은 전체 문자열이 최대 33회 나타났다.
- 일반화 원칙: 원문은 user 메시지 한 곳만 의미 권한의 원본으로 유지하고, developer/instructions에서 우연히 동일한 전체 문자열이 생기면 user 메시지 참조 표식으로 치환한다.
- 수정 후: 100/100 요청에서 `USER_INPUT_NOT_EXACTLY_ONCE`와 `USER_INPUT_DUPLICATED_OUTSIDE_USER_ROLE`가 0건이다.
- 특정 문장 하드코딩: 없음. 테스트 사례는 재현 fixture일 뿐 production 분기에 사용하지 않는다.

## 저장 결과 replay 가능 범위

기존 artifact에는 최종 설문, `questionsBeforePostprocess`, generation source, fallback reason, schema/semantic/quality 진단이 저장돼 있다. 그러나 OpenAI 원본 응답 전체와 구조화 파싱 직전 payload는 저장돼 있지 않다. 따라서 다음을 구분했다.

- 가능: canonical intent·SurveyPlan·OpenAI request 계약의 100개 static replay.
- 가능: 저장된 최종 결과와 trace의 evaluator 재채점.
- 불가능: 과거 raw model output을 새 parser/repair 코드에 그대로 투입하는 완전한 stored-output replay.

없는 raw output을 재구성하거나 성공 결과로 조작하지 않았다.

## 수정 후 로컬 검증

### 100개 static evaluation

- 모델 호출: 0
- 요청 원문 불변식: 100/100 통과
- 전체 static fatal 판정: 57/100 통과
- Dev: 50/80
- 기존 seen holdout: 7/20
- 비치명 plan concept warning: 59건

남은 static fatal은 주로 규칙 기반 parser의 비교/복수 대상·부정 조건·clarification 판정이다. 이 수치는 실제 모델 최종 설문 품질과 동일하지 않으므로 기대값을 느슨하게 바꾸지 않고, 실제 Preview OpenAI smoke 및 최종 live evaluation에서 별도로 판정한다.

### 코드 검증

- Node test: 354/354 통과
- TypeScript: 통과
- ESLint: 통과
- Next.js production build: 통과
- `git diff --check`: 통과
- 비밀정보 패턴 검사: 검출 없음

## 실제 OpenAI smoke

아직 실행 전이다. fix 브랜치 전용 Preview를 새로 생성한 뒤, 원인별 최대 15개와 정상 control을 최초 1회만 호출하고 이 절을 갱신한다.
