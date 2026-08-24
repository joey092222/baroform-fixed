// 실서비스 배포 번들에서 추출한 템플릿 레지스트리(에브리타임 설문 318건 분석 기반).
// 생성 스크립트로 만든 파일 — 직접 수정하지 말 것.

export type TemplateField = {
  label: string;
  type: "single_choice" | "multi_choice" | "short_text" | "long_text" | "likert_5" | "notice";
  options?: string[];
  scaleLabels?: string[];
  required: boolean;
};

export type TemplateBlock = { name: string; fields: TemplateField[] };

export type SurveyTemplate = {
  id: string;
  category: string;
  name: string;
  description: string;
  sampleCount: number;
  estimatedItems: string;
  blocks: string[];
  sampleQuestions: string[];
};

export const templateSource = "에브리타임 설문조사 26.1~26.8 (318건) 분석 기반";

export const templateBlocks: Record<string, TemplateBlock> = {
  "INTRO": {
    "name": "안내문(비질문)",
    "fields": []
  },
  "CONSENT": {
    "name": "참여/개인정보 수집 동의",
    "fields": [
      {
        "label": "본 설문 참여 및 개인정보 수집·이용에 동의하십니까?",
        "type": "single_choice",
        "options": [
          "동의합니다",
          "동의하지 않습니다"
        ],
        "required": true
      }
    ]
  },
  "DEMO_BASIC": {
    "name": "기본 인구통계",
    "fields": [
      {
        "label": "연령대",
        "type": "single_choice",
        "options": [
          "10대",
          "20대 초반(20~23)",
          "20대 후반(24~29)",
          "30대 이상"
        ],
        "required": true
      },
      {
        "label": "성별",
        "type": "single_choice",
        "options": [
          "남성",
          "여성",
          "응답하지 않음"
        ],
        "required": true
      }
    ]
  },
  "ACADEMIC_INFO": {
    "name": "학적 정보",
    "fields": [
      {
        "label": "학교",
        "type": "short_text",
        "required": false
      },
      {
        "label": "학과/전공",
        "type": "short_text",
        "required": false
      },
      {
        "label": "학년(재학/휴학 포함)",
        "type": "single_choice",
        "options": [
          "1학년",
          "2학년",
          "3학년",
          "4학년 이상",
          "휴학 중",
          "대학원생"
        ],
        "required": false
      }
    ]
  },
  "CLUB_APPLICANT": {
    "name": "동아리·학회 지원자 정보",
    "fields": [
      {
        "label": "이름",
        "type": "short_text",
        "required": true
      },
      {
        "label": "학번",
        "type": "short_text",
        "required": true
      },
      {
        "label": "성별",
        "type": "single_choice",
        "options": [
          "남성",
          "여성"
        ],
        "required": false
      },
      {
        "label": "전화번호(연락처)",
        "type": "short_text",
        "required": true
      },
      {
        "label": "이메일",
        "type": "short_text",
        "required": false
      },
      {
        "label": "학과/전공",
        "type": "short_text",
        "required": true
      },
      {
        "label": "자기소개",
        "type": "long_text",
        "required": true
      },
      {
        "label": "지원 동기",
        "type": "long_text",
        "required": true
      },
      {
        "label": "활동 가능 요일/시간",
        "type": "multi_choice",
        "options": [
          "월",
          "화",
          "수",
          "목",
          "금",
          "토",
          "일"
        ],
        "required": false
      }
    ]
  },
  "SCREENING_YN": {
    "name": "자격요건 스크리닝(예/아니오)",
    "fields": [
      {
        "label": "(자격요건 문항 예시) 최근 1개월 내 해당 경험이 있으십니까?",
        "type": "single_choice",
        "options": [
          "예",
          "아니오"
        ],
        "required": true
      }
    ]
  },
  "USAGE_EXPERIENCE": {
    "name": "이용 경험/빈도",
    "fields": [
      {
        "label": "해당 서비스/제품을 이용해 본 경험이 있습니까?",
        "type": "single_choice",
        "options": [
          "있다",
          "없다"
        ],
        "required": true
      },
      {
        "label": "이용 빈도",
        "type": "single_choice",
        "options": [
          "거의 매일",
          "주 1~3회",
          "월 1~3회",
          "그 이하"
        ],
        "required": false
      },
      {
        "label": "주로 이용하는 목적/상황(해당 항목 모두 선택)",
        "type": "multi_choice",
        "options": [
          "예시1",
          "예시2",
          "예시3",
          "기타(직접입력)"
        ],
        "required": false
      }
    ]
  },
  "LIKERT_ATTITUDE": {
    "name": "인식/태도 리커트 척도",
    "fields": [
      {
        "label": "(제시 문장)에 대해 얼마나 동의하십니까?",
        "type": "likert_5",
        "scaleLabels": [
          "전혀 그렇지 않다",
          "그렇지 않다",
          "보통이다",
          "그렇다",
          "매우 그렇다"
        ],
        "required": true
      }
    ]
  },
  "NEEDS_PRIORITY": {
    "name": "니즈/우선순위 조사",
    "fields": [
      {
        "label": "새로운 서비스/기능이 출시된다면 이용할 의향이 있습니까?",
        "type": "likert_5",
        "scaleLabels": [
          "전혀 없다",
          "없다",
          "보통",
          "있다",
          "매우 있다"
        ],
        "required": true
      },
      {
        "label": "가장 필요하다고 느끼는 기능/개선점 (해당 항목 모두 선택)",
        "type": "multi_choice",
        "options": [
          "예시1",
          "예시2",
          "예시3",
          "기타(직접입력)"
        ],
        "required": false
      }
    ]
  },
  "OPEN_FEEDBACK": {
    "name": "개방형 의견",
    "fields": [
      {
        "label": "기타 의견이나 아이디어가 있다면 자유롭게 작성해주세요",
        "type": "long_text",
        "required": false
      }
    ]
  },
  "CONTACT_REWARD": {
    "name": "리워드용 연락처 수집",
    "fields": [
      {
        "label": "전화번호 또는 카카오톡 ID (경품 지급용)",
        "type": "short_text",
        "required": true
      },
      {
        "label": "개인정보는 경품 지급 목적으로만 사용되며 즉시 파기됩니다",
        "type": "notice",
        "required": false
      }
    ]
  },
  "INTERVIEW_SCHEDULE": {
    "name": "인터뷰/실험 참가 일정",
    "fields": [
      {
        "label": "인터뷰 참여 가능 일시(복수 선택 가능)",
        "type": "multi_choice",
        "options": [
          "예시 일정1",
          "예시 일정2",
          "예시 일정3"
        ],
        "required": false
      },
      {
        "label": "선호하는 진행 방식",
        "type": "single_choice",
        "options": [
          "대면",
          "화상(Zoom 등)",
          "전화"
        ],
        "required": false
      }
    ]
  }
};

export const surveyTemplates: SurveyTemplate[] = [
  {
    "id": "club_recruitment_application",
    "category": "동아리·학회 지원서",
    "name": "동아리/학회 신입 부원 모집 지원서",
    "description": "동아리·학회 신입 회원을 모집할 때 쓰는 지원서형 폼. 순수 설문과 달리 개인 식별정보+자기소개가 핵심.",
    "sampleCount": 6,
    "estimatedItems": "8~12개",
    "blocks": [
      "CLUB_APPLICANT",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "지원 분야/파트(기획·마케팅·디자인 등)",
      "관련 경험 또는 포트폴리오 링크",
      "우리 동아리를 알게 된 경로"
    ]
  },
  {
    "id": "club_briefing_preapply",
    "category": "동아리·학회 지원서",
    "name": "학회 설명회 사전신청 + 정식지원 결합형",
    "description": "1차로 설명회 참석용 간단 신청폼을 받고, 2차 정식 지원서는 별도(홈페이지 등)로 받는 2단계 구조.",
    "sampleCount": 2,
    "estimatedItems": "5~7개",
    "blocks": [
      "DEMO_BASIC",
      "ACADEMIC_INFO"
    ],
    "sampleQuestions": [
      "설명회 참석 가능 일정",
      "정식 지원서 제출 의향 여부"
    ]
  },
  {
    "id": "external_activity_application",
    "category": "동아리·학회 지원서",
    "name": "대외활동/서포터즈 지원서",
    "description": "기업·단체 주관 대학생 서포터즈, 청년단체 사무국 등 대외활동 지원서.",
    "sampleCount": 2,
    "estimatedItems": "9~13개",
    "blocks": [
      "CLUB_APPLICANT"
    ],
    "sampleQuestions": [
      "SNS 활동 경험(팔로워 수 등)",
      "활동 기간 중 다른 일정과의 병행 가능 여부",
      "지원 계기"
    ]
  },
  {
    "id": "course_consumer_perception",
    "category": "학과수업용",
    "name": "소비자 인식·니즈 조사형 (마케팅 수업과제)",
    "description": "마케팅/경영 전공 수업 과제로 특정 제품·서비스에 대한 소비자 인식을 조사하는 가장 흔한 유형.",
    "sampleCount": 15,
    "estimatedItems": "5~10개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "해당 브랜드/제품을 알게 된 경로",
      "타 브랜드 대비 인식 비교",
      "구매(이용) 결정에 영향을 미친 요인"
    ]
  },
  {
    "id": "course_brand_positioning",
    "category": "학과수업용",
    "name": "브랜드 인지도·포지셔닝 조사형",
    "description": "특정 브랜드의 이미지, 인지도, 경쟁사 대비 포지셔닝을 확인하는 조사.",
    "sampleCount": 8,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "브랜드 인지 경로(광고/지인추천/SNS 등)",
      "브랜드를 떠올렸을 때 연상되는 이미지(주관식)",
      "경쟁 브랜드와 비교했을 때의 강점/약점"
    ]
  },
  {
    "id": "course_facility_satisfaction",
    "category": "학과수업용",
    "name": "교내 시설/공간 이용경험 및 만족도 조사형",
    "description": "도서관, 기숙사, 카페, 굿즈샵 등 교내 시설 이용 실태·만족도·개선점 조사.",
    "sampleCount": 6,
    "estimatedItems": "6~10개",
    "blocks": [
      "INTRO",
      "ACADEMIC_INFO",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "주 이용 시간대",
      "이용 시 불편했던 점(복수선택)",
      "개선 우선순위"
    ]
  },
  {
    "id": "course_social_issue_perception",
    "category": "학과수업용",
    "name": "사회이슈 인식 조사형 (기획기사·발표용)",
    "description": "특정 사회현상/이슈에 대한 대학생 인식을 조사해 발표자료나 리포트 근거로 활용.",
    "sampleCount": 5,
    "estimatedItems": "5~8개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "해당 이슈에 대한 인지 여부",
      "정보를 접한 경로",
      "이슈에 대한 개인적 견해(주관식)"
    ]
  },
  {
    "id": "course_service_planning_demand",
    "category": "학과수업용",
    "name": "신규 서비스 기획 수요조사형 (공모전 겸용)",
    "description": "수업 과제로 신규 앱/서비스를 기획하며 겸사 공모전에도 출품하는 유형 — 내용은 수요검증형과 거의 동일.",
    "sampleCount": 12,
    "estimatedItems": "6~10개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "NEEDS_PRIORITY",
      "OPEN_FEEDBACK",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "현재 겪고 있는 불편함(문제 정의)",
      "제안된 서비스 컨셉에 대한 반응",
      "이용 의향이 있다면 지불 의향 금액대"
    ]
  },
  {
    "id": "course_major_satisfaction",
    "category": "학과수업용",
    "name": "전공 만족도/교육과정 평가형",
    "description": "본인 전공(학과)의 교육과정, 실습, 진로 연계에 대한 재학생 만족도 조사.",
    "sampleCount": 3,
    "estimatedItems": "6~9개",
    "blocks": [
      "INTRO",
      "ACADEMIC_INFO",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "교육과정에 대한 전반적 만족도",
      "실습/현장연계 프로그램 참여 경험",
      "개선이 필요한 부분"
    ]
  },
  {
    "id": "research_psych_scale",
    "category": "논문·학술연구용",
    "name": "심리척도 기반 연구 설문 (동의+표준화 척도)",
    "description": "심리학·상담 전공 논문에서 여러 표준화 척도(RSQ, CES-D 등)를 조합해 사용하는 유형. 문항수가 가장 많음(평균 20개+).",
    "sampleCount": 20,
    "estimatedItems": "20~40개(척도 다수 결합 시 최대 88개)",
    "blocks": [
      "INTRO",
      "CONSENT",
      "DEMO_BASIC",
      "SCREENING_YN",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "표준화 척도 문항군(복수, 척도별 5~20문항)",
      "연구 참여 중단 시 안내",
      "추가 연구 참여 의향"
    ]
  },
  {
    "id": "research_interview_screening",
    "category": "논문·학술연구용",
    "name": "인터뷰 참가자 사전 스크리닝 설문",
    "description": "본 인터뷰 전 자격요건을 걸러내는 짧은 사전 설문. 실제 인터뷰는 별도 진행.",
    "sampleCount": 12,
    "estimatedItems": "8~15개",
    "blocks": [
      "INTRO",
      "CONSENT",
      "DEMO_BASIC",
      "SCREENING_YN",
      "INTERVIEW_SCHEDULE",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "관련 경험 유무 및 기간",
      "인터뷰 소요시간 안내 동의",
      "선호 연락 방법"
    ]
  },
  {
    "id": "research_pre_post_experiment",
    "category": "논문·학술연구용",
    "name": "실험 참여형 사전/사후 설문",
    "description": "앱/서비스 효과성 검증을 위한 실험연구 — 사전설문과 사후설문이 별도로 존재하는 구조.",
    "sampleCount": 6,
    "estimatedItems": "15~30개",
    "blocks": [
      "INTRO",
      "CONSENT",
      "DEMO_BASIC",
      "SCREENING_YN",
      "LIKERT_ATTITUDE"
    ],
    "sampleQuestions": [
      "실험 참여 전 기저상태 측정 척도",
      "실험기간 중 준수사항 안내 동의",
      "사후 변화 인식 척도"
    ]
  },
  {
    "id": "research_thesis_survey",
    "category": "논문·학술연구용",
    "name": "사회조사형 학위논문 설문",
    "description": "학부/석사 졸업논문을 위한 표준 사회조사 설문. 인구통계+핵심변수 측정이 중심.",
    "sampleCount": 10,
    "estimatedItems": "15~25개",
    "blocks": [
      "INTRO",
      "CONSENT",
      "DEMO_BASIC",
      "ACADEMIC_INFO",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "독립변수 관련 척도 문항군",
      "종속변수 관련 척도 문항군",
      "인구통계학적 통제변수(소득/거주형태 등)"
    ]
  },
  {
    "id": "research_multilang_international",
    "category": "논문·학술연구용",
    "name": "다국어 지원 국제학생 대상 설문",
    "description": "유학생 등 비한국어 화자를 포함한 연구 — 한/영/중 등 다국어로 동일 설문 제공.",
    "sampleCount": 4,
    "estimatedItems": "10~20개",
    "blocks": [
      "INTRO",
      "CONSENT",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "국적/체류기간",
      "언어 사용 환경",
      "다국어 버전 선택 안내"
    ]
  },
  {
    "id": "research_group_interview_recruit",
    "category": "논문·학술연구용",
    "name": "그룹인터뷰(FGI)/좌담회 참가자 모집 설문",
    "description": "여러 명이 모여 진행하는 좌담회 형식의 참가자 모집 겸 사전 설문.",
    "sampleCount": 4,
    "estimatedItems": "8~14개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "ACADEMIC_INFO",
      "SCREENING_YN",
      "INTERVIEW_SCHEDULE",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "관련 주제에 대한 사전 관심도/경험",
      "그룹 구성을 위한 배경정보(진로방향 등)"
    ]
  },
  {
    "id": "startup_new_app_demand",
    "category": "수요검증(학생창업·공모전)",
    "name": "신규 앱/서비스 수요조사형",
    "description": "학생 창업팀이 기획 중인 앱/서비스에 대한 잠재 수요와 기능 니즈를 검증하는 가장 대표적인 유형.",
    "sampleCount": 40,
    "estimatedItems": "6~10개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "NEEDS_PRIORITY",
      "OPEN_FEEDBACK",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "현재 이 문제를 어떻게 해결하고 있는지(대체수단)",
      "서비스 이용 시 예상되는 우려사항",
      "베타테스트 참여 의향"
    ]
  },
  {
    "id": "startup_product_preference",
    "category": "수요검증(학생창업·공모전)",
    "name": "제품·브랜드 선호도 조사형 (신제품 컨셉테스트)",
    "description": "특정 제품 카테고리(화장품·식품 등)에 대한 소비 습관과 신제품 컨셉 반응을 묻는 유형.",
    "sampleCount": 20,
    "estimatedItems": "6~10개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "평소 구매 시 중요하게 보는 요소(가격/성분/디자인 등)",
      "제시된 컨셉 이미지에 대한 반응",
      "적정 가격대"
    ]
  },
  {
    "id": "startup_service_from_experience",
    "category": "수요검증(학생창업·공모전)",
    "name": "이용경험 기반 서비스 기획형 (알바/여행/소비 등)",
    "description": "특정 경험(아르바이트, 여행, 자취 등)의 불편함을 파악해 서비스로 발전시키는 유형.",
    "sampleCount": 18,
    "estimatedItems": "6~10개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "NEEDS_PRIORITY",
      "OPEN_FEEDBACK",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "해당 경험 중 가장 불편했던 순간(주관식)",
      "기존 서비스/앱 사용 여부 및 불만족 이유",
      "원하는 해결방식"
    ]
  },
  {
    "id": "startup_segment_market_research",
    "category": "수요검증(학생창업·공모전)",
    "name": "특정 타겟 세그먼트 시장조사형",
    "description": "20대 여성, 자취생 등 특정 세그먼트를 좁혀 소비/행동 패턴을 조사하는 유형.",
    "sampleCount": 15,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "ACADEMIC_INFO",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE"
    ],
    "sampleQuestions": [
      "세그먼트 특성을 확인하는 스크리닝 문항",
      "해당 세그먼트 특유의 소비 패턴",
      "타겟 맞춤 서비스에 대한 반응"
    ]
  },
  {
    "id": "startup_consumption_habit",
    "category": "수요검증(학생창업·공모전)",
    "name": "소비 습관 및 니즈 조사형",
    "description": "음주, 패션, 여행 등 특정 소비 카테고리의 습관/빈도/선호를 폭넓게 조사.",
    "sampleCount": 10,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "소비 빈도 및 예산",
      "선호 브랜드/채널",
      "정보 탐색 경로(SNS/지인추천 등)"
    ]
  },
  {
    "id": "startup_campus_convenience",
    "category": "수요검증(학생창업·공모전)",
    "name": "캠퍼스 생활 편의 서비스 수요조사형",
    "description": "월경용품 스테이션, 무인 세탁실, 셔틀버스 등 캠퍼스 내 편의 서비스 수요·불편 조사.",
    "sampleCount": 8,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "ACADEMIC_INFO",
      "USAGE_EXPERIENCE",
      "NEEDS_PRIORITY",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "현재 시설/서비스 이용 시 불편사항",
      "희망 설치/운영 장소",
      "이용 가능 시간대"
    ]
  },
  {
    "id": "corp_brand_awareness",
    "category": "기업마케팅(스타트업·기업 캠페인)",
    "name": "브랜드 인지도·이미지 조사형",
    "description": "기업이 자사 브랜드의 인지도, 이미지, 연상 요소를 확인하는 조사.",
    "sampleCount": 8,
    "estimatedItems": "5~8개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "브랜드 인지 경로",
      "브랜드 이미지 연상 단어(주관식/체크박스)",
      "재구매/재이용 의향"
    ]
  },
  {
    "id": "corp_new_product_concept",
    "category": "기업마케팅(스타트업·기업 캠페인)",
    "name": "신제품 컨셉/이용의향 조사형",
    "description": "출시 예정 신제품에 대한 사전 반응과 구매의향을 조사.",
    "sampleCount": 6,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "NEEDS_PRIORITY",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "컨셉에 대한 첫인상",
      "기존 유사 제품 대비 매력도",
      "구매의향 및 적정가격"
    ]
  },
  {
    "id": "corp_app_feature_preference",
    "category": "기업마케팅(스타트업·기업 캠페인)",
    "name": "앱/서비스 이용경험 및 신기능 선호도 조사형",
    "description": "기업 자사 앱의 기존 기능 이용경험과 신규 기능 선호도를 조사(간편인증/파일첨부 동반 사례 많음).",
    "sampleCount": 7,
    "estimatedItems": "5~9개",
    "blocks": [
      "INTRO",
      "USAGE_EXPERIENCE",
      "LIKERT_ATTITUDE",
      "NEEDS_PRIORITY",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "가장 자주 쓰는 기능",
      "신규 기능 후보에 대한 선호 순위",
      "간편 가입/인증 인증사진 첨부(해당시)"
    ]
  },
  {
    "id": "corp_campaign_event",
    "category": "기업마케팅(스타트업·기업 캠페인)",
    "name": "캠페인/이벤트 참여형 설문",
    "description": "브랜드 팝업, 페스티벌 등 이벤트 현장 또는 온라인 참여형 설문.",
    "sampleCount": 5,
    "estimatedItems": "4~7개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "CONTACT_REWARD"
    ],
    "sampleQuestions": [
      "이벤트 참여 경로",
      "만족도 및 재참여 의향",
      "SNS 공유 여부"
    ]
  },
  {
    "id": "corp_csr_policy_perception",
    "category": "기업마케팅(스타트업·기업 캠페인)",
    "name": "정책/사회이슈 관련 기업-대학생 인식조사형",
    "description": "기업 또는 공공기관이 특정 정책·환경 이슈에 대한 대학생 인식과 제안을 수렴하는 유형.",
    "sampleCount": 3,
    "estimatedItems": "5~8개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "LIKERT_ATTITUDE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "해당 정책/이슈 인지 여부",
      "정책에 대한 찬반 및 이유",
      "제안하고 싶은 정책 아이디어"
    ]
  },
  {
    "id": "media_interviewee_recruit",
    "category": "기타(언론보도/개인부탁 등)",
    "name": "언론 인터뷰이/취재원 모집형",
    "description": "학보사·언론사가 기획기사를 위해 인터뷰 대상자나 설문 응답자를 모집하는 유형. 리워드 없는 경우가 많음.",
    "sampleCount": 3,
    "estimatedItems": "4~7개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "ACADEMIC_INFO",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "관련 경험 유무",
      "인터뷰 응할 의향 및 연락처",
      "기사에 실명/익명 여부"
    ]
  },
  {
    "id": "personal_quick_survey",
    "category": "기타(언론보도/개인부탁 등)",
    "name": "개인 리서치용 간단 설문형",
    "description": "지인부탁, 개인 프로젝트 등 격식 없이 짧게 진행하는 설문.",
    "sampleCount": 2,
    "estimatedItems": "3~5개",
    "blocks": [
      "INTRO",
      "DEMO_BASIC",
      "USAGE_EXPERIENCE",
      "OPEN_FEEDBACK"
    ],
    "sampleQuestions": [
      "간단한 경험/의견 확인 문항 1~2개"
    ]
  }
];
