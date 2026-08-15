import type { SurveyGeneration } from "./survey-generation-schema";

const administrativeQuestionPattern =
  /(?:귀하는|해당\s*여부|이용\s*경험\s*여부|구매를\s*고려한\s*경험|어디에\s*해당하나요|어느\s*정도에\s*해당하나요|선택하여\s*주십시오|응답해\s*주시기\s*바랍니다|향후\s*이용\s*의향|인지\s*여부|만족\s*수준은\s*어떠합니까|경험한\s*바가\s*있습니까|다음\s*중\s*적합한\s*항목)/;

const internalAnalysisPattern =
  /(?:독립\s*변수|종속\s*변수|매개\s*변수|조절\s*변수|통제\s*변수|분석\s*방법|분석용\s*변수명|코딩\s*(?:방법|방향)|검색\s*(?:과정|출처)|품질\s*검사\s*결과)/;

const internalOptionPattern =
  /^(?:실제\s*구매자|구매\s*고려자|비고려자|고빈도\s*이용층|잠재\s*이탈\s*집단)$/;

const positionalHelperPattern =
  /(?:(?:첫|두|세)\s*번째\s*(?:선택지|항목|보기)|(?:위|아래)\s*항목)/;

function comparableCopy(value: string) {
  return value
    .replace(/[\s?!.,'"“”‘’()[\]{}·:;~-]/g, "")
    .replace(/(?:골라|선택해|응답해)주세요/g, "")
    .toLocaleLowerCase("ko-KR");
}

function repeatsQuestion(question: string, helper: string) {
  const normalizedQuestion = comparableCopy(question);
  const normalizedHelper = comparableCopy(helper);
  if (normalizedQuestion.length < 8 || normalizedHelper.length < 8) return false;
  return (
    normalizedQuestion === normalizedHelper ||
    normalizedQuestion.includes(normalizedHelper) ||
    normalizedHelper.includes(normalizedQuestion)
  );
}

export function respondentCopyIssues(generation: SurveyGeneration) {
  const issues: string[] = [];
  const generalCopy = [
    generation.survey.title,
    generation.survey.intro,
    generation.survey.completion_message,
    ...generation.survey.sections.flatMap((section) => [
      section.title,
      section.description ?? "",
    ]),
  ];

  if (generalCopy.some((copy) => internalAnalysisPattern.test(copy))) {
    issues.push("응답자용 설문 문구에 제작자용 분석 정보가 포함되었습니다.");
  }
  if (generalCopy.some((copy) => administrativeQuestionPattern.test(copy))) {
    issues.push("응답자용 설문 문구에 행정적이거나 추상적인 표현이 남아 있습니다.");
  }

  for (const question of generation.survey.questions) {
    if (administrativeQuestionPattern.test(question.text)) {
      issues.push(`질문 ${question.id}에 행정적이거나 추상적인 표현이 남아 있습니다.`);
    }
    if (internalAnalysisPattern.test(question.text)) {
      issues.push(`질문 ${question.id}에 제작자용 분석 정보가 포함되었습니다.`);
    }

    if (question.helper_text) {
      if (administrativeQuestionPattern.test(question.helper_text)) {
        issues.push(`질문 ${question.id}의 보조 설명에 행정적 표현이 남아 있습니다.`);
      }
      if (positionalHelperPattern.test(question.helper_text)) {
        issues.push(`질문 ${question.id}의 보조 설명이 선택지 위치를 가리킵니다.`);
      }
      if (internalAnalysisPattern.test(question.helper_text)) {
        issues.push(`질문 ${question.id}의 보조 설명에 분석 정보가 포함되었습니다.`);
      }
      if (repeatsQuestion(question.text, question.helper_text)) {
        issues.push(`질문 ${question.id}의 보조 설명이 질문을 반복합니다.`);
      }
    }

    const optionAndScaleCopy = [
      ...question.options.map((option) => option.label),
      question.scale?.min_label ?? "",
      question.scale?.max_label ?? "",
    ];
    if (
      optionAndScaleCopy.some(
        (copy) =>
          internalOptionPattern.test(copy) ||
          internalAnalysisPattern.test(copy) ||
          administrativeQuestionPattern.test(copy),
      )
    ) {
      issues.push(`질문 ${question.id}의 선택지나 척도에 분석용 표현이 포함되었습니다.`);
    }
  }

  return [...new Set(issues)];
}
