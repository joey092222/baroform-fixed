# 바로폼 UX 명세서

코드에서 역추출한 **동작 명세**입니다. UI를 백지에서 다시 그릴 때, 이 문서에
적힌 것만 지키면 기능이 깨지지 않습니다. 9절에 각 항목의 구현 위치가 있습니다.

## 0. 읽는 법 — 표기 규칙

문서 전체에서 모든 항목에 다음 중 하나가 붙습니다.

| 표기 | 뜻 | 재설계 시 |
|---|---|---|
| **[고정]** | 도메인 사실 또는 API 계약. 서버·DB·타입이 강제함 | 지켜야 함 |
| **[UX 결정]** | 첫 설계자의 판단. 기술적 근거 없음 | **자유롭게 바꿀 수 있음** |
| **[UI]** | 시각 표현. 이 문서의 관심사가 아님 | 전부 새로 정함 |

> **[UX 결정]이 이 문서에 남아 있는 이유**: 지우면 "왜 이랬는지" 근거가 사라져 같은 판단을 무의식적으로 반복하게 됩니다. 남겨두고 **의식적으로 승계 또는 폐기**를 결정하기 위한 목록입니다.

---

## 1. 시스템 경계

```
[고정]  도메인 로직층 — app/*.ts, app/lib/**  (약 30개 모듈, 테스트 29개)
        설문 설계 AI, 의도 분석, 문항 계획, 응답 품질, 내보내기, 보상 계산
        → UI를 어떻게 바꿔도 손대지 않음. 테스트가 이 층만 검증함.

[고정]  API 계약 — app/api/**  (12개 라우트)
        → 요청·응답 형태 유지. UI 재설계 대상 아님.

[UX]    app/ux/  ← 이 문서가 다루는 층
        전역 상태, 화면 전이, 검증 규칙, 데이터 요구, 오류·빈 상태

[UI]    app/ui/ + CSS 5개 파일(약 9,000줄)
        → 디렉터리째 폐기 가능. app/page.tsx가 두 층을 잇는 유일한 지점.
```

---

## 2. 전역 상태 인벤토리

`app/ux/state/` 의 훅들이 나눠 들고 있습니다. 성질별로:

### 2-1. 세션 — **[고정]**
| 상태 | 타입 | 지속성 |
|---|---|---|
| `user` | `AuthUser \| null` (id, email, name, schoolId) | 메모리 |
| `authToken` | `string` | `localStorage["baroform:session-token"]` |
| `wallet` | `{ balance, transactions[] }` | 서버 (`GET /api/wallet`) |

- 부팅 시 저장 토큰으로 `GET /api/auth/session` 검증. 실패하면 토큰 삭제. **[고정]**
- 어떤 API든 401 반환 시 → 세션 전체 초기화 + 로그인 요구. **[고정]**
- 로그아웃 시 `DELETE /api/auth/session`. **[고정]**

### 2-2. 설문 초안 (작업 중 문서) — **[고정]**
`surveyTitle`, `description`, `questions[]`, `targetGrade`, `questionCount`, `surveyMode`, `references`

- 생성 → 편집 → 배포 전 구간에서 **하나의 문서로 이어집니다.** 화면을 나눠도 이 문서는 끊기면 안 됩니다. **[고정]**
- `references`는 이미지(dataURL) / 파일(업로드 토큰) / 링크 3종. **[고정]**

### 2-3. 발행된 설문 핸들 — **[고정]**
`publishedSlug`, `manageToken`, `publishedListingRequested`

- `localStorage["baroform:last-managed-survey"]`에 `{slug, manageToken, title, questions}` 저장. **[고정]**
- 저장 형식 검증: slug는 `/^[a-f0-9]{12}$/`, manageToken은 `/^[a-f0-9]{32}$/`. 불일치 시 삭제. **[고정]**
- **비로그인 상태로 발행 후 나중에 로그인하면**, 저장된 핸들로 `POST /api/surveys/claim`을 호출해 소유권을 붙입니다. **[고정 — 중요]** 이 승계 로직이 빠지면 사용자가 자기 설문을 잃습니다.

### 2-4. 목록 캐시 — **[고정]**
`publicSurveys[]`, `mySurveys[]`, `activeSurvey`

- 공개 목록 = 내부 설문(`/api/surveys?school=yonsei`) + 외부 설문(`/api/external-surveys`)을 **합쳐서 `createdAt` 역순** 정렬. **[고정]**

### 2-5. 순간 상태 — **[UX 결정]**
`toast`, `isAnalyzing`, `clarification`, `publishOpen`, `authOpen`, `publishing`, `publishError`, `workspaceSidebarOpen`, `workspaceReviewToken`

- 토스트 노출 시간이 상황별로 1800~5200ms로 흩어져 있습니다. **[UX 결정]** — 재설계 시 통일 권장.

---

## 3. 진입 & 라우팅

**[고정]** 이 앱은 URL 경로 기반 라우팅을 쓰지 않습니다. 단일 페이지 + `view` 상태 + 쿼리 파라미터입니다.

| 진입 조건 | 도착 | 표기 |
|---|---|---|
| 파라미터 없음 | 랜딩 | [UX 결정] |
| `?app=1` | 홈 | [고정] |
| `?survey=<slug>` | 응답 화면 (해당 설문 로드) | [고정] |
| `?workspaceReview=<32자 hex>` | 협업 리뷰 화면 | [고정] |
| `/s/<shareToken>` (별도 라우트) | 서버 렌더 후 응답 화면 | [고정] |

- 화면 이동 시 `history.replaceState`로 `?app=1` 유지. `popstate`로 재동기화. **[고정]**
- 이동할 때마다 스크롤 최상단. **[UX 결정]**

> **[UX 결정 — 재검토 대상]** 13개 화면을 하나의 `view` 문자열로 관리하는 방식 자체. Next.js 실제 라우트로 쪼개면 URL 공유·뒤로가기·코드 스플리팅이 전부 개선됩니다. 다만 2-2의 "설문 초안이 화면 간에 이어져야 한다"는 제약 때문에 초안은 별도 저장소가 필요합니다.

---

## 4. 화면별 명세

`view` 값 13종: `landing` `home` `board` `pulses` `community` `workspace` `workspace-review` `mypage` `create` `editor` `published` `survey` `analytics`

### 4-1. 랜딩 (`landing`)
- **목적**: 미로그인 방문자에게 제품을 설명하고 앱으로 들여보낸다.
- **데이터**: 공개 설문 목록(있으면), 없으면 **하드코딩 샘플 6건** ([ui/views/landing.tsx](../app/ui/views/landing.tsx))
- **규칙**: 실 데이터 0건이면 샘플로 대체 — **[UX 결정]** 빈 화면을 보여주지 않겠다는 판단. 유지 여부 결정 필요.
- **전이**: 어떤 CTA든 → 홈 (`history.pushState`로 `?app=1`)

### 4-2. 홈 (`home`)
- **목적**: 로그인 후 첫 화면. 할 일(설문 만들기)과 남의 설문·투표·게시글을 한 번에 보여준다.
- **데이터**: 공개 설문, 내 설문, 지갑 잔액, 캠퍼스 투표 목록, 커뮤니티 글 **상위 6건**
- **로컬 상태**: 빠른 프롬프트 입력, 설문 검색어, 카테고리 필터, 외부설문 등록 모달, 투표 생성 모달
- **[고정]** 홈에서 프롬프트를 입력하고 이동하면 그 값이 생성 화면으로 승계됨
- **[UX 결정]** 한 화면에 5개 섹션(생성 유도 / 설문 목록 / 투표 / 커뮤니티 / 내 설문)을 모두 올린 구성. 정보 과밀 여부 재판단 대상.
- **[UX 결정]** 커뮤니티 미리보기 6건, 학교 `yonsei` 하드코딩

### 4-3. 학교 게시판 (`board`)
- **목적**: 참여할 설문을 찾는다.
- **데이터**: 공개 설문 목록
- **필터·정렬 [고정]**: 카테고리 6종 / 검색(제목·게시자·설명·카테고리명 대상) / 정렬 4종 — 최신·짧은순(`durationMinutes`)·보상순(`rewardCash`)·인기순(`responseCount`)
- **[고정]** 외부 설문은 클릭 시 새 탭으로 열고 `POST /api/external-surveys/<slug>/visit` 기록

### 4-4. 캠퍼스 투표 (`pulses`)
- **목적**: 한 문항 즉석 투표.
- **[고정]** 미로그인 → 투표 시도 시 로그인 모달. 학교 계정당 1회. 기간 내 변경 가능.
- **[고정]** 집계는 선택지별 득표수 + 총합. 학년·학과 등 추가 속성 수집 안 함.

### 4-5. 커뮤니티 (`community`)
- **목적**: 게시글·댓글·좋아요.
- **[고정]** 범위(scope) × 카테고리 필터, 글 작성/삭제, 댓글, 좋아요 — 모두 로그인 필요
- **현재 위치**: [ui/views/community.tsx](../app/ui/views/community.tsx). 데이터 접근은 [ux/data/community.ts](../app/ux/data/community.ts)

### 4-6. 협업 워크스페이스 (`workspace`) / 리뷰 (`workspace-review`)
- **목적**: 팀으로 설문 작업, 외부인에게 리뷰 링크 전달.
- **[고정]** 리뷰는 `?workspaceReview=<32자 hex>` 토큰만으로 접근 (로그인 불필요)
- **현재 위치**: [ui/views/workspace.tsx](../app/ui/views/workspace.tsx). 데이터 접근은 [ux/data/workspaces.ts](../app/ux/data/workspaces.ts)

### 4-7. 마이페이지 (`mypage`)
- **목적**: 내 설문 관리, 캐시 확인.
- **데이터**: 내 설문 목록, 지갑
- **집계 [UX 결정]**: 총 응답 수, 게시된 설문 수
- **[고정]** 삭제는 `window.confirm` 확인 후 실행. 응답까지 함께 삭제되고 되돌릴 수 없음.
- **[UX 결정]** 확인 수단으로 브라우저 기본 `confirm` 사용 — 교체 대상.

### 4-8. 설문 생성 (`create`)
- **목적**: 무엇을 조사할지 입력받아 AI 초안을 만든다.
- **입력 [고정]**
  | 항목 | 제약 |
  |---|---|
  | 프롬프트 | 최대 300자 |
  | 참고 이미지 | 최대 10개, dataURL 총 300,000자 |
  | 참고 파일 | `reference-files.ts`의 개수·용량·MIME 제한 |
  | 참고 링크 | 최대 3개 |
  | 설문 방식 | `standard` / `research` |
  | 응답 대상 | 7종 (1~4학년, 1-2, 3-4, 전학년) |
  | 문항 수 | 1~30 |
- **생성 가능 조건 [고정]**: 프롬프트 2자 이상 **또는** 참고자료 1개 이상
- **[고정]** `recommendSurveyMode()`가 프롬프트·첨부파일명을 보고 `research` 모드를 추천 (논문·가설·척도 등 키워드)
- **[고정]** 프롬프트가 비고 첨부만 있으면 기본 문장으로 대체: "첨부 자료를 바탕으로 만족도와 개선점을 조사하고 싶어요."
- **[고정]** 프롬프트나 참고자료를 수정하면 진행 중이던 분석은 무효화 (요청 카운터 증가)
- **[UX 결정]** Enter로 생성 실행(Shift+Enter는 개행), IME 조합 중에는 무시 — 로직은 [prompt-keyboard.ts](../app/prompt-keyboard.ts)에 분리되어 있음
- **[UX 결정]** 진입 시 입력창 자동 포커스

### 4-9. 설문 편집 (`editor`)
- **목적**: AI 초안을 사람이 다듬는다.
- **문항 타입 9종 [고정]**: `single` `multiple` `dropdown` `scale` `shortText` `text` `date` `time` `section`
- **편집 규칙 [고정]**
  | 동작 | 제약 |
  |---|---|
  | 문항 추가/복제/섹션 추가 | 총 30개까지 |
  | 문항 삭제 | 마지막 1개는 삭제 불가 |
  | 선택지 추가 | 문항당 12개까지 |
  | 선택지 삭제 | 2개 미만으로는 못 줄임 |
  | 타입 변경 | 선택형↔척도 전환 시 `options`/`scaleMin`/`scaleMax` 자동 정합 (기본 선택지 3개, 척도 1~5) |
  | 문항 제목 | 최대 200자, 개행 금지(공백 치환) |
  | 섹션 | `required`는 항상 false |
- **AI 재수정 [고정]**: 지시문 2자 이상 → `POST /api/survey-revise` → 제목·설명·문항 전체 교체 + 결과 메시지 표시
- **보조 동작 3종 [고정]** (순수 함수로 이미 분리됨)
  - 문장 줄이기 — `shortenSurveyQuestionTitle()`
  - 중복 선택지 정리 — `deduplicateSurveyOptions()`
  - "잘 모르겠음" 선택지 추가
  - 변화가 없으면 "이미 ~예요" 안내 후 무동작 **[UX 결정]**
- **구조 점검 점수 [UX 결정]** — 3개 체크의 통과 비율(%):
  1. 문항 3개 이상 2. 모든 제목 5자 이상 3. 모든 선택형 문항의 선택지 2개 이상
  → **기준과 표시 방식 모두 임의 결정. 재설계 시 자유.**
- **[UX 결정]** 편집/미리보기 2탭 구성, 좌측 문항 목록 + 우측 상세 편집 구조

### 4-10. 배포 (`publish` 모달 → `published`)
- **[고정]** 배포는 **로그인 필수**. 미로그인 시 로그인 모달 → 성공하면 배포 모달 자동 재개.
- **입력 [고정]**: 게시자 표시명(최대 50자, 비우면 계정 이름), 게시판 등록 여부, 카테고리, Instagram 공유 여부
- **[고정]** `POST /api/surveys` 성공 시:
  1. `publishedSlug` + `manageToken` 확보
  2. `localStorage`에 관리 핸들 저장
  3. 게시 승인(`isListed`)이면 공개 목록에 즉시 반영
  4. 내 설문 목록 갱신
- **[고정]** 응답 대상 라벨은 `surveyAudienceLabel(targetGrade)`로 생성 (예: "연세대학교 3학년 또는 4학년 재학생")
- **Instagram 공유 [고정]** — 실패해도 배포는 성공 처리. 상태 문구를 사용자에게 전달.
  - `navigator.share`로 파일 공유 가능 → 4:5 카드 + 캡션 클립보드 복사
  - 불가 → 파일 다운로드 + 캡션 복사
  - 사용자 취소(`AbortError`) → "배포는 완료" 안내
- **[UX 결정]** 주 버튼이 "배포하고 Instagram 앱 열기", 보조가 "링크로만 배포". 이 우선순위는 판단이며 뒤집어도 무방.

### 4-11. 응답 (`survey`)
가장 중요한 화면입니다. **응답자는 로그인 없이 참여합니다. [고정]**

- **진행률 [고정]**: `section` 타입을 제외한 문항 중 응답 완료 비율
- **응답 완료 판정 [고정]**: `undefined` 아님 && `""` 아님 && (배열이면 길이 > 0)
- **제출 검증 [고정]**: `required && type !== "section"` 인 첫 미응답 문항을 찾아 오류 메시지 + 해당 문항으로 스크롤
- **[고정]** 제출 시 `completionSeconds`(화면 진입 시점부터의 초)를 함께 전송 → 서버가 [response-quality.ts](../app/response-quality.ts)로 품질 판정(`usable`/`review`/`exclude`)
- **[고정]** 답변은 문항 전체에 대해 전송하며, 미응답은 `""`
- **입력 제약 [고정]**: 장문 4,000자 / 단답 500자
- **보상 [고정]** — 서버 계산([rewards.ts](../app/rewards.ts))
  | 조건 | 결과 |
  |---|---|
  | 소요 3분 이하 / 6분 이하 / 초과 | 30C / 50C / 70C |
  | 내 설문에 내가 응답 | 0C |
  | 미로그인 응답 | 적립 없음 + "다음부터 로그인하고 받기" 안내 |
- **[UX 결정]** 제출 완료 화면을 별도 상태로 분기(같은 컴포넌트 내 조기 반환). 문구·보상 표시 형태 전부 재설계 자유.

### 4-12. 결과 분석 (`analytics`)
- **접근 [고정]**: `slug` + `manageToken` 조합. 헤더 `x-baroform-manage-token`으로 인증. 계정 로그인과 별개.
- **[고정]** 품질 `exclude` 응답은 집계에서 제외
- **집계 [고정]** — 순수 함수로 이미 분리됨: `buildQuestionResults()`, `summarizeResponseQuality()` ([results-dashboard.tsx](../app/results-dashboard.tsx))
  - 척도 → 평균, 선택형 → 최다 선택지+비율, 주관식 → 응답 수
- **[고정]** 내보내기 3종: Excel / Word / CSV ([survey-export.ts](../app/survey-export.ts))
- **[UX 결정]** 저표본 경고 기준 = 5건 (`LOW_SAMPLE_THRESHOLD`)
- **[UX 결정]** 결과 공유 카드에 "응답 없음이 아닌 첫 번째 문항"을 대표로 노출

---

## 5. 핵심 플로우: AI 설문 생성

가장 복잡하고, UI가 절대 망가뜨려선 안 되는 부분입니다. **전부 [고정]**

```
사용자 입력
  │
  ├─ 검증: (프롬프트 2자+ 또는 첨부 1개+) / 300자 이하
  │   실패 → 안내 + 입력창 포커스, 중단
  │
  ├─ 중복 실행 차단 (in-flight 플래그)
  ├─ 요청 ID 발급, AbortController 생성
  │
  └─ POST /api/survey-draft
      │
      ├─ ready ────────→ 초안 적용 → 편집 화면
      │                   (제목·설명·문항 교체, 문항 수 동기화,
      │                    생성 소요시간을 localStorage에 기록)
      │
      ├─ clarification ─→ 되묻기 모달
      │                   선택 또는 직접 입력(180자) → 프롬프트에
      │                   " — 추가 설명: {답}" 붙여 재요청
      │                   닫기 → 원래 입력창으로 복귀
      │
      ├─ background ───→ 2초 간격 폴링 (GET, responseId+jobToken)
      │                   queued/in_progress 동안 반복
      │                   → ready 또는 error로 수렴
      │
      └─ error ────────→ 단계별 오류 메시지
                          (initial-request / background-poll / response-apply)
```

**취소 [고정]**: 진행 중 취소 시 요청 무효화 + `abort()` + 백그라운드 작업이면 `DELETE`(keepalive)로 서버 작업까지 정리.

**[UX 결정]** 생성 중 전체 화면 오버레이 + 단계별 로딩 문구 4종(`surveyModeLoadingMessages`) + 과거 소요시간 기반 예상 시간 표시. 표현 방식은 자유이나, **취소 수단은 반드시 제공해야 합니다** (서버 작업 정리 때문).

---

## 6. 도메인 상수 (전부 [고정])

| 항목 | 값 | 출처 |
|---|---|---|
| 학교 | 연세대학교 신촌캠퍼스 1곳 | `survey-board.ts` |
| 설문 카테고리 | 수업·과제 / 동아리·학생단체 / 학회·연구 / 교내생활 / 진로·취업 / 기타 | `survey-board.ts` |
| 응답 대상 | 7종 | `survey-grade.ts` |
| 문항 타입 | 9종 | `survey-intent.ts` |
| 설문 방식 | standard / research | `survey-mode.ts` |
| 기본 보상 | 30C (소요시간별 30/50/70) | `rewards.ts` |
| 문항 수 | 1~30 | `page.tsx` |
| 선택지 수 | 2~12 | `page.tsx` |
| 프롬프트 | 300자 | `page.tsx` |
| 예상 소요시간 산식 | 기본 20초 + 장문 55 / 단답 28 / 복수선택 30 / 그 외 20초 | `ux/survey-editing.ts` |
| 참고 이미지 / 링크 | 10개 / 3개, 이미지 dataURL 총 300,000자 | `ux/reference-limits.ts` |
| 투표 질문 / 선택지 | 5~120자 / 2~4개, 각 40자 | `ux/data/pulses.ts` |
| 투표 기간 | 6시간 / 24시간 / 3일 / 7일 | `ux/data/pulses.ts` |
| 외부 설문 등록 | 제목 2~100자, 예상시간 1~60분, 목표 5~5,000명 | `ui/views/home.tsx` |
| 협업 리뷰 토큰 | 32자 hex | `ux/navigation.ts` |

---

## 7. 재설계 자유 목록 (편향 제거 체크리스트)

**아래 항목은 전부 첫 설계자의 판단입니다. 하나씩 "승계 / 폐기 / 재설계"를 결정하세요.**

- [ ] 랜딩을 기본 진입점으로 둘 것인가 (`?app=1` 없으면 랜딩)
- [ ] 랜딩에서 실 데이터 없을 때 샘플 6건을 보여줄 것인가
- [ ] 홈에 5개 섹션을 모두 올릴 것인가
- [ ] 생성 → 편집 → 배포 → 결과의 4단 직선 흐름을 유지할 것인가
- [ ] 생성 설정(대상 학년·문항 수·설문 방식)을 생성 **전에** 받을 것인가, 편집 중에 받을 것인가
- [ ] 편집 화면의 편집/미리보기 2탭 구성
- [ ] 편집 화면의 "구조 점검 점수" 3개 기준과 % 표시
- [ ] 배포 시 Instagram 공유를 주 동작으로 둘 것인가
- [ ] 발행 완료를 전용 화면(`published`)으로 둘 것인가, 결과 화면에 통합할 것인가
- [ ] 응답 완료를 전용 화면으로 둘 것인가
- [ ] 보상(캐시) 정보를 응답 화면에서 얼마나 강조할 것인가 — 현재 헤더·배너·완료화면 3곳
- [ ] 저표본 경고 기준 5건
- [ ] 토스트 지속시간 (현재 1800~5200ms 산발)
- [ ] 삭제 확인에 브라우저 `confirm` 사용
- [ ] 화면 이동 시 항상 최상단 스크롤
- [ ] 13개 화면을 단일 `view` 상태로 관리 (vs. 실제 라우트 분리)
- [ ] 사이드바를 6개 화면에서만 노출하는 규칙
- [ ] 모든 안내 문구의 어투 ("~해요" 체) 및 이모지·아이콘 사용

## 8. 절대 깨뜨리면 안 되는 것 (요약)

UI를 어떻게 바꾸든 아래가 유지되는지만 확인하세요.

1. **설문 초안이 생성→편집→배포 구간에서 끊기지 않는다**
2. **미로그인 발행 후 로그인 시 소유권 승계(`/api/surveys/claim`)가 동작한다**
3. **생성 요청에 취소 수단이 있고, 취소 시 서버 작업까지 정리된다**
4. **응답은 로그인 없이 완주 가능하다**
5. **필수 문항 미응답 시 제출이 막히고 해당 문항을 찾아준다**
6. **제출 시 `completionSeconds`가 함께 전송된다** (품질 판정 입력값)
7. **결과 화면은 `manageToken`으로 접근한다** (계정 로그인과 별개)
8. **401 응답 시 세션이 초기화된다**
9. **문항 수 1~30, 선택지 2~12 경계가 지켜진다**

---

## 9. 이 문서와 코드의 대응

각 항목이 실제로 어디에 구현돼 있는지. **UI를 다시 그릴 때 이 파일들은 건드리지 않습니다.**

| 문서 절 | 코드 |
|---|---|
| 2-1 세션 | [ux/state/use-session.ts](../app/ux/state/use-session.ts), [ux/data/auth.ts](../app/ux/data/auth.ts) |
| 2-2 설문 초안 | [ux/state/use-survey-draft.ts](../app/ux/state/use-survey-draft.ts) |
| 2-3 발행 핸들 | [ux/data/managed-survey.ts](../app/ux/data/managed-survey.ts), [ux/state/use-publish.ts](../app/ux/state/use-publish.ts) |
| 2-3 소유권 승계 | [ux/state/use-survey-claim.ts](../app/ux/state/use-survey-claim.ts) |
| 2-4 목록 캐시 | [ux/state/use-survey-catalog.ts](../app/ux/state/use-survey-catalog.ts) |
| 2-5 토스트 | [ux/state/use-toast.ts](../app/ux/state/use-toast.ts) |
| 3 진입·라우팅 | [ux/navigation.ts](../app/ux/navigation.ts), [ux/state/use-navigation.ts](../app/ux/state/use-navigation.ts) |
| 4-9 편집 규칙 | [ux/survey-editing.ts](../app/ux/survey-editing.ts) |
| 4-11 응답 규칙 | [ux/survey-response.ts](../app/ux/survey-response.ts), [ux/state/use-survey-response.ts](../app/ux/state/use-survey-response.ts) |
| 5 생성 플로우 | [ux/state/use-survey-generation.ts](../app/ux/state/use-survey-generation.ts), [ux/data/survey-draft.ts](../app/ux/data/survey-draft.ts) |
| 모든 API 호출 | [ux/data/](../app/ux/data) — UI에는 `fetch(` 가 남아 있지 않습니다 (참고파일 멀티파트 업로드 제외) |

### 테스트로 고정된 규칙

| 테스트 | 지키는 것 |
|---|---|
| [ux-survey-editing.test.ts](../tests/ux-survey-editing.test.ts) | 문항 30개·선택지 2~12개 경계, 타입 전환 정합, 구조 점검 |
| [ux-survey-response.test.ts](../tests/ux-survey-response.test.ts) | 응답 완료 판정, 진행률, 필수 문항 차단, 전송 payload |
| [ux-navigation.test.ts](../tests/ux-navigation.test.ts) | 진입 URL 해석, 토큰 형식 검증 |

이 세 파일은 UI를 전부 교체해도 그대로 통과해야 합니다. **통과하지 않으면 UX가 바뀐 것입니다.**
