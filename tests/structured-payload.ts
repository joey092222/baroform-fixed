// 유효한 구조화 설문 생성 응답 픽스처. survey-ai.test.ts와
// ai-cost-controls.test.ts가 함께 사용한다.
import { createSurveyGenerationSchema } from "../app/lib/ai/survey-generation-schema";

export function structuredQuestion(
  id: number,
  role:
    | "screening"
    | "behavior"
    | "experience"
    | "evaluation"
    | "barrier"
    | "open",
  type:
    | "single_choice"
    | "multiple_choice"
    | "scale"
    | "long_text",
  text: string,
  labels: string[] = [],
) {
  return {
    id: `Q${id}`,
    section_id: "S1",
    role,
    type,
    text,
    helper_text: null,
    required: type !== "long_text",
    reference_period: id === 2 ? "최근 4주" : null,
    options: labels.map((label, index) => ({
      id: `Q${id}_O${index + 1}`,
      label,
      exclusive: label === "이용하지 않음",
      fixed_position: label === "기타",
      allows_text: label === "기타",
    })),
    scale:
      type === "scale"
        ? {
            min: 1,
            max: 5,
            min_label: "전혀 만족하지 않음",
            max_label: "매우 만족",
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
      construct: role,
      purpose: `${text} 결과를 이용 행태 분석에 사용합니다.`,
      variable_name: `q_${id}`,
      coding_notes: null,
    },
    grounding: {
      uses_external_fact: id === 1,
      source_ids: id === 1 ? ["SRC1"] : [],
    },
  };
}

export function structuredReadyPayload() {
  const sourceUrl = "https://comic.naver.com";
  const questions = [
    structuredQuestion(1, "screening", "single_choice", "네이버웹툰을 이용한 적이 있나요?", ["예", "아니요"]),
    structuredQuestion(2, "behavior", "single_choice", "최근 4주 동안 네이버웹툰을 얼마나 자주 이용했나요?", ["이용하지 않음", "월 1~3회", "주 1~2회", "주 3회 이상"]),
    structuredQuestion(3, "behavior", "single_choice", "한 번 이용할 때 보통 얼마나 오래 웹툰을 보나요?", ["10분 미만", "10~29분", "30~59분", "1시간 이상"]),
    structuredQuestion(4, "experience", "multiple_choice", "주로 어떤 상황에서 웹툰을 보나요?", ["통학 중", "쉬는 시간", "잠들기 전", "기타"]),
    structuredQuestion(5, "experience", "multiple_choice", "주로 보는 웹툰 장르를 골라주세요.", ["드라마", "로맨스", "액션", "코미디", "기타"]),
    structuredQuestion(6, "evaluation", "scale", "네이버웹툰 이용 경험에 전반적으로 얼마나 만족하나요?"),
    structuredQuestion(7, "open", "long_text", "이용하면서 가장 불편했던 점이 있다면 적어주세요."),
  ];
  const generation = {
    status: "ready" as const,
    research: {
      search_status: "verified" as const,
      entities: [
        {
          input_name: "네이버웹툰",
          resolved_name: "네이버웹툰",
          resolved_as: "웹툰 서비스",
          affiliation_or_location: "대한민국",
          confidence: "verified" as const,
          verified_facts: [
            {
              fact: "웹툰 콘텐츠를 제공하는 서비스입니다.",
              source_ids: ["SRC1"],
            },
          ],
        },
      ],
      sources: [
        {
          id: "SRC1",
          title: "네이버웹툰",
          url: sourceUrl,
          source_type: "official" as const,
          used_for: "서비스 정체 확인",
        },
      ],
      limitations: [],
    },
    survey_plan: {
      survey_type: "이용 현황 조사",
      target: "네이버웹툰을 알고 있는 대학생",
      eligibility: "대학생",
      primary_objective: "대학생의 네이버웹툰 이용 행태와 경험을 파악한다.",
      sub_objectives: ["이용 빈도", "이용 상황", "불편 경험"],
      constructs: [
        { name: "이용 여부", reason: "이용자 규모를 구분한다." },
        { name: "이용 빈도", reason: "이용 강도를 파악한다." },
        { name: "이용 시간", reason: "회당 체류 시간을 파악한다." },
        { name: "이용 상황", reason: "주요 이용 맥락을 파악한다." },
        { name: "장르 선호", reason: "콘텐츠 선호를 파악한다." },
        { name: "만족도", reason: "전체 경험을 평가한다." },
        { name: "불편", reason: "개선 단서를 찾는다." },
      ],
      requested_question_count: 7,
      count_rule: "max_path" as const,
      total_question_nodes: 7,
      min_path_questions: 7,
      max_path_questions: 7,
      estimated_minutes: 3,
    },
    survey: {
      title: "대학생 네이버웹툰 이용 현황 조사",
      intro: "대학생의 네이버웹툰 이용 방식과 경험을 알아보기 위한 설문입니다.",
      sections: [{ id: "S1", title: "이용 경험", description: null }],
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
  };
  const parsed = createSurveyGenerationSchema(7).parse(generation);
  return {
    status: "completed",
    incomplete_details: null,
    output_parsed: parsed,
    output: [
      {
        type: "web_search_call",
        status: "completed",
        action: {
          sources: [{ title: "네이버웹툰", url: sourceUrl }],
        },
      },
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
