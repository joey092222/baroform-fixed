# 바로폼 설문 회귀 데이터셋 v1.2 의미 권한 감사

## 동결 대상

- 버전: `v1.2-intent-authority-audited`
- 원본: `survey-regression-v1.1-audited`
- Dev: 80건
- Seen Holdout: 20건
- 합계: 100건
- 기대값 변경: 0건

## 감사한 필드

- `inputQuality`
- `expectedOutcome`
- `expectedTargetPopulation`
- `expectedEligibilityConditions`
- `contextEntities`
- `expectedSurveyObject`
- `expectedPurposeConcepts`
- 관계형 조사 기대값과 필수 문항 개념
- `clarificationExpected`
- 부정 표현 보존
- 기준 기간 보존

## 동결 방식

기존 결과를 보고 기대값을 바꾸지 않았다. v1.1의 Dev/Holdout JSON을 그대로 두고, `evals/survey-regression/v1.2/manifest.ts`에서 각각의 SHA-256과 건수를 고정한다. 따라서 평가기가 기대값을 조용히 수정하거나 다른 파일을 읽으면 테스트에서 실패한다.

## 결론

명백한 dataset specification error는 발견되지 않았다. 새 V2 pipeline 평가는 동결된 동일 100건과 비교하며, legacy 결과와의 일치 여부가 아니라 golden 의미 역할과의 일치 여부로 판정한다.
