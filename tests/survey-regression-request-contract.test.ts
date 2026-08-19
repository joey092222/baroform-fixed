import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";

type SurveyRouteBody = {
  type?: string;
  status?: string;
  code?: string | null;
  blueprint?: {
    respondentGroup?: string | null;
    evaluationTarget?: string | null;
    aiQuestions?: Array<{ title?: string }>;
  };
};

async function createLocalDraft(prompt: string, suffix: string) {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": `baroform-request-contract-${suffix}`,
        },
        body: JSON.stringify({
          prompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    return { response, body: (await response.json()) as SurveyRouteBody };
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

function questionText(body: SurveyRouteBody) {
  return (body.blueprint?.aiQuestions ?? [])
    .map((question) => question.title ?? "")
    .join(" ");
}

function assertReadySurvey(response: Response, body: SurveyRouteBody) {
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.type, "survey");
  assert.match(body.status ?? "", /^ready/);
  assert.equal(body.blueprint?.aiQuestions?.length, 7);
}

test("관계형 기간·빈도 요청은 검증 가능한 7문항 설문으로 끝난다", async () => {
  const { response, body } = await createLocalDraft(
    "직장인의 평일 수면 시간과 지각 빈도의 상관관계",
    "sleep-lateness",
  );
  assertReadySurvey(response, body);
  assert.match(questionText(body), /수면/);
  assert.match(questionText(body), /지각/);
});

test("서비스 비이용자 요청은 비이용 이유와 필요한 기능을 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "별마루 서비스를 안 쓰는 직장인 대상으로 서비스가 어려운 이유랑 필요한 기능",
    "non-user-needs",
  );
  assertReadySurvey(response, body);
  assert.match(body.blueprint?.respondentGroup ?? "", /안 쓰는 직장인|이용하지 않는 직장인/);
  assert.match(questionText(body), /이유|어려움/);
  assert.match(questionText(body), /기능|지원/);
});

test("두 플랫폼 비교 요청은 양쪽 대상과 빈도·만족도를 모두 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "대학생이 네이버 웹툰과 카카오페이지를 이용하는 빈도와 만족도를 비교",
    "platform-comparison",
  );
  assertReadySurvey(response, body);
  const text = `${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`;
  assert.match(text, /네이버 웹툰/);
  assert.match(text, /카카오페이지/);
  assert.match(questionText(body), /빈도|자주/);
  assert.match(questionText(body), /만족/);
});

test("가상 서비스 비이용자 요청도 이름과 부정 조건을 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "해솔 서비스를 이용하지 않는 청년의 비이용 이유와 필요한 지원",
    "virtual-non-user",
  );
  assertReadySurvey(response, body);
  assert.match(`${body.blueprint?.respondentGroup ?? ""} ${questionText(body)}`, /해솔/);
  assert.match(body.blueprint?.respondentGroup ?? "", /이용하지 않는 청년/);
  assert.match(questionText(body), /이유|어려움/);
  assert.match(questionText(body), /지원/);
});

test("가상 서비스 비교 요청도 전체 의뢰문을 단일 대상으로 사용하지 않는다", async () => {
  const { response, body } = await createLocalDraft(
    "푸른결 플랫폼과 별빛 서비스 이용자의 고객 지원 만족도 비교",
    "virtual-comparison",
  );
  assertReadySurvey(response, body);
  const text = `${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`;
  assert.match(text, /푸른결/);
  assert.match(text, /별빛/);
  assert.doesNotMatch(
    body.blueprint?.evaluationTarget ?? "",
    /이용자의 고객 지원 만족도 비교/,
  );
});

test("명확한 단일 서비스 이용 요청은 기존 정상 경로를 유지한다", async () => {
  const { response, body } = await createLocalDraft(
    "대학생의 네이버 웹툰 이용 경험과 이용 빈도 조사",
    "service-control",
  );
  assertReadySurvey(response, body);
  assert.match(questionText(body), /이용한 적|사용한 적|이용 경험/);
  assert.match(questionText(body), /빈도|자주/);
});

test("명확한 행사 만족도 요청은 기존 정상 경로를 유지한다", async () => {
  const { response, body } = await createLocalDraft(
    "새봄대학교 축제 참가자의 프로그램 만족도와 재참여 의향",
    "event-control",
  );
  assertReadySurvey(response, body);
  assert.match(questionText(body), /만족/);
  assert.match(questionText(body), /재참여|다시 참여|참여할 의향/);
});

test("조사 대상이 불명확한 짧은 입력은 내부 오류 대신 clarification으로 끝난다", async () => {
  const { response, body } = await createLocalDraft("앱 조사", "clarification-control");
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.type, "clarification");
  assert.equal(body.status, "needs_clarification");
});

test("구체 서비스 비이용자 요청은 대상과 장벽을 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "모바일 뱅킹을 사용하지 않는 고령층의 디지털 장벽",
    "banking-non-user",
  );
  assertReadySurvey(response, body);
  assert.match(body.blueprint?.respondentGroup ?? "", /사용하지 않는 고령층|이용하지 않는 고령층/);
  assert.match(`${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`, /모바일 뱅킹/);
  assert.match(questionText(body), /장벽|어려움|이유/);
});

test("운영체제별 서비스 비교도 두 대상을 분리한다", async () => {
  const { response, body } = await createLocalDraft(
    "iOS용 공부 앱과 안드로이드용 공부 앱의 사용성 및 지속 사용 의향 비교",
    "os-app-comparison",
  );
  assertReadySurvey(response, body);
  const text = `${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`;
  assert.match(text, /iOS/);
  assert.match(text, /안드로이드/);
  assert.match(questionText(body), /사용성|사용하기/);
  assert.match(questionText(body), /지속|계속/);
});

test("팀워크 복합 구성개념은 공정성과 의사소통 만족도를 모두 묻는다", async () => {
  const { response, body } = await createLocalDraft(
    "대학생 팀플에서 역할 분담 공정성과 의사소통 만족도",
    "teamwork-constructs",
  );
  assertReadySurvey(response, body);
  assert.match(questionText(body), /공정/);
  assert.match(questionText(body), /의사소통/);
  assert.match(questionText(body), /만족/);
});

test("구독 서비스 비교는 두 서비스와 빈도·만족도를 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "넷플릭스와 티빙 구독자의 이용 빈도·콘텐츠 만족도 비교",
    "subscription-comparison",
  );
  assertReadySurvey(response, body);
  const text = `${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`;
  assert.match(text, /넷플릭스/);
  assert.match(text, /티빙/);
  assert.match(questionText(body), /빈도|자주/);
  assert.match(questionText(body), /콘텐츠|만족/);
});

test("서로 다른 여가 활동 비교도 시간 사용과 만족도를 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "독서와 팟캐스트 청취를 여가로 즐기는 사람들의 시간 사용과 만족도 비교",
    "leisure-comparison",
  );
  assertReadySurvey(response, body);
  const text = `${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`;
  assert.match(text, /독서/);
  assert.match(text, /팟캐스트/);
  assert.match(questionText(body), /시간/);
  assert.match(questionText(body), /만족/);
});

test("이동 요청은 시설 이용 설문으로 평탄화하지 않는다", async () => {
  const { response, body } = await createLocalDraft(
    "대우관 오갈 때 학생들 이동수단이랑 얼마나 걸리는지, 뭐가 불편한지",
    "mobility-details",
  );
  assertReadySurvey(response, body);
  assert.match(questionText(body), /이동수단|이동 수단/);
  assert.match(questionText(body), /소요|걸리/);
  assert.match(questionText(body), /불편/);
  assert.doesNotMatch(questionText(body), /대우관 오갈 때 학생들 이동수단이랑 얼마나 걸리는지.*이용한 적/);
});

test("장소 비방문자 요청은 부정 조건과 비방문 이유를 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "대우관에 가지 않는 연세대 학생이 방문하지 않는 이유",
    "place-non-visitor",
  );
  assertReadySurvey(response, body);
  assert.match(
    body.blueprint?.respondentGroup ?? "",
    /대우관에 가지 않는 연세대(?:학교)? (?:재)?학생|대우관을 방문하지 않는 연세대(?:학교)? (?:재)?학생/,
  );
  assert.match(questionText(body), /방문하지 않는 이유|가지 않는 이유|이유/);
});

test("서비스 이용자 요청은 이름·대상·이용 현황을 보존한다", async () => {
  const { response, body } = await createLocalDraft(
    "다온 플랫폼을 쓰는 취업준비생의 이용 현황과 경험",
    "service-user-audience",
  );
  assertReadySurvey(response, body);
  assert.match(`${body.blueprint?.evaluationTarget ?? ""} ${questionText(body)}`, /다온/);
  assert.match(body.blueprint?.respondentGroup ?? "", /취업준비생/);
  assert.match(questionText(body), /이용|사용/);
});
