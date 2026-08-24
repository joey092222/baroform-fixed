import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import {
  buildSurveyAiRequest,
  repairInvalidQuestions,
} from "../app/survey-ai";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import { createSurveyGenerationSchema } from "../app/lib/ai/survey-generation-schema";
import { createSurveyPlan } from "../app/survey-planning";
import {
  parsePurposeSegments,
  parseSurveyIntent,
  validateSurveyIntentCandidate,
} from "../app/survey-semantic-intent";

const primaryPrompt =
  "학교 근처 카페의 사용경험 조사와 빈좌석 알림 서비스 도입에 대한 수요조사";

function corpus(prompt: string) {
  return analyzeSurveyPrompt(prompt).aiQuestions.map((item) => item.title).join(" ");
}

function structuredCompositePayload(prompt: string) {
  const blueprint = analyzeSurveyPrompt(prompt);
  const roles = [
    "behavior",
    "behavior",
    "experience",
    "barrier",
    "evaluation",
    "evaluation",
    "priority",
  ] as const;
  const questions = blueprint.aiQuestions.map((question, index) => {
    const type =
      question.type === "single"
        ? "single_choice"
        : question.type === "multiple"
          ? "multiple_choice"
          : question.type === "scale"
            ? "scale"
            : "long_text";
    return {
      id: `Q${index + 1}`,
      section_id: index < 4 ? "S1" : "S2",
      role: roles[index] ?? "open",
      type,
      text: question.title,
      helper_text: null,
      required: question.required,
      reference_period: null,
      options: (question.options ?? []).map((label, optionIndex) => ({
        id: `Q${index + 1}_O${optionIndex + 1}`,
        label,
        exclusive: /해당 없음|이용하지 않음/.test(label),
        fixed_position: /기타/.test(label),
        allows_text: /기타/.test(label),
      })),
      scale:
        type === "scale"
          ? {
              min: 1,
              max: 5,
              min_label: "전혀 그렇지 않음",
              max_label: "매우 그러함",
            }
          : null,
      randomize_options: false,
      show_if: [],
      validation: {
        min_value: null,
        max_value: null,
        min_selections: type === "multiple_choice" ? 1 : null,
        max_selections: type === "multiple_choice" ? 3 : null,
        max_length: type === "long_text" ? 1000 : null,
      },
      analysis: {
        construct: question.measuredVariable ?? `복합 목적 변수 ${index + 1}`,
        purpose: question.reason,
        variable_name: `composite_q_${index + 1}`,
        coding_notes: null,
      },
      grounding: {
        uses_external_fact: false,
        source_ids: [],
      },
    };
  });
  const parsed = createSurveyGenerationSchema(7).parse({
    status: "ready_with_caution",
    research: {
      search_status: "failed",
      entities: [],
      sources: [],
      limitations: ["일반 조사이므로 외부 사실 검색을 사용하지 않음"],
    },
    survey_plan: {
      survey_type: "복합 이용 경험 및 수요 조사",
      target: "일반 응답자",
      eligibility: "일반 응답자",
      primary_objective: "현재 이용 경험과 제안 서비스 수요를 순서대로 파악함.",
      sub_objectives: [
        "현재 이용 경험과 불편 파악",
        "제안 서비스 필요성과 이용 의향 파악",
      ],
      constructs: questions.map((question) => ({
        name: question.analysis.construct,
        reason: question.analysis.purpose,
      })),
      requested_question_count: 7,
      count_rule: "max_path",
      total_question_nodes: 7,
      min_path_questions: 7,
      max_path_questions: 7,
      estimated_minutes: 4,
    },
    survey: {
      title: blueprint.title,
      intro: blueprint.description,
      sections: [
        { id: "S1", title: "현재 이용 경험", description: null },
        { id: "S2", title: "제안 서비스 수요", description: null },
      ],
      questions,
      completion_message: "응답해주셔서 감사합니다.",
    },
    quality_check: {
      all_named_entities_searched: true,
      all_specific_claims_grounded: true,
      all_questions_have_analysis_purpose: true,
      double_barreled_questions_removed: true,
      leading_questions_removed: true,
      duplicate_questions_removed: true,
      response_options_checked: true,
      all_logic_paths_valid: true,
      question_count_valid: true,
      mobile_readability_checked: true,
      respondent_path_simulation_passed: true,
      warnings: [],
    },
  });

  return {
    status: "completed",
    incomplete_details: null,
    output_parsed: parsed,
    output: [
      {
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(parsed),
            annotations: [],
          },
        ],
      },
    ],
  };
}

test("복수 조사 목적을 현재 경험과 제안 기능 수요로 분리한다", () => {
  const intent = parseSurveyIntent(primaryPrompt);

  assert.equal(intent.intentMode, "composite");
  assert.equal(intent.objectKind, "composite");
  assert.equal(intent.surveyObject, null);
  assert.equal(intent.legacyEvaluationTarget, null);
  assert.deepEqual(intent.evaluationTargets, [
    "학교 근처 카페",
    "빈좌석 알림 서비스",
  ]);
  assert.deepEqual(
    intent.purposeBlocks.map((block) => ({
      kind: block.kind,
      target: block.target,
      relation: block.relationToPrevious,
    })),
    [
      {
        kind: "usage_experience",
        target: "학교 근처 카페",
        relation: null,
      },
      {
        kind: "need_demand",
        target: "빈좌석 알림 서비스",
        relation: "problem_solution",
      },
    ],
  );
  assert.ok(intent.entities.some((item) => item.role === "existing_context"));
  assert.ok(intent.entities.some((item) => item.role === "current_activity"));
  assert.ok(intent.entities.some((item) => item.role === "pain_point"));
  assert.ok(intent.entities.some((item) => item.role === "proposed_solution"));
  assert.ok(intent.entities.some((item) => item.role === "demand_target"));
});

test("띄어쓰기와 연결 표현이 달라도 목적 블록을 동일하게 보존한다", () => {
  const prompts = [
    "학교 근처 카페의 사용 경험 조사와 빈 좌석 알림 서비스 도입에 대한 수요 조사",
    "학교 주변 카페 이용 경험과 빈 좌석 알림 기능 수요를 조사하고 싶어요",
    "대학가 카페 이용 현황 및 좌석 알림 서비스 도입 의향 조사",
    "학생들의 카페 이용 불편을 파악하고 빈자리 알림 서비스가 필요한지 조사하고 싶어요",
  ];

  for (const prompt of prompts) {
    const segments = parsePurposeSegments(prompt);
    const intent = parseSurveyIntent(prompt);
    assert.equal(segments.length, 2, prompt);
    assert.equal(intent.intentMode, "composite", prompt);
    assert.equal(intent.purposeBlocks.length, 2, prompt);
    assert.equal(intent.purposeBlocks[1]?.kind, "need_demand", prompt);
    assert.equal(intent.purposeBlocks[1]?.relationToPrevious, "problem_solution", prompt);
    assert.equal(intent.surveyObject, null, prompt);
  }
});

test("복합 계획은 모든 목적 블록을 문항 수준 메타데이터로 연결한다", () => {
  const intent = parseSurveyIntent(primaryPrompt);
  const plan = createSurveyPlan(intent, 7);
  const blueprint = analyzeSurveyPrompt(primaryPrompt);

  assert.deepEqual(
    plan.purposeCoverage.map((item) => item.plannedQuestionCount),
    [4, 3],
  );
  assert.equal(plan.blocks.length, 7);
  assert.ok(plan.blocks.every((block) => block.purposeBlockId));
  assert.ok(plan.blocks.every((block) => (block.measuredEntityIds?.length ?? 0) > 0));
  assert.ok(blueprint.aiQuestions.every((question) => question.purposeBlockId));
  assert.ok(blueprint.aiQuestions.every((question) => (question.measuredEntityIds?.length ?? 0) > 0));
  assert.deepEqual(
    new Set(blueprint.aiQuestions.map((question) => question.purposeBlockId)),
    new Set(["purpose-1", "purpose-2"]),
  );
});

test("OpenAI 요청에는 복합 의도와 목적별 계획을 구조화해 전달한다", () => {
  const request = buildSurveyAiRequest(primaryPrompt, null, "gpt-test", {
    surveyMode: "standard",
    targetGrade: "전학년",
    questionCount: 7,
  });
  const input = typeof request.input === "string" ? request.input : JSON.stringify(request.input);

  assert.match(input, /"intentMode":"composite"/);
  assert.match(input, /"kind":"usage_experience"/);
  assert.match(input, /"kind":"need_demand"/);
  assert.match(input, /"relationToPrevious":"problem_solution"/);
  assert.match(input, /preserveAllPurposeBlocks/);
  assert.doesNotMatch(input, /"fallbackKind":"needs"/);
});

test("로컬 복합 설문은 현재 경험 뒤에 제안 기능 수요를 묻는다", () => {
  const blueprint = analyzeSurveyPrompt(primaryPrompt);
  const questions = blueprint.aiQuestions.map((item) => item.title);
  const all = questions.join(" ");

  assert.equal(questions.length, 7);
  assert.match(questions[0] ?? "", /학교 근처 카페.*얼마나 자주 이용/);
  assert.match(questions[2] ?? "", /좌석.*어려운 경우.*얼마나 자주/);
  assert.match(questions[4] ?? "", /빈좌석 알림 서비스.*얼마나 필요/);
  assert.match(questions[5] ?? "", /제공된다면 이용할 의향/);
  assert.match(questions[6] ?? "", /중요하게 생각하는 기능이나 조건/);
  assert.doesNotMatch(all, /사용경험 조사와|수요조사를 이용|조사와 빈좌석/);
});

test("유사한 문제-해결 복합 입력도 범용적으로 처리한다", () => {
  const prompts = [
    "도서관 이용 경험과 좌석 예약 서비스 수요 조사",
    "학교 급식 만족도와 모바일 주문 기능 수요 조사",
    "배달 앱 사용 경험과 구독 서비스 도입 의향 조사",
    "학생들의 통학 불편을 파악하고 학교 셔틀 수요를 조사하고 싶어요",
    "스터디 공간 이용 현황과 스터디룸 예약 서비스 수요 조사",
  ];

  for (const prompt of prompts) {
    const intent = parseSurveyIntent(prompt);
    const questions = corpus(prompt);
    assert.equal(intent.intentMode, "composite", prompt);
    assert.equal(intent.purposeBlocks.length, 2, prompt);
    assert.match(questions, /얼마나 필요하다고 생각/);
    assert.match(questions, /제공된다면 이용할 의향/);
    assert.doesNotMatch(questions, /조사(?:와|과|및).*(?:이용|사용)/);
  }
});

test("하나의 목적 안에 있는 병렬 명사와 단일 수요는 분리하지 않는다", () => {
  const cases = [
    ["카페 이용 경험 조사", "single"],
    ["빈 좌석 알림 서비스 수요 조사", "single"],
    ["카페 가격과 품질 만족도 조사", "single"],
    ["교사와 학생의 소통 만족도 조사", "single"],
  ] as const;

  for (const [prompt, expectedMode] of cases) {
    const intent = parseSurveyIntent(prompt);
    assert.equal(intent.intentMode, expectedMode, prompt);
    assert.equal(intent.purposeBlocks.length, 1, prompt);
  }
});

test("검증기는 복합 목적을 하나의 수요 대상에 넣은 레거시 문항을 탐지한다", () => {
  const intent = parseSurveyIntent(primaryPrompt);
  const violations = validateSurveyIntentCandidate(intent, {
    title: primaryPrompt,
    description: "복합 목적을 한 번에 평가합니다.",
    questions: [
      {
        id: 1,
        title:
          "학교 근처 카페의 사용경험 조사와 빈좌석 알림 서비스 도입 수요가 현재 얼마나 필요하다고 느끼시나요?",
      },
    ],
  });
  const codes = new Set(violations.map((item) => item.code));

  assert.ok(codes.has("COMPOSITE_PURPOSE_FLATTENED"));
  assert.ok(codes.has("STUDY_PURPOSE_USED_AS_EVALUATION_TARGET"));
  assert.ok(codes.has("GENERIC_NEEDS_TEMPLATE_ROLE_MISMATCH"));
  assert.ok(codes.has("LEGACY_BLUEPRINT_USED_FOR_COMPOSITE_INTENT"));
  assert.ok(codes.has("PURPOSE_BLOCK_DROPPED"));
});

test("부분 복구는 위반 문항만 복합 계획 기반 문항으로 교체한다", () => {
  const intent = parseSurveyIntent(primaryPrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(primaryPrompt);
  const original = {
    ...fallback,
    aiQuestions: fallback.aiQuestions.map((item, index) =>
      index === 4
        ? {
            ...item,
            title:
              "학교 근처 카페 사용경험 조사와 빈좌석 알림 서비스 수요가 얼마나 필요한가요?",
          }
        : { ...item, title: `정상 복합 문항 ${index + 1}: ${item.title}` },
    ),
  };
  const repaired = repairInvalidQuestions({
    survey: original,
    intent,
    plan,
    violations: [
      {
        code: "COMPOSITE_PURPOSE_FLATTENED",
        severity: "repairable",
        message: "복합 목적 평탄화",
        questionId: 5,
      },
    ],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [5]);
  for (const index of [0, 1, 2, 3, 5, 6]) {
    assert.equal(
      repaired.survey.aiQuestions[index]?.title,
      original.aiQuestions[index]?.title,
    );
  }
  assert.equal(repaired.survey.aiQuestions[4]?.purposeBlockId, "purpose-2");
  assert.ok((repaired.survey.aiQuestions[4]?.measuredEntityIds?.length ?? 0) > 0);
});

test("POST /api/survey-draft의 무키 경로도 복합 계획 fallback을 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-composite-purpose-regression",
        },
        body: JSON.stringify({
          prompt: primaryPrompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      status?: string;
      blueprint?: { aiQuestions?: Array<{ title?: string; purposeBlockId?: string }> };
    };

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.match(body.status ?? "", /^ready/);
    assert.equal(response.headers.get("x-baroform-generation-source"), "composite_plan_fallback");
    assert.equal(response.headers.get("x-baroform-model-calls"), "0");
    assert.equal(response.headers.get("x-baroform-intent-mode"), "composite");
    assert.equal(response.headers.get("x-baroform-purpose-block-count"), "2");
    assert.equal(body.blueprint?.aiQuestions?.length, 7);
    assert.ok(body.blueprint?.aiQuestions?.every((item) => item.purposeBlockId));
    assert.doesNotMatch(
      body.blueprint?.aiQuestions?.map((item) => item.title).join(" ") ?? "",
      /사용경험 조사와|수요조사를 이용/,
    );
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("POST 운영 경로는 정상 OpenAI 복합 설문을 fallback 없이 유지한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  const prompt =
    "캠퍼스 서문 카페의 사용 경험 조사와 좌석 알림 서비스 도입 수요 조사";
  let modelCallCount = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    modelCallCount += 1;
    return Response.json(structuredCompositePayload(prompt), {
      headers: { "x-request-id": "req_composite_success" },
    });
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-composite-openai-success",
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
    const body = (await response.json()) as {
      blueprint?: { aiQuestions?: Array<{ title?: string }> };
    };

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(modelCallCount, 1);
    assert.equal(response.headers.get("x-baroform-generation-source"), "openai");
    assert.equal(response.headers.get("x-baroform-fallback-count"), "0");
    assert.equal(response.headers.get("x-baroform-model-calls"), "1");
    assert.equal(response.headers.get("x-baroform-intent-mode"), "composite");
    assert.doesNotMatch(
      body.blueprint?.aiQuestions?.map((item) => item.title).join(" ") ?? "",
      /사용 경험 조사와.*얼마나 필요/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("OpenAI 구조 파싱 실패는 사유를 넣어 1회 재시도하고, 계속 실패하면 정직한 오류를 낸다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  const prompt =
    "북문 카페 이용 경험 조사와 빈자리 안내 기능 도입 수요 조사";
  process.env.OPENAI_API_KEY = "test-key";
  let modelCalls = 0;
  globalThis.fetch = async () => {
    modelCalls += 1;
    return Response.json({
      status: "completed",
      incomplete_details: null,
      output: [
        {
          type: "message",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ invalid: true }),
              annotations: [],
            },
          ],
        },
      ],
    });
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-composite-parse-failure",
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
    const body = (await response.json()) as {
      ok?: boolean;
      code?: string;
    };

    // 템플릿 설문으로 조용히 바꿔치기하지 않는다. 거부 사유를 넣어 한 번 더
    // 생성시키고, 그래도 실패하면 사용자에게 정직하게 알린다.
    assert.equal(response.status, 502, JSON.stringify(body));
    assert.equal(body.ok, false);
    assert.equal(body.code, "OUTPUT_JSON_INVALID");
    assert.equal(modelCalls, 2);
    assert.equal(response.headers.get("x-baroform-model-calls"), "2");
    assert.equal(response.headers.get("x-baroform-regeneration-count"), "1");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("OpenAI 전송 실패도 두 목적을 유지한 계획 기반 fallback을 사용한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  const prompt = "후문 카페 이용 현황과 좌석 알림 앱 도입 수요 조사";
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    throw new TypeError("simulated network failure");
  };

  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-composite-network-failure",
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
    const body = (await response.json()) as {
      blueprint?: { aiQuestions?: Array<{ purposeBlockId?: string }> };
    };

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(
      response.headers.get("x-baroform-generation-source"),
      "composite_plan_fallback",
    );
    assert.equal(response.headers.get("x-baroform-ai-fallback"), "responses-api-error");
    assert.equal(response.headers.get("x-baroform-model-calls"), "1");
    assert.equal(response.headers.get("x-baroform-fallback-count"), "1");
    assert.ok(body.blueprint?.aiQuestions?.every((item) => item.purposeBlockId));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});
