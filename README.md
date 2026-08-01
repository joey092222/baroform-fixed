# 바로폼 — Vercel 배포판

대학생이 설문 주제를 한 문장으로 입력하면 필요한 공개 자료만 빠르게 확인하고, AI가 맞춤 문항 7개를 바로 설계하는 Next.js 앱입니다.

이 저장소는 Vercel에서 바로 빌드되도록 변환되어 있습니다. OpenAI API 키는 브라우저 번들에 들어가지 않으며 `app/api/survey-draft/route.ts` 서버 라우트에서만 읽습니다.

## 들어 있는 기능

- 고유명사·실제 맥락 확인이 필요할 때만 사용하는 OpenAI 웹 검색과 출처 표시
- 응답 대상·평가 대상·조사 목적 분리
- 템플릿 선택 없이 AI 맞춤 문항 7개를 편집기로 바로 전달
- 가입 학교별 회원 분류와 학교별 설문 게시판
- 수업·과제, 동아리·학생단체, 학회·연구, 교내생활, 진로·취업 카테고리
- 설문 편집·공개 링크 생성
- 로그인 없는 익명 응답
- 실제 응답 결과 분석
- Vercel 서버리스에 맞는 Neon Postgres 저장
- 서버 측 요청 제한과 결과 캐시

## 1. GitHub에 올리기

1. 받은 ZIP의 압축을 풉니다.
2. GitHub에서 새 저장소를 만듭니다. 초기에는 `Private`을 권장합니다.
3. ZIP 자체가 아니라, 압축을 푼 폴더 안의 파일과 폴더 전체를 저장소에 업로드합니다.
4. 업로드 목록에 최소한 `app`, `db`, `public`, `package.json`, `tsconfig.json`이 모두 보이는지 확인합니다. 특히 `db` 폴더가 빠지면 API 빌드가 실패합니다.
5. `Commit changes`를 누릅니다.

API 키나 `.env.local` 파일은 GitHub에 올리지 마세요.

## 2. Vercel에 배포하기

1. Vercel에서 `Add New` → `Project`를 누릅니다.
2. 방금 만든 GitHub 저장소를 `Import`합니다.
3. Framework Preset이 `Next.js`인지 확인합니다.
4. 먼저 아래 환경 변수를 등록한 뒤 `Deploy`를 누릅니다.

### 필수 환경 변수

| 이름 | 값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | OpenAI Platform에서 만든 서버용 비밀키 |

### 선택 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_SURVEY_MODEL` | `gpt-5.6-terra` | 속도와 정확도를 균형 있게 맞춘 설문 조사·생성 모델 |
| `BAROFORM_AI_MAX_PER_HOUR` | `8` | 한 사용자 기준 시간당 신규 AI 생성 상한 |

환경 변수는 Vercel 프로젝트의 `Settings` → `Environment Variables`에서 등록합니다. `OPENAI_API_KEY` 앞에 `NEXT_PUBLIC_`을 붙이면 브라우저에 노출될 수 있으므로 절대 붙이지 마세요.

## 3. 설문 저장 기능 연결하기

AI 초안만 만들 때는 OpenAI 키만 있어도 됩니다. 공개 링크, 응답 저장, 결과 분석까지 사용하려면 Postgres 데이터베이스가 필요합니다.

가장 간단한 방법은 Vercel 프로젝트의 `Storage` 또는 `Marketplace`에서 `Neon`을 선택해 같은 프로젝트에 연결하는 것입니다. 연결이 끝나면 보통 `DATABASE_URL`이 자동 등록됩니다.

직접 Neon을 연결했다면 Vercel 환경 변수에 아래 값을 추가합니다.

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | Neon에서 발급된 Postgres 연결 문자열 |

첫 데이터베이스 요청 때 필요한 표와 인덱스를 안전하게 자동 생성합니다. 동일한 SQL은 `db/schema.sql`에도 들어 있습니다.

환경 변수를 배포 후 추가했다면 `Deployments`에서 최신 배포를 `Redeploy`해야 합니다.

## 로컬에서 실행하기

Node.js 22 이상을 권장합니다.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

그다음 `.env.local`에 실제 키와 데이터베이스 URL을 입력합니다. 이 파일은 Git에서 제외됩니다.

검증 명령:

```bash
npm test
npm run build
```

## 서버 구조

- `POST /api/survey-draft`: OpenAI Responses API와 `web_search`를 사용해 정보조사 및 설문 생성
- `GET/POST /api/surveys`: 공개 설문 목록 및 설문 발행
- `GET /api/surveys/[slug]`: 공유 링크의 설문 조회
- `POST /api/surveys/[slug]/responses`: 익명 응답 저장
- `GET /api/surveys/[slug]/responses`: 관리 토큰으로 결과 조회

브라우저는 OpenAI에 직접 요청하지 않습니다. 브라우저 개발자 도구나 빌드 결과에도 `OPENAI_API_KEY`가 포함되지 않습니다.

## 데이터 이전 주의

이 ZIP에는 기존 `chatgpt.site`의 Cloudflare D1 데이터가 포함되지 않습니다. 이미 공개한 설문의 기존 링크·응답·관리 토큰까지 Vercel로 옮기려면 기존 D1의 `surveys`, `responses` 데이터를 별도로 내보내 Neon에 가져와야 합니다. 소스와 기능은 모두 포함되어 있지만 운영 데이터는 배포 플랫폼이 별도로 보관하기 때문입니다.
