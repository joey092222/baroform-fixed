import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import { parseSurveyIntent } from "../app/survey-semantic-intent";

// 사용자 제보 1: "설문 내용을 안전하게 다듬지 못했어요" 토스트로 생성이 막혔다.
// 생성기는 "지각 빈도"를 "수업이나 약속에 늦은 빈도"로 표현하는데
// questionCoversVariable에는 "지각 횟수"만 등록되어 있었고, validateSurvey가
// measuredVariable 메타데이터를 넘기지 않아 제목 문자열 매칭만 남았다.
// 결과적으로 정상 문항이 미측정으로 오판되어 422로 폐기됐다.
const relationalPrompts = [
  "대학생들의 수면 시간과 그들의 지각 빈도 간 관계 조사",
  "대학생들의 수면 시간과 그에 따른 지각 빈도 조사",
];

for (const prompt of relationalPrompts) {
  test(`관계형 프롬프트는 검증을 통과한다: ${prompt}`, () => {
    const brief = parseSurveyBrief(prompt);
    const blueprint = analyzeSurveyPrompt(prompt);

    assert.deepEqual(validateSurvey(prompt, brief, blueprint), []);
    assert.equal(blueprint.aiQuestions.length, 7);
  });
}

test("지각 빈도는 응답자 수준 변수로 추출되고 대명사가 섞이지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const research = parseSurveyIntent(prompt).researchIntent;
  const names = research.variables
    .filter((item) => item.scope === "respondent_level")
    .map((item) => item.name);

  assert.deepEqual(names, ["수면 시간", "지각 빈도"]);
  for (const name of names) {
    assert.doesNotMatch(name, /그들의|이들의|해당\s/);
  }
});

test("관계형 설문 제목과 문항에 대명사가 노출되지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = [
    blueprint.title,
    blueprint.description,
    ...blueprint.aiQuestions.map((item) => item.title),
  ].join(" ");

  assert.equal(blueprint.title, "대학생의 수면 시간과 지각 빈도 조사");
  assert.doesNotMatch(corpus, /그들의|이들의/);
});

test("사용자가 기간을 적지 않으면 문항이 기간을 지어내지 않는다", () => {
  const prompt = relationalPrompts[0]!;
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  // INVENTED_TIMEFRAME 규칙과 같은 패턴. 생성기가 스스로 위반하면 안 된다.
  assert.doesNotMatch(
    corpus,
    /(?:최근|지난)\s*(?:\d+\s*(?:일|주|개월|달|년)|한\s*(?:주|달|해)|일주일)|(?:이번|지난)\s*(?:학기|학년도)/,
  );
});

test("사용자가 기간을 적으면 그 기간을 문항에 사용한다", () => {
  const prompt = "대학생들의 이번 학기 수면 시간과 그에 따른 지각 빈도 조사";
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.match(corpus, /이번 학기/);
});

// 사용자 제보 2: 문항 5가 "sns 이용 시간을 주로 어떤 목적으로 쓰나요?"로 나왔다.
// focus("SNS 이용")가 이미 행위 명사로 끝나는데 템플릿이 "시간"을 다시 붙여,
// 목적을 묻는 대상이 행위가 아니라 시간이 됐다.
test("시간 측정 설문의 목적 문항은 시간이 아니라 행위를 묻는다", () => {
  const blueprint = analyzeSurveyPrompt("대학생들의 SNS 이용 시간 조사");
  const purpose = blueprint.aiQuestions.find((item) =>
    /어떤 목적으로/.test(item.title),
  );

  assert.equal(purpose?.title, "SNS를 주로 어떤 목적으로 이용하나요?");
  assert.doesNotMatch(
    blueprint.aiQuestions.map((item) => item.title).join(" "),
    /시간을 주로 어떤 목적으로 쓰나요/,
  );
});

test("두문자어는 사용자가 소문자로 입력해도 대문자로 표기된다", () => {
  const blueprint = analyzeSurveyPrompt("대학생들의 sns 이용 시간 조사");
  const corpus = [
    blueprint.title,
    ...blueprint.aiQuestions.map((item) => item.title),
  ].join(" ");

  assert.match(blueprint.title, /SNS/);
  assert.doesNotMatch(corpus, /\bsns\b/);
});

test("행위 대상이 없는 시간 측정은 목적 문항 대신 맥락 문항을 쓴다", () => {
  // "통학 시간" → focus "통학". "통학을 어떤 목적으로 통학하나요?"가 되면 안 된다.
  const blueprint = analyzeSurveyPrompt("직장인의 통학 시간 조사");
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.doesNotMatch(corpus, /통학하나요\?/);
});

// 사용자 제보 3: "지각 여부에 대한에 해당하나요?" / "지각 여부에 대한을(를) ...".
// cleanVariableLabel이 규칙을 한 번만 훑어서, "관계"를 뗀 뒤 드러난 "에 대한"을
// 지울 기회가 없었다. 그리고 generic 템플릿은 조사를 하드코딩하고 있었다.
const danglingSuffixPrompt =
  "대학생들의 통학 시간과 그에 따른 지각 비율에 대한 관계 조사";

test("변수명에서 관형사형 꼬리가 남지 않는다", () => {
  const research = parseSurveyIntent(danglingSuffixPrompt).researchIntent;
  const names = research.variables.map((item) => item.name);

  assert.deepEqual(names, ["통학 시간", "지각 여부", "지각 비율"]);
  for (const name of names) {
    assert.doesNotMatch(name, /에\s*대한$|에\s*관한$|에\s*대해$|관련$/);
  }
});

test("변수명 정리는 여러 겹으로 쌓인 꼬리도 벗겨낸다", () => {
  // 한 번만 훑으면 "관계"를 뗀 뒤 드러나는 "에 대한"을 놓친다. fixpoint 확인.
  for (const prompt of [
    "대학생들의 통학 시간과 그에 따른 지각 비율에 대한 관계 조사",
    "대학생들의 통학 시간과 그에 따른 지각 비율에 관한 영향 조사",
  ]) {
    const names = parseSurveyIntent(prompt).researchIntent.variables.map(
      (item) => item.name,
    );
    for (const name of names) {
      assert.doesNotMatch(name, /에\s*(?:대한|관한|대해|관해)/);
    }
  }
});

test("제목과 안내문에 꼬리와 잘못된 조사가 섞이지 않는다", () => {
  const blueprint = analyzeSurveyPrompt(danglingSuffixPrompt);

  assert.equal(blueprint.title, "대학생의 통학 시간과 지각 여부 조사");
  assert.match(blueprint.description, /지각 여부를 파악하고/);
  assert.doesNotMatch(blueprint.description, /에 대한|여부를를|여부을/);
});

test("generic 문항 템플릿이 조사 플레이스홀더를 노출하지 않는다", () => {
  const prompts = [
    danglingSuffixPrompt,
    "대학생들의 공부 시간에 따라 달라지는 만족도 조사",
    "직장인의 근무 시간과 그에 따른 이직 의향 조사",
  ];
  for (const prompt of prompts) {
    const blueprint = analyzeSurveyPrompt(prompt);
    const corpus = blueprint.aiQuestions
      .flatMap((item) => [item.title, item.reason])
      .join(" ");

    // "을(를)", "이(가)", "은(는)"이 사용자 화면에 그대로 나가면 안 된다.
    assert.doesNotMatch(corpus, /을\(를\)|이\(가\)|은\(는\)/, prompt);
  }
});

test("이분형 generic 문항이 문장으로 성립한다", () => {
  const blueprint = analyzeSurveyPrompt(danglingSuffixPrompt);
  const binary = blueprint.aiQuestions.find((item) =>
    item.options?.includes("아니요"),
  );

  assert.equal(binary?.title, "지각 여부를 알려주세요.");
  assert.doesNotMatch(binary?.title ?? "", /여부에 해당하나요/);
});

test("관계형 generic 문항은 응답자에게 내부 개념을 노출하지 않는다", () => {
  const blueprint = analyzeSurveyPrompt(danglingSuffixPrompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.doesNotMatch(corpus, /앞에서 답한 (?:첫 번째 값|값들)/);
  assert.match(corpus, /평소 통학 시간이 달라지는 주된 상황/);
  assert.match(corpus, /평소 지각 여부가 달라지는 빈도/);
});

// 이중질문 규칙은 지금까지 발동을 검증하는 테스트가 하나도 없었다. 규칙을
// 느슨하게 만드는 변경이 진짜 이중질문을 놓쳐도 아무도 못 잡는 상태였다.
// 양방향으로 고정한다.
const doubleBarreledIssue = /서로 다른 두 개 이상의 개념/;

function issuesForTitle(title: string) {
  const prompt = "대학생들의 학식 만족도 조사";
  const brief = parseSurveyBrief(prompt);
  const blueprint = analyzeSurveyPrompt(prompt);
  return validateSurvey(prompt, brief, {
    ...blueprint,
    aiQuestions: [{ ...blueprint.aiQuestions[0]!, id: 1, title }],
  });
}

test("이중질문 규칙은 실제로 두 개념을 나열한 문항을 잡는다", () => {
  const doubleBarreled = [
    "만족도와 불편한 점을 함께 알려주세요.",
    "서비스 평가와 개선 의향을 알려주세요.",
    "이용 빈도와 만족도는 어느 정도인가요?",
    "불편한 점과 만족스러운 점을 모두 골라주세요.",
    "소요 시간 및 만족도를 평가해주세요.",
    "대기 시간과 불편함은 어느 정도였나요?",
  ];
  for (const title of doubleBarreled) {
    assert.ok(
      issuesForTitle(title).some((item) => doubleBarreledIssue.test(item)),
      `잡아야 하는데 놓침: ${title}`,
    );
  }
});

test("이중질문 규칙은 비교조사와 단어 내부의 과/와를 접속조사로 오인하지 않는다", () => {
  const singleConcept = [
    // 비교조사 "와/과"
    "만족도가 평소와 달라지는 빈도는 어느 정도인가요?",
    "작년과 비교해 만족도는 어떻게 달라졌나요? 이용 시간 기준으로요.",
    "이전과 달라진 이용 빈도에 만족하나요?",
    "기존과 비교했을 때 대기 시간 만족도는 어떤가요?",
    // 단어 일부인 "과"
    "만족도는 과제 수행 시간에 어떤 영향을 주나요?",
    "평가 과정에서 느낀 불편한 점을 적어주세요.",
    // 단일 개념
    "평소 이용 빈도는 어느 정도인가요?",
    "전반적인 만족도를 알려주세요.",
  ];
  for (const title of singleConcept) {
    assert.deepEqual(
      issuesForTitle(title).filter((item) => doubleBarreledIssue.test(item)),
      [],
      `오탐: ${title}`,
    );
  }
});

test("관계형 generic 문항은 자체 품질 검증을 통과한다", () => {
  for (const prompt of [
    danglingSuffixPrompt,
    "대학생들의 공부 시간에 따라 달라지는 만족도 조사",
    "네이버 웹툰 이용 빈도에 따른 만족도 차이",
  ]) {
    assert.deepEqual(
      validateSurvey(prompt, parseSurveyBrief(prompt), analyzeSurveyPrompt(prompt)),
      [],
      prompt,
    );
  }
});
