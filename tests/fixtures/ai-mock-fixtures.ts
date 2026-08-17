type MockQuestion = {
  id: number;
  title: string;
  type: "single" | "multiple" | "scale" | "shortText" | "text";
  options?: string[];
  required: boolean;
  nextByOption?: Record<string, number | "submit">;
};

type MockSurvey = { title: string; description: string; questions: MockQuestion[] };

const base = (title: string, questions: MockQuestion[]): MockSurvey => ({
  title,
  description: `${title}를 위한 비용 없는 테스트 설문입니다.`,
  questions,
});

export const aiMockFixtures = {
  objective: base("일반 객관식 설문", [
    { id: 1, title: "이용 경험이 있나요?", type: "single", options: ["있음", "없음"], required: true },
  ]),
  likert: base("리커트 척도 설문", [
    { id: 1, title: "전반적으로 만족하나요?", type: "scale", required: true },
  ]),
  branching: base("분기 설문", [
    { id: 1, title: "참여한 적이 있나요?", type: "single", options: ["예", "아니요"], required: true, nextByOption: { 예: 2, 아니요: "submit" } },
    { id: 2, title: "참여 경험은 어땠나요?", type: "text", required: false },
  ]),
  openEnded: base("주관식 포함 설문", [
    { id: 1, title: "개선할 점을 적어주세요.", type: "text", required: false },
  ]),
  fileReference: base("파일 참고 설문", [
    { id: 1, title: "자료에서 가장 중요했던 내용은 무엇인가요?", type: "shortText", required: true },
  ]),
  invalidBranch: base("잘못된 분기 fixture", [
    { id: 1, title: "계속할까요?", type: "single", options: ["예", "아니요"], required: true, nextByOption: { 예: 99, 아니요: "submit" } },
  ]),
} satisfies Record<string, MockSurvey>;
