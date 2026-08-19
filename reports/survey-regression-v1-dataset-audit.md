# 바로폼 설문 회귀 v1.1 데이터셋 감사

- 원본: survey-regression-v1-original (100건, Dev 80 / Seen Holdout 20)
- 감사본: survey-regression-v1.1-audited (100건, Dev 80 / Seen Holdout 20)
- 감사 기준일: 2026-08-19T00:00:00.000Z
- 분포: clear 73, noisy_recoverable 19, ambiguous 8, invalid_test_sentence 0
- 조치: keep 73, noisy 유지 18, clear/noisy 분리 1, clarification 재확인 8, 교체 0

## dev-complex-011

- 자연스러움: noisy_recoverable
- 우세 해석: 최근 한 달 내 별마루 카페 이용 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사
- 적격 조건: 최근 한 달 내 별마루 카페 이용
- 맥락 장소: 별마루 카페
- 조사 대상: 별마루 카페의 새 메뉴
- 조사 목적: 새 메뉴 만족도
- screeningExpected: true
- 일반적인 카페 이용 경험은 독립 조사 목적이 아니며, 이용 적격성 확인으로 평가함.

## 전체 사례 판정

| caseId | inputQuality | action | input |
| --- | --- | --- | --- |
| dev-general-014 | clear | keep_as_is | 동네 주민의 당근 앱 이용 목적과 거래 만족도 |
| dev-complex-012 | noisy_recoverable | keep_as_noisy_recoverable | 동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기 |
| dev-general-008 | clear | keep_as_is | 자전거와 전동킥보드로 출퇴근하는 사람들의 이동 시간과 안전 경험 비교 |
| dev-complex-002 | clear | keep_as_is | 배달 앱 한 개를 이용하는 1인 가구의 주문 습관과 지출, 구독 혜택 수요 |
| dev-past-010 | noisy_recoverable | keep_as_noisy_recoverable | 네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지 |
| dev-general-001 | clear | keep_as_is | 새봄대학교 심리학과 1학년의 이번 학기 온라인 강의 만족도 |
| dev-general-004 | clear | keep_as_is | 통계학 강의와 프로그래밍 강의가 데이터 분석 자신감에 미치는 영향을 비교 |
| dev-general-016 | clear | keep_as_is | iOS용 공부 앱과 안드로이드용 공부 앱의 사용성 및 지속 사용 의향 비교 |
| dev-general-003 | clear | keep_as_is | 진로 특강에 참여하지 않은 대학생의 불참 이유와 향후 참여 의향 |
| dev-clarify-003 | ambiguous | relabel_as_clarification | 시설 이용 |
| dev-general-005 | clear | keep_as_is | 새봄대학교 학생의 솔빛관 접근성과 이동 불편 |
| dev-general-031 | clear | keep_as_is | 주 1회도 운동하지 않는 성인의 운동 방해 요인 |
| dev-general-021 | clear | keep_as_is | 대학생 팀플에서 역할 분담 공정성과 의사소통 만족도 |
| dev-general-012 | clear | keep_as_is | 새봄대학교 별마루 식당과 해오름 식당의 가격·맛·대기시간 비교 |
| dev-past-020 | noisy_recoverable | keep_as_noisy_recoverable | 맛나샘 학생들 맛 서비스 둘다 어떤지 불편도 |
| dev-complex-007 | clear | keep_as_is | 버스 통근자와 지하철 통근자의 소요 시간·혼잡·피로 비교 |
| dev-past-003 | noisy_recoverable | keep_as_noisy_recoverable | 경영대생들 경영대 시설 괜찮았는지랑 불편했던 점 조사 |
| dev-general-023 | clear | keep_as_is | 원격근무 팀원의 협업 도구 피로와 소속감 |
| dev-past-017 | clear | keep_as_is | 맛나샘을 이용하는 학생들의 만족도와 개선 의견 |
| dev-general-027 | clear | keep_as_is | 넷플릭스와 티빙 구독자의 이용 빈도·콘텐츠 만족도 비교 |
| dev-complex-005 | clear | keep_as_is | 새봄대학교 솔빛관과 별마루관의 접근성·혼잡·안전 비교 |
| dev-complex-008 | clear | keep_as_is | 온라인 멘토링과 대면 멘토링에 참여한 청년의 도움 정도와 지속 참여 의향 비교 |
| dev-clarify-004 | ambiguous | relabel_as_clarification | 학생들 생각 |
| dev-past-009 | noisy_recoverable | keep_as_noisy_recoverable | 국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험 |
| dev-complex-004 | clear | keep_as_is | 지역 체육관을 다니는 주민의 이용 패턴, 불편, 재등록 의향 |
| dev-complex-013 | clear | keep_as_is | 대학생의 월 용돈 규모가 외식 빈도와 충동구매에 미치는 영향 |
| dev-past-005 | clear | keep_as_is | 연세대학교 학생들의 대우관 등하교 경험 |
| dev-clarify-006 | ambiguous | relabel_as_clarification | 두 개 비교 |
| dev-general-015 | clear | keep_as_is | 모바일 뱅킹을 사용하지 않는 고령층의 디지털 장벽 |
| dev-noisy-006 | noisy_recoverable | keep_as_noisy_recoverable | 팀플 팀플 갈등 해결 어케하는지 조사좀 |
| dev-past-007 | clear | keep_as_is | 지난달 연세대 재학생이 대우관을 방문한 빈도와 혼잡·안전 경험 조사 |
| dev-clarify-002 | ambiguous | relabel_as_clarification | 앱 조사 |
| dev-past-013 | clear | keep_as_is | 연세대학교 학생들의 한경관 학식 이용 경험 |
| dev-general-028 | clear | keep_as_is | 지역 주민의 공공자전거 이용 경험과 요금 만족도 |
| dev-past-016 | clear | keep_as_is | 연세대 학생이 한경관 학식과 고를샘 식당을 선택하는 이유와 만족도 비교 |
| dev-general-032 | clear | keep_as_is | 독서와 팟캐스트 청취를 여가로 즐기는 사람들의 시간 사용과 만족도 비교 |
| dev-complex-001 | clear | keep_as_is | 새봄대학교 중앙도서관 한 곳의 좌석 만족도, 혼잡 경험, 예약 기능 수요 |
| dev-general-030 | clear | keep_as_is | 최근 한 달 직장인의 SNS 하루 이용 시간과 피로감 |
| dev-general-018 | clear | keep_as_is | 동아리에 가입하지 않은 학생의 미가입 이유와 관심 활동 |
| dev-general-007 | clear | keep_as_is | 휠체어 이용자가 공공도서관에 방문할 때 겪는 접근성 문제 |
| dev-complex-006 | clear | keep_as_is | 온새미 플랫폼과 별마루 서비스 사용자의 편의성 및 신뢰도 차이 |
| dev-general-024 | noisy_recoverable | keep_as_noisy_recoverable | 새봄대 학생들 학교생활 시간관리랑 스트레스 |
| dev-general-011 | clear | keep_as_is | 편의점 간편식을 구매하지 않는 20대의 미구매 이유 |
| dev-clarify-005 | ambiguous | relabel_as_clarification | 서비스 개선 |
| dev-general-022 | clear | keep_as_is | 교내 상담센터를 이용하지 않은 학생의 인지도와 이용 장벽 |
| dev-complex-003 | clear | keep_as_is | 학생상담 프로그램을 모르는 재학생의 인지도, 비이용 이유, 이용 의향 |
| dev-general-009 | clear | keep_as_is | 새봄대학교 학생이 별마루 카페를 이용하는 빈도와 메뉴 만족도 |
| dev-complex-015 | clear | keep_as_is | 통학 시간이 대학생의 학교생활 만족도에 미치는 영향과 교통수단별 차이 |
| dev-complex-009 | clear | keep_as_is | 새봄대학교 학생에게 솔빛관을 오갈 때 느끼는 혼잡과 안전을 묻고 싶어 |
| dev-general-029 | clear | keep_as_is | 대학생의 평일 수면 시간과 수업 집중도의 관계 |
| dev-complex-016 | clear | keep_as_is | 청소년의 하루 화면 이용 시간이 학습 집중도와 수면 만족도에 미치는 관계 |
| dev-complex-010 | clear | keep_as_is | 별마루 서비스를 안 쓰는 직장인 대상으로 서비스가 어려운 이유랑 필요한 기능 |
| dev-general-006 | clear | keep_as_is | 출근하는 직장인의 환승역 혼잡과 이동 안전 체감 |
| dev-general-013 | clear | keep_as_is | 새봄대학교 구성원의 온새미 플랫폼 사용성과 오류 경험 |
| dev-general-020 | clear | keep_as_is | 멘토링 프로그램과 취업 캠프 참가자의 도움 정도 및 만족도 비교 |
| dev-noisy-005 | noisy_recoverable | keep_as_noisy_recoverable | 최근3달 배달 안시킨 1인가구 왜 |
| dev-general-026 | clear | keep_as_is | 친환경 세제를 구매하지 않는 소비자의 미구매 이유와 가격 수용도 |
| dev-past-012 | clear | keep_as_is | 대학생이 네이버 웹툰과 카카오페이지를 이용하는 빈도와 만족도를 비교 |
| dev-general-010 | clear | keep_as_is | 재택근무자의 배달음식 주문 빈도와 지출 부담 |
| dev-general-019 | clear | keep_as_is | 지역 주민이 봄꽃 축제에 참여한 경험과 지역 상권 효과에 대한 인식 |
| dev-noisy-001 | noisy_recoverable | keep_as_noisy_recoverable | 새봄대 솔빛관 이동 불편 뭐가 젤 큰지 |
| dev-past-019 | clear | keep_as_is | 최근 한 달 맛나샘 이용 학생의 방문 빈도와 음식 만족도 |
| dev-clarify-001 | ambiguous | relabel_as_clarification | 학교 만족도 |
| dev-noisy-004 | noisy_recoverable | keep_as_noisy_recoverable | 온새미앱 써본사람 불편 만족 |
| dev-complex-014 | clear | keep_as_is | 직장인의 평일 수면 시간과 지각 빈도의 상관관계 |
| dev-past-006 | noisy_recoverable | keep_as_noisy_recoverable | 대우관 오갈 때 학생들 이동수단이랑 얼마나 걸리는지, 뭐가 불편한지 |
| dev-general-025 | clear | keep_as_is | 최근 3개월 1인 가구의 장보기 빈도와 물가 부담 |
| dev-noisy-003 | noisy_recoverable | keep_as_noisy_recoverable | 동아리 안함 이유 이유랑 가입생각 |
| dev-past-018 | noisy_recoverable | keep_as_noisy_recoverable | 맛나샘 안 가는 학생들 이유 조사해줘 |
| dev-general-017 | clear | keep_as_is | 새봄대학교 축제 참가자의 프로그램 만족도와 재참여 의향 |
| dev-past-015 | noisy_recoverable | keep_as_noisy_recoverable | 이번 학기 연세대생 한경관 학식 얼마나 자주 먹고 메뉴에는 만족하는지 |
| dev-complex-011 | noisy_recoverable | rewrite_for_clear_split | 새 메뉴 만족도는 별마루 카페를 최근 한 달 이용한 주민한테 조사 |
| dev-past-001 | noisy_recoverable | keep_as_noisy_recoverable | 경영대에 대한 연세대 경영대생들 만족도 |
| dev-past-002 | clear | keep_as_is | 최근 한 학기 동안 연세대 경영대생이 느낀 경영대 시설 만족도와 개선점을 조사해줘 |
| dev-noisy-002 | noisy_recoverable | keep_as_noisy_recoverable | 직장인 커피값 얼마나씀... 주에 |
| dev-past-004 | clear | keep_as_is | 경영대 시설을 이용하지 않는 연세대 경영대생의 비이용 이유와 학교 이미지 |
| dev-general-002 | clear | keep_as_is | 직장인이 퇴근 후 듣는 야간 강좌의 학습 효과와 어려움 |
| dev-past-014 | clear | keep_as_is | 한경관 학식을 먹지 않는 연세대 학생들의 비이용 이유 |
| dev-past-008 | clear | keep_as_is | 대우관에 가지 않는 연세대 학생이 방문하지 않는 이유 |
| dev-past-011 | clear | keep_as_is | 최근 3개월 대학생의 네이버 웹툰 이용 빈도와 이용 시간 조사 |
| holdout-general-006 | clear | keep_as_is | 프로젝트 팀원이 회의에 참여하지 못한 이유와 비동기 협업 수요 |
| holdout-general-007 | clear | keep_as_is | 지난 6개월 반려동물 가구의 온라인 사료 구매 빈도와 가격 민감도 |
| holdout-complex-004 | clear | keep_as_is | 최근 한 달 해든 서비스 알림을 받았지만 클릭하지 않은 이용자에게 이유와 개선점을 묻기 |
| holdout-past-003 | clear | keep_as_is | 다온 플랫폼을 쓰는 취업준비생의 이용 현황과 경험 |
| holdout-clarify-001 | ambiguous | relabel_as_clarification | 공간 평가 |
| holdout-general-008 | clear | keep_as_is | 주말에 영상 콘텐츠를 보지 않는 성인의 여가 선택 이유 |
| holdout-general-003 | clear | keep_as_is | 최근 2주 해든 푸드트럭 이용자의 방문 빈도와 대기 만족도 |
| holdout-general-005 | clear | keep_as_is | 지역 독서모임에 참가하지 않은 주민의 불참 이유와 관심 주제 |
| holdout-past-002 | clear | keep_as_is | 한울대학교 재학생의 늘봄관 통학 및 이동 경험 |
| holdout-complex-001 | clear | keep_as_is | 한울대학교 늘봄관 한 곳의 학습 공간 만족도와 예약 좌석 기능 수요 |
| holdout-past-001 | clear | keep_as_is | 한울대 경영학부 학생이 느끼는 경영학관 시설 만족도 |
| holdout-complex-002 | clear | keep_as_is | 도보 통근과 자가용 통근의 이동 시간, 비용, 스트레스 차이 |
| holdout-complex-003 | clear | keep_as_is | 청년의 월세 부담이 외식 횟수와 저축 비율에 미치는 영향 |
| holdout-clarify-002 | ambiguous | relabel_as_clarification | 둘 중 뭐가 나은지 |
| holdout-noisy-002 | noisy_recoverable | keep_as_noisy_recoverable | 다온앱 요즘 안씀 이유 다시쓸지 |
| holdout-noisy-001 | noisy_recoverable | keep_as_noisy_recoverable | 한울대 늘봄관 안감 왜 불편 |
| holdout-past-004 | clear | keep_as_is | 해든 서비스를 이용하지 않는 청년의 비이용 이유와 필요한 지원 |
| holdout-general-002 | clear | keep_as_is | 늘봄관에 방문하지 않는 한울대 학생의 접근 장벽 |
| holdout-general-001 | clear | keep_as_is | 한울대학교 교양 수업 수강생의 토론 참여 경험과 만족도 |
| holdout-general-004 | clear | keep_as_is | 다온 플랫폼과 해든 서비스의 고객 지원 만족도 비교 |

