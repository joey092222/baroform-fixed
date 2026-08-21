import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import { parseSurveyIntent } from "../app/survey-semantic-intent";
import {
  stripResearchAbstract,
  stripSubjectTails,
} from "../app/survey-subject-tails";
import { surveyVariableKind } from "../app/survey-variable-kind";
import { naturalQuestionTitle } from "../app/survey-ai";

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

// 사용자 제보 4: "만족도 조사 결과 개선" 류 프롬프트가 제대로 생성되는지.
// 파보니 "과"로 끝나는 주제어가 전부 막혀 있었다. 검증기가 끝 글자 "과"를
// 잘린 접속조사로 보는데, 학과·성과·효과·결과·치과는 명사 자체가 "과"로
// 끝난다. 접속조사가 없는 정상 요청이 422로 죽었다.
test("주제어가 '과'로 끝나는 정상 프롬프트가 막히지 않는다", () => {
  const prompts = [
    "학과 만족도 조사",
    "교육 효과 만족도 조사",
    "동아리 활동 성과 만족도 조사",
    "치과 진료 만족도 조사",
    "우리 과 만족도 조사",
  ];
  for (const prompt of prompts) {
    const issues = validateSurvey(
      prompt,
      parseSurveyBrief(prompt),
      analyzeSurveyPrompt(prompt),
    );
    assert.deepEqual(
      issues.filter((item) => item.includes("짧은 명사구")),
      [],
      prompt,
    );
  }
});

test("뒤쪽 차원을 뗄 때 이어주던 접속조사도 함께 뗀다", () => {
  // "X와 만족도 조사" → "만족도 조사"만 떼면 "X와"가 남아
  // "동아리 활동 성과와에 얼마나 만족하시나요?"가 나갔다.
  for (const [prompt, expected] of [
    ["동아리 활동 성과와 만족도 조사", "동아리 활동 성과"],
    ["교육 효과와 만족도 조사", "교육 효과"],
  ] as const) {
    const brief = parseSurveyBrief(prompt);
    assert.equal(brief.researchSubject, expected, prompt);
    // surveyObject는 별도 추출 경로다. 여기가 문항 본문에 실린다.
    assert.equal(parseSurveyIntent(prompt).surveyObject, expected, prompt);

    const corpus = analyzeSurveyPrompt(prompt)
      .aiQuestions.map((item) => item.title)
      .join(" ");
    assert.doesNotMatch(corpus, /와에|와가|와이|와을|와를/, prompt);
  }
});

// 조사 요청문에 붙는 메타 표현("조사 결과 개선 방안")이 주제어에 남으면
// 요청문 전체가 조사 대상이 되어 문항이 요청문을 되뇐다.
const metaTailPrompts: Array<[string, string]> = [
  ["학식 만족도 조사 결과 개선 방안", "학식"],
  ["교내 카페 만족도 조사 후 개선 우선순위 파악", "교내 카페"],
  ["기숙사 만족도 조사 및 개선 방향 도출", "기숙사"],
  ["동아리 만족도 조사를 통한 운영 개선", "동아리"],
  ["셔틀버스 만족도 조사 결과 분석", "셔틀버스"],
  ["도서관 만족도 조사 자료 수집", "도서관"],
  ["학식 만족도 실태 파악을 위한 조사", "학식"],
];

test("조사 요청문의 메타 표현이 주제어에 남지 않는다", () => {
  for (const [prompt, expected] of metaTailPrompts) {
    assert.equal(parseSurveyBrief(prompt).researchSubject, expected, prompt);
    // surveyObject는 별도 경로다. 문항 본문에 실리는 것은 이쪽이라
    // 한쪽만 고치면 제목만 깨끗해지고 문항은 그대로 깨진 채 나간다.
    assert.equal(parseSurveyIntent(prompt).surveyObject, expected, prompt);
  }
});

test("메타 표현이 붙은 요청문도 문항이 요청문을 되뇌지 않는다", () => {
  for (const [prompt] of metaTailPrompts) {
    const corpus = analyzeSurveyPrompt(prompt)
      .aiQuestions.map((item) => item.title)
      .join(" ");
    assert.doesNotMatch(
      corpus,
      /조사 결과|개선 방안|개선 우선순위|방향 도출|자료 수집|위한에|를 통한/,
      prompt,
    );
  }
});

test("'조사'가 대상 명사의 일부일 때는 떼지 않는다", () => {
  // "학식 만족도 조사"의 조사는 행위지만 "사용자 조사"의 조사는 대상이다.
  // 맨 끝의 "조사"는 앞이 측정 차원일 때만 뗀다.
  for (const [input, expected] of [
    ["학식 만족도 조사", "학식"],
    ["학식 만족도 조사 결과 개선 방안", "학식"],
    ["사용자 조사", "사용자 조사"],
    ["시장 조사", "시장 조사"],
    ["여론조사 앱 만족도 조사", "여론조사 앱"],
    // 측정 차원이 앞에 오면 "조사"는 행위다. "학식 실태 조사" → "학식"
    ["학식 실태 조사", "학식"],
  ] as const) {
    assert.equal(stripSubjectTails(input), expected, input);
  }
});

// "개선이 필요한 부분"의 "필요"를 수요 신호로 읽어 주제가 통째로 바뀌었다.
// "학식 ... 개선이 필요한 부분" → "현재 생활권에 새로 생기길 원하는 부분을
// 골라주세요". 검증은 통과하므로 눈으로 보기 전까지 드러나지 않았다.
test("개선점 요청이 수요 조사로 잘못 라우팅되지 않는다", () => {
  const cases: Array<[string, RegExp]> = [
    ["학식 만족도 조사 결과 개선이 필요한 부분 조사", /학식/],
    ["도서관에서 개선이 필요한 부분 조사", /도서관/],
    ["교내 시설 중 보완이 필요한 부분", /시설|교내/],
    ["수업에서 부족한 부분 파악", /수업/],
  ];
  for (const [prompt, anchor] of cases) {
    const blueprint = analyzeSurveyPrompt(prompt);
    const corpus = [
      blueprint.title,
      ...blueprint.aiQuestions.flatMap((q) => [q.title, ...(q.options ?? [])]),
    ].join(" ");
    // 요청한 주제가 설문 어디엔가 살아 있어야 한다
    assert.match(corpus, anchor, prompt);
    // 수요 조사 템플릿의 흔적이 없어야 한다
    assert.doesNotMatch(corpus, /현재 생활권에 새로 생기길 원하는/, prompt);
  }
});

test("진짜 수요 조사는 여전히 수요 템플릿으로 간다", () => {
  // "필요"를 무조건 제외하면 이쪽이 깨진다. 양방향으로 고정한다.
  for (const prompt of [
    "교내에 새로 생기길 원하는 시설 수요 조사",
    "학생들이 필요한 프로그램 조사",
  ]) {
    const blueprint = analyzeSurveyPrompt(prompt);
    assert.equal(blueprint.kind, "needs", prompt);
  }
});

// 특례 25개에 없는 변수는 무엇을 재든 "매우 낮음~매우 높음" 5점 척도 하나로
// 끝났다. "통학 수단은 어느 수준에 해당하나요?"는 답할 수가 없고,
// "카페인 섭취량"을 크기 감각으로만 물으면 상관 분석을 못 한다.
// 이름의 접미사로 부류를 판정해 부류에 맞는 형태로 묻는다.
test("변수 부류를 접미사로 판정한다", () => {
  for (const [name, expected] of [
    ["카페인 섭취량", "amount"],
    ["월 생활비", "amount"],
    ["걸음 수", "amount"],
    ["배달 주문 횟수", "frequency"],
    ["여가 활동 빈도", "frequency"],
    ["게임 플레이 시간", "duration"],
    ["학점", "score"],
    ["아침 결식률", "ratio"],
    ["참여율", "ratio"],
    ["통학 수단", "category"],
    ["등교 방식", "category"],
    ["장학금 수혜 여부", "binary"],
    ["자존감", "attitude"],
    ["학업 스트레스", "attitude"],
    ["집중력", "attitude"],
  ] as const) {
    assert.equal(surveyVariableKind(name), expected, name);
  }
});

test("측정 수준은 부류에서 파생되어 문항 생성기와 어긋나지 않는다", () => {
  // 별도 목록으로 두면 한쪽은 범주형이라 하고 다른 쪽은 척도를 붙인다.
  const prompt = "대학생들의 통학 수단과 그에 따른 통학 피로도 조사";
  const research = parseSurveyIntent(prompt).researchIntent;
  const means = research.variables.find((v) => v.name === "통학 수단");
  assert.equal(means?.measurementLevel, "nominal");
  assert.equal(surveyVariableKind("통학 수단"), "category");
});

test("특례에 없는 변수도 부류에 맞는 형태로 묻는다", () => {
  const prompts = [
    "대학생들의 카페인 섭취량과 그에 따른 집중력 조사",
    "대학생들의 월 생활비와 그에 따른 여가 활동 빈도 조사",
    "대학생들의 통학 수단과 그에 따른 통학 피로도 조사",
    "대학생들의 저축액과 그에 따른 경제적 불안 조사",
    "대학생들의 배달 주문 횟수와 그에 따른 식비 조사",
    "대학생들의 걸음 수와 그에 따른 체력 조사",
  ];
  const vagueScale = ["매우 낮음", "낮은 편", "보통", "높은 편", "매우 높음"];
  for (const prompt of prompts) {
    const research = parseSurveyIntent(prompt).researchIntent;
    const blueprint = analyzeSurveyPrompt(prompt);
    for (const v of research.variables.filter((x) => x.scope === "respondent_level")) {
      const q = blueprint.aiQuestions.find((i) => i.measuredVariable === v.name);
      if (!q) continue;
      const kind = surveyVariableKind(v.name);
      // 크기가 없는 범주에 크기 척도를 붙이면 응답이 불가능하다
      if (kind === "category") {
        assert.equal(q.type, "shortText", `${v.name} (${prompt})`);
      }
      // 수량·금액·점수는 구간을 지어내지 않고 실제 값을 받는다
      if (kind === "amount" || kind === "score" || kind === "ratio") {
        assert.equal(q.type, "shortText", `${v.name} (${prompt})`);
        assert.doesNotMatch(q.title, /1시간 미만|어느 수준에 해당/, v.name);
      }
      // 태도류만 5점 척도가 남는다
      if (q.options && vagueScale.every((s) => q.options!.includes(s))) {
        assert.equal(kind, "attitude", `${v.name}에 크기 척도가 붙음 (${prompt})`);
      }
    }
  }
});

// 접미사로 부류를 못 알아낸 변수(unknown)에 5점 척도를 붙이면
// "성별은 어느 수준에 해당하나요? 매우 낮음~매우 높음"이 나와 답할 수가 없다.
// 크기가 있는 변수는 대부분 attitude로 잡히므로, unknown의 기본값을
// 크기 척도에서 자유응답으로 뒤집는다.
test("크기가 없는 변수에 크기 척도를 붙이지 않는다", () => {
  const prompts = [
    "대학생들의 성별과 그에 따른 학업 스트레스 조사",
    "대학생들의 MBTI와 그에 따른 전공 만족도 조사",
    "대학생들의 취미와 그에 따른 생활 만족도 조사",
    "대학생들의 주거지와 그에 따른 통학 피로도 조사",
    "대학생들의 수강 과목과 그에 따른 학업 만족도 조사",
    "대학생들의 장래 희망과 그에 따른 진로 불안 조사",
  ];
  const scale = ["매우 낮음", "낮은 편", "보통", "높은 편", "매우 높음"];
  for (const prompt of prompts) {
    const research = parseSurveyIntent(prompt).researchIntent;
    const blueprint = analyzeSurveyPrompt(prompt);
    for (const v of research.variables.filter((x) => x.scope === "respondent_level")) {
      const q = blueprint.aiQuestions.find((i) => i.measuredVariable === v.name);
      if (!q?.options) continue;
      if (!scale.every((s) => q.options!.includes(s))) continue;
      // 크기 척도가 붙었다면 그 변수는 반드시 태도류여야 한다
      assert.equal(
        surveyVariableKind(v.name),
        "attitude",
        `${v.name}에 크기 척도가 붙음 (${prompt})`,
      );
    }
  }
});

test("unknown 변수는 형식을 제한하지 않고 받는다", () => {
  const blueprint = analyzeSurveyPrompt("대학생들의 성별과 그에 따른 학업 스트레스 조사");
  const q = blueprint.aiQuestions.find((i) => i.measuredVariable === "성별");

  assert.equal(surveyVariableKind("성별"), "unknown");
  assert.equal(q?.type, "shortText");
  assert.equal(q?.title, "성별은 어떻게 되나요?");
});

test("태도류는 5점 척도를 유지한다", () => {
  // unknown 기본값을 뒤집는다고 태도류까지 자유응답이 되면 안 된다.
  const blueprint = analyzeSurveyPrompt(
    "대학생들의 학업 스트레스와 그에 따른 수면의 질 조사",
  );
  const q = blueprint.aiQuestions.find((i) => i.measuredVariable === "학업 스트레스");

  assert.equal(q?.type, "single");
  assert.ok((q?.options?.length ?? 0) >= 5);
});

test("접미사 부류 판정은 좁은 규칙이 먼저 이긴다", () => {
  // "이용 빈도"가 뒤의 "도"를 보고 attitude가 되면 횟수 구간을 잃는다.
  assert.equal(surveyVariableKind("이용 빈도"), "frequency");
  assert.equal(surveyVariableKind("만족도"), "attitude");
  assert.equal(surveyVariableKind("이용 시간"), "duration");
  assert.equal(surveyVariableKind("이용 여부"), "binary");
});

// 응답자 그룹 추출이 단어 경계를 확인하지 않아 "학생회"의 앞 두 글자
// "학생"을 응답자로 뜯어갔다. 조사 대상이 "회 활동"만 남아
// "회 활동에 전반적으로 얼마나 만족하시나요?"가 나갔다.
test("응답자 그룹을 단어 중간에서 잘라내지 않는다", () => {
  for (const [prompt, subject] of [
    ["학생회 활동 만족도 조사", "학생회 활동"],
    ["학생회 만족도 조사", "학생회"],
    ["학생회관 이용 만족도 조사", "학생회관 이용"],
    ["총학생회 공약 이행 만족도 조사", "총학생회 공약 이행"],
  ] as const) {
    assert.equal(parseSurveyIntent(prompt).surveyObject, subject, prompt);
    assert.equal(parseSurveyIntent(prompt).targetPopulation, null, prompt);

    const corpus = analyzeSurveyPrompt(prompt)
      .aiQuestions.map((item) => item.title)
      .join(" ");
    assert.doesNotMatch(corpus, /(?:^|\s)회\s/, prompt);
  }
});

test("응답자가 실제로 명시되면 여전히 잡아낸다", () => {
  // 경계를 요구한다고 정상 추출까지 막으면 안 된다. 양방향으로 고정한다.
  for (const [prompt, population] of [
    ["대학생 학생회 활동 만족도 조사", "대학생"],
    ["직장인 동호회 활동 만족도 조사", "직장인"],
    ["대학생들의 학식 만족도 조사", "대학생"],
    ["고등학생 진로 상담 만족도 조사", "고등학생"],
  ] as const) {
    assert.equal(parseSurveyIntent(prompt).targetPopulation, population, prompt);
  }
});

// 사용자 제보 5: 리커트 문항이 "…생각해 봅니다는 어느 정도인가요?"로 나갔다.
// naturalQuestionTitle의 "이미 질문인가" 가드에 의문형만 있고 평서형이 없어,
// 완전한 서술문을 명사구로 오해하고 종결어미 뒤에 조사를 붙였다.
test("리커트 서술문은 질문으로 변형하지 않는다", () => {
  const statements = [
    "어려운 문제를 만나면 다른 도움을 받기 전에 먼저 스스로 생각해 봅니다",
    "사교육이나 생성형 AI가 제시한 답을 충분히 검토하지 않고 받아들일 때가 있습니다",
    "나는 스스로 학습 계획을 세운다",
    "과제를 시작하기 전에 목표를 정한다",
    "AI 답변을 그대로 제출한 적이 있다",
    "필요한 자료를 스스로 찾는다",
  ];
  for (const text of statements) {
    assert.equal(naturalQuestionTitle(text, "scale"), text, text);
    assert.doesNotMatch(naturalQuestionTitle(text, "scale"), /다는 어느 정도|다에 가장/, text);
  }
});

test("'다'로 끝나는 명사는 여전히 질문으로 바꾼다", () => {
  // 평서형 판정이 과하면 바다·사이다 같은 명사까지 문항 제목으로 남는다.
  // "다" 앞 음절의 받침이 ㄴ인지로 가른다(한다·세운다 vs 바다·사이다).
  for (const noun of ["바다", "동해 바다", "사이다", "전공 만족도", "학업 스트레스"]) {
    assert.notEqual(naturalQuestionTitle(noun, "scale"), noun, noun);
    assert.match(naturalQuestionTitle(noun, "scale"), /어느 정도인가요\?$/, noun);
  }
});

test("이미 의문형인 제목은 그대로 둔다", () => {
  for (const q of [
    "생성형 AI를 사용한 적이 있나요?",
    "평소 학습 계획을 얼마나 자주 세우나요?",
    "가장 어려운 점은 무엇인가",
  ]) {
    assert.equal(naturalQuestionTitle(q, "scale"), q, q);
  }
});

// 사용자 제보 5-2: 연구 초록을 통째로 붙여넣으면 그 전체를 하나의 조사 대상으로
// 압축하려다 조각만 남았다("학술" → "학술을 직접 수행해 본 경험이 있나요?").
// 도입부와 목적절만 걷어내면 안쪽은 파서가 다룰 수 있는 형태다.
test("연구 초록에서 조사 주제를 뽑아낸다", () => {
  for (const [prompt, subject] of [
    [
      "본 설문조사는 '사교육 및 생성형 AI 활용이 학습자 주체성에 미치는 영향'을 분석하기 위한 학술 연구 목적으로 진행됩니다.",
      "사교육 및 생성형 AI 활용이 학습자 주체성에 미치는 영향",
    ],
    [
      "본 연구는 대학생의 스마트폰 과의존이 학업 성취에 미치는 영향을 분석하기 위한 조사입니다.",
      "대학생의 스마트폰 과의존이 학업 성취에 미치는 영향",
    ],
    ["이 설문은 1인 가구 청년의 식생활 실태를 파악하기 위해 실시됩니다.", "1인 가구 청년의 식생활 실태"],
    ["본 조사는 캠퍼스 내 교통 안전 인식을 알아보고 개선 방안을 도출하고자 합니다.", "캠퍼스 내 교통 안전 인식"],
    ["대학생의 진로 불안과 취업 준비 행동의 관계를 규명하기 위한 연구입니다.", "대학생의 진로 불안과 취업 준비 행동의 관계"],
  ] as const) {
    assert.equal(stripResearchAbstract(prompt), subject, prompt.slice(0, 30));
  }
});

test("짧은 주제구는 소개문 제거에 걸리지 않는다", () => {
  // 게이트가 과하면 모든 프롬프트가 깎인다. 기존 테스트 프롬프트 193개 중
  // 이 게이트에 걸린 것은 없었다.
  for (const prompt of [
    "학식 만족도 조사",
    "교내 카페 만족도 조사",
    "대학생들의 수면 시간과 그에 따른 지각 빈도 조사",
    "대학생들의 통학 시간과 그에 따른 자취 비율 조사",
    "SNS 이용 시간 조사",
    "학과 만족도 조사",
  ]) {
    assert.equal(stripResearchAbstract(prompt), prompt, prompt);
  }
});

test("연구 초록도 주제를 살린 설문이 만들어진다", () => {
  const abstract =
    "본 설문조사는 '사교육 및 생성형 AI 활용이 학습자 주체성에 미치는 영향'을 분석하기 위한 학술 연구 목적으로 진행됩니다. 본 연구는 밀착 사교육과 생성형 AI가 주는 편의성 뒤에 숨은 '사고의 외주화' 현상을 살펴보고자 합니다.";
  const research = parseSurveyIntent(abstract).researchIntent;
  const blueprint = analyzeSurveyPrompt(abstract);

  // 조각("학술")이 아니라 두 변수로 분해돼야 한다
  assert.deepEqual(
    research.variables.filter((v) => v.scope === "respondent_level").map((v) => v.name),
    ["사교육 및 생성형 AI 활용", "학습자 주체성"],
  );
  assert.equal(blueprint.title, "사교육 및 생성형 AI 활용과 학습자 주체성 조사");
  const corpus = blueprint.aiQuestions.map((q) => q.title).join(" ");
  assert.doesNotMatch(corpus, /학술을|본 설문조사는|진행됩니다|분석하기 위한/);
  assert.deepEqual(validateSurvey(abstract, parseSurveyBrief(abstract), blueprint), []);
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
