import type { SurveyQuestion, SurveyQuestionType } from "./survey-intent";

type JsonRecord = Record<string, unknown>;

const revisionQuestionSchema = {
  type: "object",
  properties: {
    id: { type: "integer", minimum: 1, maximum: 30 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", maxLength: 300 },
    reason: { type: "string", maxLength: 500 },
    type: {
      type: "string",
      enum: [
        "scale",
        "single",
        "multiple",
        "dropdown",
        "shortText",
        "text",
        "date",
        "time",
        "section",
      ],
    },
    options: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 100 },
      maxItems: 12,
    },
    required: { type: "boolean" },
    shuffleOptions: { type: "boolean" },
    scaleMin: { type: "integer", minimum: 0, maximum: 1 },
    scaleMax: { type: "integer", minimum: 2, maximum: 10 },
    scaleMinLabel: { type: "string", maxLength: 40 },
    scaleMaxLabel: { type: "string", maxLength: 40 },
  },
  required: [
    "id",
    "title",
    "description",
    "reason",
    "type",
    "options",
    "required",
    "shuffleOptions",
    "scaleMin",
    "scaleMax",
    "scaleMinLabel",
    "scaleMaxLabel",
  ],
  additionalProperties: false,
} as const;

const revisionSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 2, maxLength: 100 },
    description: { type: "string", maxLength: 600 },
    message: { type: "string", minLength: 2, maxLength: 160 },
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: revisionQuestionSchema,
    },
  },
  required: ["title", "description", "message", "questions"],
  additionalProperties: false,
} as const;

export const surveyRevisionInstructions = `
너는 대학생 설문 플랫폼 '바로폼'의 설문 편집 AI다. 사용자의 현재 설문 전체와 수정 요청을 받아 요청한 부분을 즉시 고친 완전한 설문을 반환한다.

[원칙]
1. 사용자가 요청한 수정만 반영하고 관련 없는 제목·설명·문항은 최대한 보존한다.
2. '추가' 요청이면 필요한 문항을 적절한 위치에 추가하고, '삭제' 요청이면 해당 문항만 삭제한다. 문항은 최대 30개다.
3. 응답 대상과 평가 대상을 섞지 않고, 한 문항에는 한 개념만 묻는다.
4. 중복·유도 질문과 어색한 표현을 제거한다. '의견을 이용했다'처럼 조사 방식 표현을 경험 대상으로 취급하지 않는다.
5. 선택형(single, multiple, dropdown)은 options를 2개 이상 둔다. 나머지는 빈 배열로 둔다.
6. scale은 scaleMin 0 또는 1, scaleMax 2~10을 사용한다. 기본은 1~5다.
7. section은 설문 구획이며 응답을 받지 않는다. required는 false로 둔다.
8. message에는 무엇을 바꿨는지 한 문장으로 짧게 설명한다.
9. 웹 검색은 하지 않는다. 현재 설문과 사용자 요청만 설문 데이터로 다룬다.

긴 설명이나 마크다운 없이 지정된 JSON Schema만 반환한다.
`.trim();

export function buildSurveyRevisionRequest({
  model,
  title,
  description,
  questions,
  instruction,
  targetGrade,
}: {
  model: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  instruction: string;
  targetGrade: string;
}) {
  return {
    model,
    reasoning: { effort: "low" },
    store: false,
    max_output_tokens: 7000,
    instructions: surveyRevisionInstructions,
    input: [
      `<target_grade>${targetGrade}</target_grade>`,
      `<current_survey>${JSON.stringify({ title, description, questions })}</current_survey>`,
      `<revision_request>${instruction}</revision_request>`,
      "수정된 설문 전체를 반환하세요.",
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "baroform_survey_revision",
        strict: true,
        schema: revisionSchema,
      },
    },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function responseText(payload: JsonRecord) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const fragments: string[] = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") {
        fragments.push(content.text);
      }
    }
  }
  return fragments.join("\n");
}

const allowedTypes = new Set<SurveyQuestionType>([
  "scale",
  "single",
  "multiple",
  "dropdown",
  "shortText",
  "text",
  "date",
  "time",
  "section",
]);

export function parseSurveyRevisionResponse(rawPayload: unknown) {
  if (!isRecord(rawPayload)) throw new Error("AI 수정 결과를 읽지 못했어요.");
  const text = responseText(rawPayload);
  if (!text) throw new Error("AI가 수정된 설문을 반환하지 않았어요.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("AI 수정 결과의 형식이 올바르지 않아요.");
  }
  if (!isRecord(decoded) || !Array.isArray(decoded.questions)) {
    throw new Error("AI 수정 결과가 비어 있어요.");
  }
  const questions = decoded.questions.slice(0, 30).map((raw, index) => {
    if (!isRecord(raw)) throw new Error("수정된 문항 형식이 올바르지 않아요.");
    const type = cleanText(raw.type, 20) as SurveyQuestionType;
    if (!allowedTypes.has(type)) throw new Error("지원하지 않는 문항 유형이에요.");
    const options = Array.isArray(raw.options)
      ? raw.options.map((option) => cleanText(option, 100)).filter(Boolean).slice(0, 12)
      : [];
    if (["single", "multiple", "dropdown"].includes(type) && options.length < 2) {
      throw new Error("선택형 문항의 선택지가 부족해요.");
    }
    return {
      id: index + 1,
      title: cleanText(raw.title, 200),
      description: cleanText(raw.description, 300),
      reason: cleanText(raw.reason, 500),
      type,
      options: ["single", "multiple", "dropdown"].includes(type) ? options : undefined,
      required: type === "section" ? false : raw.required === true,
      shuffleOptions: raw.shuffleOptions === true,
      scaleMin: raw.scaleMin === 0 ? 0 : 1,
      scaleMax: Math.min(10, Math.max(2, Number(raw.scaleMax) || 5)),
      scaleMinLabel: cleanText(raw.scaleMinLabel, 40),
      scaleMaxLabel: cleanText(raw.scaleMaxLabel, 40),
    } satisfies SurveyQuestion;
  });
  if (questions.length === 0 || questions.some((question) => !question.title)) {
    throw new Error("수정된 문항이 비어 있어요.");
  }
  return {
    title: cleanText(decoded.title, 100),
    description: cleanText(decoded.description, 600),
    message: cleanText(decoded.message, 160) || "요청한 내용으로 설문을 수정했어요.",
    questions,
  };
}
