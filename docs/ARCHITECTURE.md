# 층 구조 — UI를 어떻게 통째로 갈아엎는가

이 문서는 딱 한 가지를 보장하기 위해 존재합니다:
**`app/ui/`를 전부 지우고 처음부터 다시 그려도 앱이 동작한다.**

## 층

```
app/api/**            서버. UI 재설계 대상 아님.
app/*.ts, app/lib/**  도메인 로직 (설문 설계 AI, 의도 분석, 응답 품질, 내보내기…)
                      UI를 어떻게 바꿔도 손대지 않음.
app/ux/               상태 · 플로우 · 규칙 · 데이터 접근.  마크업 0줄.
app/page.tsx          조립층. 위 두 층을 잇는 유일한 지점.
app/ui/               마크업 + 스타일.  ← 폐기 대상
app/*.css             5개 파일 약 9,000줄.  ← 폐기 대상
```

의존 방향은 한 방향입니다. **`app/ux/`는 `app/ui/`를 import하지 않습니다.**

```bash
grep -rn "from \"../ui\|from \"../../ui\|app/ui" app/ux
```

이 명령이 아무것도 출력하지 않아야 합니다. 출력되면 경계가 깨진 것입니다.

## UI를 새로 그리는 절차

1. `app/ui/`를 통째로 지웁니다. CSS 5개(`design-tokens` / `editorial-pages` / `studio` / `secondary-pages` / `results-dashboard`)도 함께 지웁니다.
2. [docs/UX-SPEC.md](UX-SPEC.md) 7절 체크리스트로 **어떤 UX 결정을 승계할지** 먼저 정합니다. 이걸 안 하면 옛 구조를 무의식적으로 다시 그립니다.
3. 새 컴포넌트를 만듭니다. 데이터·상태는 훅에서만 받습니다:

```tsx
import { useSurveyResponse } from "@/app/ux/state/use-survey-response";
import { scaleValues, answerLengthLimit } from "@/app/ux/survey-response";

function MyRespondScreen({ survey, authToken }) {
  const { questions, answers, progress, error, setAnswer, toggleChoice, submit } =
    useSurveyResponse({ survey, authToken });
  // 여기서부터는 전부 자유. 마크업·스타일에 대한 제약 없음.
}
```

4. `app/page.tsx`에서 import 경로만 새 컴포넌트로 바꿉니다.
5. `npm run test` — [UX 테스트 3종](UX-SPEC.md#테스트로-고정된-규칙)이 통과하면 동작은 보존됐습니다.

## 규칙 두 개

**하나. UI에서 `fetch`를 부르지 않습니다.** 모든 요청은 `app/ux/data/`를 거칩니다.

```bash
grep -rn "fetch(" app/ui
```

현재 여기서 나오는 것은 [ui/shared/reference-input.tsx](../app/ui/shared/reference-input.tsx)의 참고파일 멀티파트 업로드 3곳뿐입니다 — 아직 옮기지 않은 유일한 예외입니다.

**둘. 한계값·검증 규칙을 UI에 다시 쓰지 않습니다.** 문항 30개, 선택지 2~12개 같은 숫자는 `app/ux/`에서 읽어옵니다. UI에 하드코딩하면 UI를 버릴 때 규칙도 같이 사라집니다.

## 새 UX 규칙을 추가할 때

1. 순수 함수로 쓸 수 있으면 `app/ux/survey-editing.ts` / `survey-response.ts` / `navigation.ts`에 넣고 테스트를 붙입니다.
2. React 상태가 필요하면 `app/ux/state/use-*.ts`에 넣습니다. **DOM을 만지지 않습니다** — 스크롤·포커스가 필요하면 무엇이 일어났는지만 반환하고, 호출하는 UI가 처리합니다. (`useSurveyResponse.submit()`이 `blockedQuestion`을 돌려주는 것이 이 패턴입니다.)
3. 새 API 호출은 `app/ux/data/`에 함수로 추가합니다.
