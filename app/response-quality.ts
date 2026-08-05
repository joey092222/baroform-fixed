export type QualityQuestion = {
  id: number;
  title: string;
  type: string;
  required?: boolean;
};

export type QualityAnswer = {
  questionId: number;
  title?: string;
  type: string;
  value: number | string | string[];
};

export type ResponseQuality = {
  score: number;
  status: "usable" | "review" | "exclude";
  reasons: string[];
};

type QualityInput = {
  answers: QualityAnswer[];
  questions: QualityQuestion[];
  completionSeconds: number;
  durationMinutes: number;
};

function normalizedText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function responseTextFingerprint(answers: QualityAnswer[]) {
  const text = answers
    .filter((answer) => answer.type === "shortText" || answer.type === "text")
    .map((answer) => normalizedText(String(answer.value)))
    .filter((value) => value.length >= 12)
    .join("|");
  return text.length >= 12 ? text : "";
}

export function assessResponseQuality({
  answers,
  questions,
  completionSeconds,
  durationMinutes,
}: QualityInput): ResponseQuality {
  let score = 100;
  const reasons: string[] = [];
  const expectedSeconds = Math.max(60, durationMinutes * 60);

  if (completionSeconds > 0 && completionSeconds < Math.max(12, expectedSeconds * 0.28)) {
    score -= 35;
    reasons.push("예상 시간보다 지나치게 빠른 제출");
  }

  const answeredIds = new Set(answers.map((answer) => answer.questionId));
  const missingRequired = questions.filter(
    (question) => question.type !== "section" && question.required && !answeredIds.has(question.id),
  ).length;
  if (missingRequired > 0) {
    score -= Math.min(35, missingRequired * 15);
    reasons.push(`필수 응답 ${missingRequired}개 누락`);
  }

  const choiceValues = answers
    .filter((answer) => ["scale", "single", "dropdown"].includes(answer.type))
    .map((answer) => String(answer.value));
  if (choiceValues.length >= 4) {
    const counts = new Map<string, number>();
    choiceValues.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    const largest = Math.max(...counts.values());
    if (largest / choiceValues.length >= 0.8) {
      score -= 25;
      reasons.push("같은 선택을 반복한 직선형 응답");
    }
  }

  const freeTexts = answers
    .filter((answer) => answer.type === "shortText" || answer.type === "text")
    .map((answer) => String(answer.value).trim())
    .filter(Boolean);
  const normalized = freeTexts.map(normalizedText).filter(Boolean);
  if (normalized.length >= 2 && new Set(normalized).size < normalized.length) {
    score -= 20;
    reasons.push("동일한 주관식 문구 반복");
  }
  if (
    freeTexts.some(
      (value) =>
        /(.)\1{4,}/u.test(value) ||
        /(?:asdf|qwer|zxcv|ㅁㄴㅇ|ㄹㄹㄹ|테스트테스트)/iu.test(value) ||
        (value.length >= 4 && normalizedText(value).length / value.length < 0.35),
    )
  ) {
    score -= 25;
    reasons.push("의미를 확인하기 어려운 주관식 응답");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  return {
    score: boundedScore,
    status: boundedScore >= 75 ? "usable" : boundedScore >= 45 ? "review" : "exclude",
    reasons,
  };
}

export function addBatchQualityFlags(
  quality: ResponseQuality,
  flags: { duplicateDevice?: boolean; duplicateText?: boolean },
): ResponseQuality {
  const reasons = [...quality.reasons];
  let score = quality.score;
  if (flags.duplicateDevice) {
    score -= 25;
    reasons.push("같은 기기에서 반복 제출된 패턴");
  }
  if (flags.duplicateText) {
    score -= 25;
    reasons.push("다른 응답과 동일한 긴 주관식 문구");
  }
  score = Math.max(0, score);
  return {
    score,
    status: score >= 75 ? "usable" : score >= 45 ? "review" : "exclude",
    reasons: [...new Set(reasons)],
  };
}
