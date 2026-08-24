// 템플릿 → 편집기 문항 변환.
// 템플릿의 공통 블록(이름·학번, 리커트 척도 등)과 주제별 예시 문항을
// 편집기가 그대로 쓰는 SurveyQuestion 배열로 편다.
import type { SurveyQuestion } from "./survey-intent";
import {
  templateBlocks,
  type SurveyTemplate,
  type TemplateField,
} from "./survey-template-data";

export { surveyTemplates, templateBlocks, templateSource } from "./survey-template-data";
export type { SurveyTemplate } from "./survey-template-data";

// 화면에 쓰는 카테고리 순서와 짧은 표기
export const templateCategories: { full: string; short: string; icon: string }[] = [
  { full: "동아리·학회 지원서", short: "동아리·학회", icon: "🎪" },
  { full: "학과수업용", short: "수업·과제", icon: "📚" },
  { full: "논문·학술연구용", short: "학술연구", icon: "🔬" },
  { full: "수요검증(학생창업·공모전)", short: "수요검증", icon: "🚀" },
  { full: "기업마케팅(스타트업·기업 캠페인)", short: "기업마케팅", icon: "📈" },
  { full: "기타(언론보도/개인부탁 등)", short: "기타", icon: "📄" },
];

function fieldToQuestion(field: TemplateField, id: number, reason: string): SurveyQuestion {
  const base = {
    id,
    title: field.label,
    reason,
    required: field.required,
    description: "",
    shuffleOptions: false,
  };
  switch (field.type) {
    case "single_choice":
      return { ...base, type: "single", options: field.options ?? [] };
    case "multi_choice":
      return { ...base, type: "multiple", options: field.options ?? [] };
    case "short_text":
      return { ...base, type: "shortText" };
    case "long_text":
      return { ...base, type: "text" };
    case "likert_5":
      return {
        ...base,
        type: "scale",
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: field.scaleLabels?.[0] ?? "전혀 그렇지 않다",
        scaleMaxLabel: field.scaleLabels?.at(-1) ?? "매우 그렇다",
      };
    case "notice":
      // 안내문은 질문이 아니라 구획으로 넣는다.
      return { ...base, type: "section", required: false };
  }
}

export function buildTemplateQuestions(template: SurveyTemplate): SurveyQuestion[] {
  const questions: SurveyQuestion[] = [];
  let id = 1;

  for (const blockId of template.blocks) {
    const block = templateBlocks[blockId];
    if (!block) continue;
    for (const field of block.fields) {
      questions.push(fieldToQuestion(field, id, `${block.name} 블록의 기본 문항`));
      id += 1;
    }
  }

  // 주제별 예시 문항은 주제에 맞게 다듬어 쓰라는 출발점이므로 단답으로 깐다.
  for (const sample of template.sampleQuestions) {
    questions.push({
      id,
      title: sample,
      reason: "이 주제에서 자주 묻는 문항 예시 — 문구를 다듬어 쓰세요",
      type: "shortText",
      required: false,
      description: "",
      shuffleOptions: false,
    });
    id += 1;
  }

  if (questions.length === 0) {
    questions.push({
      id: 1,
      title: "첫 번째 질문을 입력해주세요",
      reason: "",
      type: "single",
      options: ["선택지 1", "선택지 2"],
      required: true,
      description: "",
      shuffleOptions: false,
    });
  }

  return questions.slice(0, 30);
}

// "빈 설문부터" 시작용 최소 문항
export function blankSurveyQuestions(): SurveyQuestion[] {
  return [
    {
      id: 1,
      title: "첫 번째 질문을 입력해주세요",
      reason: "",
      type: "single",
      options: ["선택지 1", "선택지 2"],
      required: true,
      description: "",
      shuffleOptions: false,
    },
  ];
}
