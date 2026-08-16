import { lookupVerifiedSurveyKnowledge } from "./survey-knowledge";

export type SurveyQuestionType =
  | "scale"
  | "single"
  | "multiple"
  | "dropdown"
  | "shortText"
  | "text"
  | "date"
  | "time"
  | "section";

export type SurveyQuestion = {
  id: number;
  title: string;
  reason: string;
  type: SurveyQuestionType;
  options?: string[];
  required: boolean;
  description?: string;
  shuffleOptions?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  showIf?: Array<{
    questionId: number;
    operator: "equals" | "notEquals" | "contains" | "notContains";
    value: string;
  }>;
};

export function resizeSurveyQuestions(
  questions: SurveyQuestion[],
  requestedCount: number,
) {
  const count = Math.min(30, Math.max(1, Math.round(requestedCount)));
  if (questions.length >= count) {
    return questions.slice(0, count).map((question, index) => ({
      ...question,
      id: index + 1,
    }));
  }

  const result = questions.map((question) => ({ ...question }));
  const lastText = [...result].reverse().find((question) => question.type === "text");
  if (lastText && result.length < count) {
    result.splice(result.indexOf(lastText), 1);
  }
  while (result.length < count - (lastText ? 1 : 0)) {
    const number = result.length + 1;
    result.push({
      id: number,
      title: `이 주제와 관련해 중요하게 생각하는 요소 ${number - 1}은 어느 정도인가요?`,
      reason: "조사 주제의 세부 경험을 빠짐없이 확인하기 위한 질문이에요.",
      type: "scale",
      required: true,
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "전혀 그렇지 않음",
      scaleMaxLabel: "매우 그러함",
    });
  }
  if (lastText && result.length < count) result.push(lastText);
  return result.slice(0, count).map((question, index) => ({
    ...question,
    id: index + 1,
  }));
}

export type SurveyIntentKind =
  | "membership"
  | "problem"
  | "satisfaction"
  | "event"
  | "adoption"
  | "usage"
  | "needs"
  | "awareness"
  | "adaptation"
  | "general";

export type SurveyDomain =
  | "department"
  | "course"
  | "club"
  | "event"
  | "library"
  | "cafeteria"
  | "dormitory"
  | "building"
  | "service"
  | "facility"
  | "student-life"
  | "general";

export type SurveyMeasurementKind =
  | "duration"
  | "frequency"
  | "cost"
  | "quantity"
  | "preference"
  | "reason";

export type SurveyMeasurement = {
  kind: SurveyMeasurementKind;
  target: string;
  metricLabel: string;
  sourceTopic: string;
};

export type SurveySemantics = {
  respondentGroup: string | null;
  evaluationTarget: string;
  explicitTopic: string | null;
  measurement: SurveyMeasurement | null;
  kind: SurveyIntentKind;
  domain: SurveyDomain;
  goalLabel: string;
  requestedAsOpinion: boolean;
  topicWasInferred: boolean;
  assumptions: string[];
};

export type SurveyBlueprint = {
  kind: SurveyIntentKind;
  intentLabel: string;
  subject: string;
  title: string;
  description: string;
  templateTitle: string;
  templateSummary: string;
  detectedSignals: string[];
  templateQuestions: SurveyQuestion[];
  aiQuestions: SurveyQuestion[];
  respondentGroup?: string | null;
  evaluationTarget?: string;
  goal?: string;
  assumptions?: string[];
  aiTitle?: string;
  domain?: SurveyDomain;
};

export type SurveyBrief = {
  rawBrief: string;
  normalizedBrief: string;
  surveyTitle: string;
  researchSubject: string;
  researchContext: string | null;
  targetRespondents: string;
  researchGoal: string;
  recommendedTimeframe: string;
  dimensions: string[];
  excludedPhrases: string[];
  kind: SurveyIntentKind;
  domain: SurveyDomain;
  semantics: SurveySemantics;
};

const normalizePrompt = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

const personHead =
  "(?:학생|대학생|대학원생|중학생|고등학생|신입생|새내기|재학생|졸업생|교환학생|복학생|수강생|수강자|직장인|청년|이용자|비이용자|사용자|소비자|가입자|회원|참여자|참가자|참석자|방문객|관람객|구매자|고객|직원|교직원|교수|교사|조교|주민|거주자|거주생|자취생|기숙사생|학부모|응답자|지원자|20대|\\d{2}학번)";

const eventCue =
  /(축제|행사|공연|세미나|워크숍|오리엔테이션|아카라카|대동제|박람회|OT(?:\s|$)|참여자|참가자|참석자|관람객)/i;

const consumptionHabitCue =
  /(?:소비|지출|구매)\s*(?:습관|행태|패턴)|(?:소비|지출)\s*실태/;

const sleepDurationCue =
  /(?:평균\s*)?(?:하루\s*)?(?:수면|잠(?:을\s*)?자는)\s*(?:시간|시간대|패턴)|(?:취침|기상)\s*시간|수면량/;

const actionFrequencyCue =
  /(카공|공부|학습|운동|독서|외식|음주|흡연|쇼핑|구매|주문|배달|방문|이용|사용|참여|관람|게임|통학|등하교|아르바이트|지각|결석|여행|모임|식사|간식|커피|카페)/;

function stripRequestWrapper(value: string) {
  let prompt = normalizePrompt(value)
    .replace(
      /^(?:설문(?:\s*조사)?|조사)\s*(?:주제는|내용은|목적은|:)?\s*/g,
      "",
    )
    .replace(
      /\s*(?:설문(?:\s*조사)?|조사)(?:를|을)?\s*(?:만들어|작성해|제작해|진행해|실시해|구성해)(?:\s*줘|\s*주세요|줘|주세요)?$/g,
      "",
    )
    .replace(
      /\s*(?:을|를)?\s*조사(?:해\s*줘|해줘|해주세요|해\s*주세요|해\s*달라|해달라|하라|하고\s*싶(?:어|어요|습니다))$/g,
      "",
    )
    .replace(
      /\s*(?:을|를)?\s*(?:분석|파악|확인|알아보)(?:해\s*줘|해줘|해주세요|해\s*주세요|하고\s*싶(?:어|어요|습니다)|고\s*싶(?:어|어요|습니다))$/g,
      "",
    )
    .replace(
      /\s*(?:에\s*대한|에\s*관한)\s*(?:설문\s*조사|설문|조사)$/g,
      "",
    )
    .replace(/\s*(?:설문|조사)\s*(?:만들기|제작)$/g, "")
    .replace(
      /\s*[,，]?\s*(?:(?:이를|그\s*결과를?)\s*바탕으로)\s+.+$/g,
      "",
    )
    .replace(
      /\s*(?:에\s*대해|에\s*대한|에\s*관해|에\s*관한)?\s*조사하고$/g,
      "",
    )
    .trim();

  for (let pass = 0; pass < 2; pass += 1) {
    prompt = prompt
      .replace(/\s*(?:에\s*대한|에\s*관한|관련)\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return prompt;
}

export type DirectProportionIntent = {
  population: string;
  qualifyingGroup: string;
  conditionLabel: string;
};

export function parseDirectProportionRequest(
  rawPrompt: string,
): DirectProportionIntent | null {
  const prompt = stripRequestWrapper(rawPrompt);
  const match = prompt.match(
    /^(.+?)\s*중\s+(.+?)(?:의)?\s*(?:비율|비중|퍼센트)$/,
  );
  if (!match) return null;

  const population = match[1]
    .replace(/(?:들)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const qualifyingGroup = match[2]
    .replace(/\s+/g, " ")
    .trim();
  const conditionLabel = qualifyingGroup
    .replace(/\s*(?:학생|사람|응답자)(?:들)?$/g, "")
    .replace(/\s*(?:(?:을|를)\s*)?하는$/g, "")
    .replace(/\s*중인$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!population || !qualifyingGroup || !conditionLabel) return null;
  return { population, qualifyingGroup, conditionLabel };
}

export function isSimpleProportionSurveyRequest(rawPrompt: string) {
  return parseDirectProportionRequest(rawPrompt) !== null;
}

function measurementFromTopic(topic: string): SurveyMeasurement | null {
  const normalized = topic.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const durationMatch = normalized.match(
    /((?:이용|사용|소요|체류|대기|공부|학습|운동|시청|게임|통학|등하교|근무|활동|수면)\s*)?시간$/,
  );
  if (durationMatch) {
    const target = normalized.replace(/\s*시간$/, "").trim();
    if (target) {
      return {
        kind: "duration",
        target,
        metricLabel: durationMatch[0].trim() || "시간",
        sourceTopic: normalized,
      };
    }
  }

  const frequencyMatch = normalized.match(/(?:빈도|횟수)$/);
  if (frequencyMatch) {
    const target = normalized.replace(/\s*(?:빈도|횟수)$/, "").trim();
    if (target) {
      return {
        kind: "frequency",
        target,
        metricLabel: frequencyMatch[0],
        sourceTopic: normalized,
      };
    }
  }

  const costMatch = normalized.match(
    /(?:(?:일|주|월|학기|연간)\s*(?:평균\s*)?)?(?:지출\s*)?(?:금액|비용|지출액|소비액|결제액)$/,
  );
  if (costMatch) {
    const target = normalized.slice(0, -costMatch[0].length).trim();
    if (target) {
      return {
        kind: "cost",
        target,
        metricLabel: costMatch[0].trim(),
        sourceTopic: normalized,
      };
    }
  }

  const quantityMatch = normalized.match(
    /(?:이용량|사용량|섭취량|소비량|수량|개수|건수)$/,
  );
  if (quantityMatch) {
    const target = normalized.slice(0, -quantityMatch[0].length).trim();
    if (target) {
      return {
        kind: "quantity",
        target,
        metricLabel: quantityMatch[0],
        sourceTopic: normalized,
      };
    }
  }

  const preferenceMatch = normalized.match(/(?:선호|선호도)$/);
  if (preferenceMatch) {
    const target = normalized.slice(0, -preferenceMatch[0].length).trim();
    if (target) {
      return {
        kind: "preference",
        target,
        metricLabel: preferenceMatch[0],
        sourceTopic: normalized,
      };
    }
  }

  const reasonMatch = normalized.match(/(?:이유|원인)$/);
  if (reasonMatch) {
    const target = normalized.slice(0, -reasonMatch[0].length).trim();
    if (target) {
      return {
        kind: "reason",
        target,
        metricLabel: reasonMatch[0],
        sourceTopic: normalized,
      };
    }
  }

  return null;
}

export function parseExplicitSurveyMeasurement(
  rawPrompt: string,
): SurveyMeasurement | null {
  const prompt = stripRequestWrapper(rawPrompt);
  const detectedKind = detectIntent(prompt);
  const { content, topicPrefix } = splitRespondent(prompt);
  const contentTopic = stripGoal(content, detectedKind);
  const explicitTopic = topicPrefix
    ? contentTopic && !topicPrefix.includes(contentTopic)
      ? `${topicPrefix} ${contentTopic}`.trim()
      : topicPrefix
    : contentTopic;
  return measurementFromTopic(explicitTopic);
}

function detectIntent(prompt: string): SurveyIntentKind {
  const withoutSurveyNoun = prompt
    .replace(/\s*(?:설문\s*조사|설문|조사)\s*$/g, "")
    .trim();

  if (hasAwarenessAndUsageDimensions(withoutSurveyNoun)) return "usage";
  if (/적응(?:도|상태|경험)?$/.test(withoutSurveyNoun)) return "adaptation";
  if (
    /(가입|입회)\s*(여부|의향|생각|계획)$/.test(withoutSurveyNoun) ||
    /(가입|입회)할\s*(지|생각|의향)$/.test(withoutSurveyNoun) ||
    (/(동아리|학회|소모임|모집)/.test(withoutSurveyNoun) &&
      /지원\s*(여부|의향|계획)$/.test(withoutSurveyNoun))
  ) {
    return "membership";
  }
  if (
    /(사용|이용)\s*(경험|행태|패턴|빈도)(?:(?:과|와)\s*개선점)?$/.test(
      withoutSurveyNoun,
    ) ||
    /사용성|사용자\s*경험|이용\s*실태/.test(withoutSurveyNoun)
  ) {
    return "usage";
  }
  if (
    /(수요|니즈|필요성|요구\s*사항)$/.test(withoutSurveyNoun) ||
    /(?:원하는|필요한)\s*(?:행사|프로그램|서비스|기능|지원|도움)$/.test(
      withoutSurveyNoun,
    )
  ) {
    return "needs";
  }
  if (
    /(개선\s*(요구|필요|의견)|문제점|불편\s*(사항|이유)|이용\s*장벽|참여\s*장벽)$/.test(
      withoutSurveyNoun,
    )
  ) {
    return "problem";
  }
  if (/(인지도|인식|브랜드\s*이미지|첫인상)(?:와\s*신뢰도)?$/.test(withoutSurveyNoun)) {
    return "awareness";
  }
  if (
    /(사용|이용|구매|도입|수용)\s*의향$/.test(withoutSurveyNoun) ||
    /(쓸|살|이용할|사용할)\s*(생각|의향|지)$/.test(withoutSurveyNoun)
  ) {
    return "adoption";
  }
  if (/만족도|얼마나\s*만족|만족\s*요인|활동\s*평가/.test(withoutSurveyNoun)) {
    return eventCue.test(withoutSurveyNoun) ? "event" : "satisfaction";
  }
  if (
    eventCue.test(withoutSurveyNoun) &&
    /(참여|참가|방문|관람|불참|경험)/.test(withoutSurveyNoun)
  ) {
    return "event";
  }
  if (/불편|문제|어려움|개선|해결|장벽/.test(withoutSurveyNoun)) {
    return "problem";
  }
  if (/적응|학교생활|대학생활/.test(withoutSurveyNoun)) {
    return "adaptation";
  }
  if (/인지|인식|알고\s*있는지/.test(withoutSurveyNoun)) {
    return "awareness";
  }
  if (/수요|니즈|필요|원하는|선호/.test(withoutSurveyNoun)) {
    return "needs";
  }
  if (/사용|이용|경험|서비스|제품|앱|사이트/.test(withoutSurveyNoun)) {
    return "usage";
  }
  return "general";
}

function cleanRespondent(value: string) {
  return value
    .replace(/\s*(?:들)?(?:의)?$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRespondent(prompt: string) {
  const explicitTarget = prompt.match(
    /^(.+?)(?:을|를)\s*대상(?:으로|으로\s*한|으로\s*해서)?\s*(.+)$/,
  );
  if (explicitTarget) {
    return {
      respondentGroup: cleanRespondent(explicitTarget[1]),
      content: explicitTarget[2].trim(),
      topicPrefix: null,
    };
  }

  const targetNoun = prompt.match(/^(.+?)\s*대상\s+(.+)$/);
  if (targetNoun) {
    return {
      respondentGroup: cleanRespondent(targetNoun[1]),
      content: targetNoun[2].trim(),
      topicPrefix: null,
    };
  }

  const topicAudienceGenitive = prompt.match(
    new RegExp(
      `^(.+?)(?:에\\s*대한|에\\s*관한)\\s+(.*${personHead}(?:들)?)(?:의)\\s+(.+)$`,
    ),
  );
  if (topicAudienceGenitive) {
    return {
      respondentGroup: cleanRespondent(topicAudienceGenitive[2]),
      content: topicAudienceGenitive[3].trim(),
      topicPrefix: topicAudienceGenitive[1].trim(),
    };
  }

  const subjectAudienceGenitive = prompt.match(
    new RegExp(`^(.+?)(?:의)\\s+(.*${personHead}(?:들)?)(?:의)\\s+(.+)$`),
  );
  if (subjectAudienceGenitive) {
    return {
      respondentGroup: cleanRespondent(subjectAudienceGenitive[2]),
      content: subjectAudienceGenitive[3].trim(),
      topicPrefix: subjectAudienceGenitive[1].trim(),
    };
  }

  const topicAudience = prompt.match(
    new RegExp(
      `^(.+?)(?:에\\s*대한|에\\s*관한)\\s+(.*${personHead}(?:들)?)\\s+(.+)$`,
    ),
  );
  if (topicAudience) {
    return {
      respondentGroup: cleanRespondent(topicAudience[2]),
      content: topicAudience[3].trim(),
      topicPrefix: topicAudience[1].trim(),
    };
  }

  const dative = prompt.match(/^(.+?)에게\s+(.+)$/);
  if (dative && new RegExp(`${personHead}(?:들)?$`).test(dative[1])) {
    return {
      respondentGroup: cleanRespondent(dative[1]),
      content: dative[2].trim(),
      topicPrefix: null,
    };
  }

  const actor = prompt.match(
    new RegExp(
      `^(.*${personHead})(?:들이|이|가)\\s*(?:느끼는|경험하는|경험한|평가하는)\\s+(.+)$`,
    ),
  );
  if (actor) {
    return {
      respondentGroup: cleanRespondent(actor[1]),
      content: actor[2].trim(),
      topicPrefix: null,
    };
  }

  const actorTopic = prompt.match(
    new RegExp(`^(.*${personHead})(?:들이|이|가)\\s+(.+)$`),
  );
  if (actorTopic) {
    return {
      respondentGroup: cleanRespondent(actorTopic[1]),
      content: actorTopic[2].trim(),
      topicPrefix: null,
    };
  }

  const genitive = prompt.match(
    new RegExp(`^(.*${personHead}(?:들)?)(?:의)\\s+(.+)$`),
  );
  if (genitive) {
    return {
      respondentGroup: cleanRespondent(genitive[1]),
      content: genitive[2].trim(),
      topicPrefix: null,
    };
  }

  const roleLed = prompt.match(
    new RegExp(`^(.*${personHead}(?:들)?)\\s+(.+)$`),
  );
  if (roleLed) {
    return {
      respondentGroup: cleanRespondent(roleLed[1]),
      content: roleLed[2].trim(),
      topicPrefix: null,
    };
  }

  return { respondentGroup: null, content: prompt, topicPrefix: null };
}

function stripGoal(content: string, kind: SurveyIntentKind) {
  let topic = content
    .replace(/\s*(?:설문\s*조사|설문|조사)\s*$/g, "")
    .replace(/\s*(?:에\s*대한|에\s*관한|관련)\s*$/g, "")
    .trim();

  const endings: Record<SurveyIntentKind, RegExp[]> = {
    membership: [
      /\s*(?:가입|입회|지원)\s*(?:여부|의향|생각|계획)$/,
      /\s*(?:가입|입회)할\s*(?:지|생각|의향)$/,
    ],
    problem: [
      /\s*(?:문제점|문제|불편\s*사항|불편|어려움|개선\s*요구|개선\s*필요|개선점|이용\s*장벽|참여\s*장벽|해결)$/,
    ],
    satisfaction: [
      /\s*(?:전반적인\s*)?(?:만족도|만족|활동\s*평가|평가)(?:와\s*(?:개선점|개선\s*요구))?$/,
    ],
    event: [
      /\s*(?:참여|참가)\s*여부와\s*불참\s*이유$/,
      /\s*불참\s*이유$/,
      /\s*(?:참여|참가|방문|관람)\s*(?:여부|경험)$/,
      /\s*(?:전반적인\s*)?(?:만족도|만족|평가)$/,
    ],
    adoption: [/\s*(?:사용|이용|구매|도입|수용)\s*의향$/],
    usage: [
      /\s*(?:인지도|인지|인식)\s*(?:과|와|및)\s*(?:사용|이용)\s*(?:경험|현황|행태|실태|패턴|빈도)$/,
      /\s*(?:사용|이용)\s*(?:경험|행태|패턴|빈도)(?:(?:과|와)\s*개선점)?$/,
      /\s*(?:사용자\s*경험|사용성|이용\s*실태)$/,
    ],
    needs: [
      /\s*(?:수요|니즈|요구\s*사항|필요성)$/,
      /\s*(?:원하는|필요한)\s*(?:행사|프로그램|서비스|기능|지원|도움)$/,
    ],
    awareness: [/\s*(?:인지도|인식|브랜드\s*이미지|첫인상)(?:와\s*신뢰도)?$/],
    adaptation: [/\s*(?:적응|적응도|적응\s*상태|적응\s*경험)$/],
    general: [],
  };

  for (let pass = 0; pass < 2; pass += 1) {
    endings[kind].forEach((pattern) => {
      topic = topic.replace(pattern, "").trim();
    });
  }
  return topic
    .replace(
      /\s*(?:에\s*대한|에\s*관한|관련)?\s*(?:의견|생각)(?:\s*(?:수렴|파악))?(?:\s*(?:설문\s*)?조사)?$/g,
      "",
    )
    .replace(/\s*(?:에\s*대한|에\s*관한|관련)$/g, "")
    .replace(/\s*(?:에|에서)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type MovementExperience = {
  place: string;
  activity: "등하교" | "통학" | "출퇴근" | "이동";
};

function movementExperience(value: string): MovementExperience | null {
  const normalized = value
    .replace(/\s*(?:이용환경|이용\s*경험)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(
    /^(.+?)(?:으로|로)?\s*(등하교|통학|출퇴근|이동)(?:\s*(?:경험|환경|과정))?$/,
  );
  if (!match) return null;
  return {
    place: match[1].trim(),
    activity: match[2] as MovementExperience["activity"],
  };
}

function baseFromRespondent(respondent: string | null) {
  if (!respondent) return "";

  const cleanedRespondent = respondent
    .replace(/^최근\s*\d+\s*(?:일|주|개월|년)\s*(?:동안|내에?)?\s*/g, "")
    .trim();

  const negativeUseObject = cleanedRespondent.match(
    /^(.+?)(?:을|를)\s*(?:쓰지|사용하지|이용하지)\s*않는\s+.+$/,
  );
  if (negativeUseObject) return negativeUseObject[1].trim();

  const nonUserObject = cleanedRespondent.match(/^(.+?)\s*비이용\s+.+$/);
  if (nonUserObject) return nonUserObject[1].trim();

  const nonParticipantObject = cleanedRespondent.match(
    /^(.+?)(?:에)\s*(?:참여|참가)하지\s*않은\s+.+$/,
  );
  if (nonParticipantObject) return nonParticipantObject[1].trim();

  const noExperienceObject = cleanedRespondent.match(
    /^(.+?)\s*(?:참여|이용|사용)\s*경험이\s*없는\s+.+$/,
  );
  if (noExperienceObject) return noExperienceObject[1].trim();

  const enrolledObject = cleanedRespondent.match(/^(.+?)\s*(?:수강생|수강자)$/);
  if (enrolledObject) {
    return enrolledObject[1].replace(/^.+?\s+중\s+/, "").trim();
  }

  const relativeObject = cleanedRespondent.match(
    /^(?:최근\s*\d+\s*(?:일|주|개월|년)\s*(?:동안|내에?)?\s*)?(.+?)(?:을|를)\s*(?:사용|이용|관람|경험)한\s+.+$/,
  );
  if (relativeObject) return relativeObject[1].trim();

  const joinedObject = respondent.match(/^(.+?)(?:에)\s*가입한\s+.+$/);
  if (joinedObject) return joinedObject[1].trim();

  const participatedObject = respondent.match(
    /^(.+?)(?:에)\s*(?:참여|참가|방문)한\s+.+$/,
  );
  if (participatedObject) return participatedObject[1].trim();

  return respondent
    .replace(
      /\s*(?:이용|사용|거주|참여|참가|관람|방문|수강|가입)\s*(?:학생|대학생|신입생|새내기|재학생|졸업생|교환학생|복학생)$/,
      "",
    )
    .replace(
      /\s*(?:수강생|수강자|이용자|사용자|가입자|회원|참여자|참가자|참석자|방문객|관람객|구매자|고객|거주자|거주생|기숙사생)$/,
      "",
    )
    .trim();
}

function inferDomain(
  respondentGroup: string | null,
  topic: string,
  prompt: string,
): SurveyDomain {
  const source = `${respondentGroup ?? ""} ${topic} ${prompt}`;
  const verifiedEntity = lookupVerifiedSurveyKnowledge(source);
  if (verifiedEntity?.entityType === "building") return "building";
  if (verifiedEntity?.entityType === "cafeteria") return "cafeteria";
  if (eventCue.test(source)) return "event";
  if (/도서관|열람실/.test(source)) return "library";
  if (/학생식당|학식|구내식당|맛나샘|고를샘/.test(source)) return "cafeteria";
  if (/기숙사|생활관|거주생|기숙사생/.test(source)) return "dormitory";
  if (/강의|수업|과목|수강생|팀플|팀\s*프로젝트/.test(source)) return "course";
  if (/동아리|학회|소모임|회원|가입자/.test(source)) return "club";
  if (/학교생활|대학생활/.test(topic)) return "student-life";
  if (/학과|전공/.test(source)) return "department";
  if (/신입생|새내기|학교생활|대학생활|복학생/.test(source)) {
    return "student-life";
  }
  const buildingNameCue =
    /(?:^|\s)(?!(?:가치관|세계관|인생관|직업관|윤리관|역사관|기관)(?:\s|$))(?:공학원|대강당|[가-힣A-Za-z0-9·-]{2,}(?:관|강의동|홀))(?:\s|$)/;
  if (
    /건물|교사동|강의동|캠퍼스\s*건물/.test(source) ||
    buildingNameCue.test(source)
  ) {
    return "building";
  }
  if (
    /앱|서비스|사이트|플랫폼|브라우저|제품|기능|사용자|사용한|이용한|쓰는/.test(
      source,
    )
  ) {
    return "service";
  }
  if (/시설|공간|센터|셔틀|교통/.test(source)) return "facility";
  return "general";
}

function inferEvaluationTarget(
  respondentGroup: string | null,
  explicitTopic: string,
  domain: SurveyDomain,
  kind: SurveyIntentKind,
) {
  const movement = movementExperience(explicitTopic);
  if (movement && (domain === "building" || domain === "facility")) {
    return `${movement.place} ${movement.activity} 경험`;
  }

  const base = baseFromRespondent(respondentGroup);
  const genericTopic =
    /^(활동|생활|경험|시설|메뉴|수업|강의|공연|프로그램|소음|좌석|팀플|팀\s*프로젝트)$/.test(
      explicitTopic,
    );
  const shouldAddBase =
    Boolean(base) &&
    (genericTopic ||
      (domain === "course" &&
        /수강생|수강자/.test(respondentGroup ?? "") &&
        /(수업|강의|팀플|팀\s*프로젝트)/.test(explicitTopic)) ||
      (domain === "library" &&
        /(시설|소음|좌석|운영|자료)/.test(explicitTopic)) ||
      (domain === "club" && /(활동|운영|프로그램)/.test(explicitTopic)) ||
      (domain === "event" && /(공연|프로그램|진행|시설)/.test(explicitTopic)));

  if (explicitTopic && base && shouldAddBase) {
    if (explicitTopic === "경험") {
      return /사용자|이용자|사용한|이용한/.test(respondentGroup ?? "")
        ? `${base} 이용 경험`
        : `${base} 경험`;
    }
    if (
      domain === "course" &&
      /수업$/.test(base) &&
      /^(?:지난|이번)\s+\S+\s+수업$/.test(explicitTopic)
    ) {
      return `${explicitTopic.replace(/\s*수업$/, "")} ${base}`;
    }
    if (!explicitTopic.includes(base)) return `${base} ${explicitTopic}`;
    return explicitTopic;
  }
  if (explicitTopic) return explicitTopic;

  if (
    base &&
    (kind === "adoption" ||
      kind === "membership" ||
      kind === "needs" ||
      kind === "awareness")
  ) {
    return base;
  }

  if (domain === "department" && respondentGroup) {
    const department = respondentGroup.match(/([가-힣A-Za-z0-9]+학과)/)?.[1];
    if (department && /신입생|새내기/.test(respondentGroup)) {
      return `입학 후 ${department} 생활`;
    }
    if (department) return `${department} 생활`;
  }
  if (domain === "student-life") {
    return /신입생|새내기/.test(respondentGroup ?? "")
      ? "입학 후 학교생활"
      : "학교생활";
  }
  if (domain === "course" && base) return `${base} 수업 경험`;
  if (domain === "club" && base) return `${base} 활동`;
  if (domain === "event" && base) return base;
  if (domain === "library" && base) return `${base} 이용 경험`;
  if (domain === "cafeteria" && base) return `${base} 이용 경험`;
  if (domain === "dormitory" && base) return `${base} 생활`;
  if (domain === "building" && base) return `${base} 이용환경`;
  if (domain === "service" && base) return `${base} 이용 경험`;
  if (domain === "facility" && base) return `${base} 이용 경험`;
  if (base) return `${base} 관련 경험`;
  return explicitTopic || "입력한 주제";
}

const goalLabels: Record<SurveyIntentKind, string> = {
  membership: "가입 여부와 의향",
  problem: "문제 원인과 개선점",
  satisfaction: "만족도와 개선점",
  event: "참여 경험과 만족도",
  adoption: "사용·구매 의향",
  usage: "사용 경험과 개선점",
  needs: "수요와 필요 조건",
  awareness: "인지도와 인식",
  adaptation: "적응 경험과 지원",
  general: "경험과 의견",
};

export function parseSurveySemantics(rawPrompt: string): SurveySemantics {
  const directProportion = parseDirectProportionRequest(rawPrompt);
  if (directProportion) {
    const { population, qualifyingGroup, conditionLabel } = directProportion;
    const explicitTopic = `${qualifyingGroup} 비율`;
    return {
      respondentGroup: population,
      evaluationTarget: `${conditionLabel} 여부`,
      explicitTopic,
      measurement: null,
      kind: "general",
      domain: inferDomain(population, explicitTopic, rawPrompt),
      goalLabel: "해당 학생 비율 파악",
      requestedAsOpinion: false,
      topicWasInferred: false,
      assumptions: [],
    };
  }

  const prompt = stripRequestWrapper(rawPrompt);
  const requestedAsOpinion = /(?:의견|생각)(?:\s*(?:수렴|파악))?(?:\s*(?:설문\s*)?조사)?\s*$/.test(
    prompt,
  );
  const detectedKind = detectIntent(prompt);
  const { respondentGroup, content, topicPrefix } = splitRespondent(prompt);
  const contentTopic = stripGoal(content, detectedKind);
  const explicitTopic = topicPrefix
    ? contentTopic && !topicPrefix.includes(contentTopic)
      ? `${topicPrefix} ${contentTopic}`.trim()
      : topicPrefix
    : contentTopic;
  const preliminaryDomain = inferDomain(
    respondentGroup,
    explicitTopic,
    prompt,
  );
  const evaluationTarget = inferEvaluationTarget(
    respondentGroup,
    explicitTopic,
    preliminaryDomain,
    detectedKind,
  );
  const domain = inferDomain(respondentGroup, evaluationTarget, prompt);
  const kind =
    detectedKind === "general" &&
    (domain === "building" || domain === "facility")
      ? "satisfaction"
      : detectedKind;
  const movement = movementExperience(evaluationTarget);
  const literalFrequency = /(?:빈도|횟수)$/.test(explicitTopic);
  const literalConsumptionHabits = consumptionHabitCue.test(explicitTopic);
  const literalSleepDuration = sleepDurationCue.test(explicitTopic);
  const measurement = measurementFromTopic(explicitTopic);
  const topicWasInferred = explicitTopic.length < 2;
  const assumptions: string[] = topicWasInferred
    ? [`‘${evaluationTarget}’에 대한 조사로 문맥을 해석했어요.`]
    : [];
  if (detectedKind !== kind) {
    assumptions.push(
      "조사 목적이 구체적으로 적히지 않아 이용환경 만족도와 개선점 조사로 구성했어요.",
    );
  }

  return {
    respondentGroup,
    evaluationTarget: evaluationTarget.slice(0, 64),
    explicitTopic: explicitTopic.length >= 2 ? explicitTopic : null,
    measurement,
    kind,
    domain,
    goalLabel: literalFrequency
      ? "빈도 파악"
      : literalConsumptionHabits
        ? "소비 행태 파악"
        : literalSleepDuration
          ? "수면 시간과 인식 파악"
          : measurement?.kind === "duration"
            ? `실제 ${measurement.metricLabel} 파악`
            : measurement?.kind === "cost"
              ? `실제 ${measurement.metricLabel} 파악`
              : measurement?.kind === "quantity"
                ? `실제 ${measurement.metricLabel} 파악`
                : measurement?.kind === "preference"
                  ? "구체적인 선호 파악"
                  : measurement?.kind === "reason"
                    ? "실제 이유 파악"
          : movement
            ? "이동 경험과 개선점"
            : goalLabels[kind],
    requestedAsOpinion,
    topicWasInferred,
    assumptions,
  };
}

const surveyRequestPhraseCue =
  /(?:분석|조사|파악|확인|알아보|설문(?:을|를)?\s*만들)(?:해|하|고)?\s*싶(?:어|어요|습니다)/;

function stripPromotionalPrefix(value: string) {
  const match = value.match(
    /^(?:현재\s*)?(?:(?:국내|세계|업계)\s*)?(?:최대|최고|대표(?:적인)?|가장\s+인기(?:가\s+있는)?)\s+(?:[\p{L}\p{N}·-]+\s+){0,3}(?:플랫폼|서비스|앱|웹사이트|브랜드)(?:인)?\s+/u,
  );
  return {
    value: match ? value.slice(match[0].length).trim() : value.trim(),
    excluded: match ? [match[0].trim()] : [],
  };
}

function briefSubjectFromContent(
  content: string,
  respondentGroup: string | null,
  topicPrefix: string | null,
  researchContext: string | null,
) {
  if (topicPrefix) return topicPrefix.trim();

  const teamwork = content.match(
    /^(.+?)에서\s*겪는\s+(.+?)(?:과|와)\s*(.+?)\s*경험$/,
  );
  if (teamwork && respondentGroup) {
    return `${respondentGroup}의 ${teamwork[1].trim()} ${teamwork[3].trim()} 경험`;
  }

  let subject = content
    .replace(
      /\s+(?:인지도|인지|인식)\s*(?:과|와|및)\s*(?:사용|이용)\s*(?:경험|현황|행태|실태|패턴|빈도)\s*(?:(?:설문\s*)?조사)?$/,
      "",
    )
    .replace(
      /\s+(?:이용|사용|참여|구매|방문|협업)\s*(?:현황|행태|실태|빈도|횟수|시간|경험|패턴|만족도|의향)(?:\s*(?:과|와|및)\s*.+)?$/,
      "",
    )
    .replace(
      /\s+(?:만족도|불편\s*사항|개선점|갈등|협업\s*경험)(?:\s*(?:과|와|및)\s*.+)?$/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (researchContext && subject.startsWith(`${researchContext} `)) {
    subject = subject.slice(researchContext.length).trim();
  }

  const institution = respondentGroup?.match(/^(.+?대학교)/)?.[1];
  if (institution && /^교내\s+/.test(subject)) {
    subject = `${institution} ${subject}`;
  }
  return subject;
}

function researchContextFromContent(
  content: string,
  semantics: SurveySemantics,
) {
  if (semantics.kind !== "usage") return null;
  return content.match(/^(교내|학교|캠퍼스)(?:에서)?\s+/)?.[1] ?? null;
}

function hasAwarenessAndUsageDimensions(value: string) {
  return awarenessAndUsageDimensions(value) !== null;
}

function awarenessAndUsageDimensions(value: string) {
  const match = value.match(
    /(?:인지도|인지|인식)\s*(?:과|와|및)\s*(사용|이용)\s*(경험|현황|행태|실태|패턴|빈도)/,
  );
  return match
    ? { usageVerb: match[1], usageDimension: match[2] }
    : null;
}

function briefDimensions(
  subject: string,
  content: string,
  semantics: SurveySemantics,
) {
  const corpus = `${subject} ${content}`;
  if (hasAwarenessAndUsageDimensions(content)) {
    return [
      "인지 수준",
      "이용 여부 및 빈도",
      "주요 이용 목적",
      "전반적 만족도",
      "불편 사항",
      "지속 이용 의향",
    ];
  }
  if (/웹툰|웹소설|OTT|동영상|영상\s*플랫폼|음악\s*스트리밍|콘텐츠\s*플랫폼/.test(corpus)) {
    return [
      "이용 여부 및 빈도",
      "이용 시간과 이용 상황",
      "콘텐츠 및 장르 선호",
      "서비스 만족도",
      "불편 사항",
      "유료 결제 경험",
      "지속 이용 및 추천 의향",
    ];
  }
  if (/학식|식당|급식|구내식당/.test(corpus)) {
    return [
      "이용 여부 및 빈도",
      "메뉴와 맛",
      "가격 대비 가치와 양",
      "대기 시간과 혼잡",
      "위생과 좌석",
      "전반적 만족도",
      "개선 요구",
    ];
  }
  if (/팀플|팀\s*프로젝트|조별\s*과제|협업/.test(corpus)) {
    return [
      "팀플 경험 여부",
      "갈등 원인",
      "역할 분담의 공정성",
      "소통 방식과 참여도",
      "일정 및 과업 부담",
      "협업 만족도",
      "향후 개선 방법",
    ];
  }
  if (/배달\s*앱|배달앱|음식\s*배달/.test(corpus)) {
    return [
      "이용 여부 및 빈도",
      "주문 상황과 선택 기준",
      "배달비와 최소 주문 금액",
      "메뉴 탐색과 추천 경험",
      "주문·결제·배달 과정의 불편",
      "서비스 만족도",
      "지속 이용 의향",
    ];
  }
  if (semantics.kind === "usage") {
    return [
      "이용 여부 및 빈도",
      "이용 시간과 상황",
      "주요 이용 기능 또는 콘텐츠",
      "전반적 만족도",
      "불편 사항",
      "비용 또는 결제 경험",
      "지속 이용 의향",
    ];
  }
  if (semantics.kind === "problem") {
    return [
      "관련 경험 여부",
      "문제 발생 상황",
      "원인과 영향",
      "대응 방식",
      "개선 우선순위",
      "전반적 평가",
    ];
  }
  if (semantics.kind === "satisfaction") {
    return [
      "이용 또는 참여 경험",
      "전반적 만족도",
      "대상 고유의 세부 경험",
      "불편 사항",
      "개선 우선순위",
      "재이용 또는 추천 의향",
    ];
  }
  return [
    "관련 경험 여부",
    "현재 행동과 경험",
    "주요 판단 기준",
    "전반적 평가",
    "문제와 장벽",
    "개선 요구",
  ];
}

function briefTimeframe(subject: string, content: string, semantics: SurveySemantics) {
  if (/팀플|팀\s*프로젝트|조별\s*과제/.test(`${subject} ${content}`)) {
    return "가장 최근 팀플";
  }
  if (/학식|식당|급식|교내/.test(`${subject} ${content}`)) return "최근 1학기";
  if (semantics.kind === "usage" || /빈도|현황|경험/.test(content)) {
    return "최근 3개월";
  }
  return "현재 또는 가장 최근 경험";
}

export function parseSurveyBrief(rawBrief: string): SurveyBrief {
  const normalizedRaw = normalizePrompt(rawBrief);
  const requestPhrase = normalizedRaw.match(
    /(?:을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:해|하|고)?\s*싶(?:어|어요|습니다)\s*$/,
  )?.[0];
  const unwrapped = stripRequestWrapper(normalizedRaw);
  const promotional = stripPromotionalPrefix(unwrapped);
  const normalizedBrief = promotional.value;
  const semantics = parseSurveySemantics(normalizedBrief);
  const split = splitRespondent(normalizedBrief);
  const researchContext = researchContextFromContent(split.content, semantics);
  const awarenessUsageDimensions = awarenessAndUsageDimensions(split.content);
  const researchSubject = briefSubjectFromContent(
    split.content,
    split.respondentGroup,
    split.topicPrefix,
    researchContext,
  ) || semantics.evaluationTarget;
  let targetRespondents =
    split.respondentGroup ??
    semantics.respondentGroup ??
    (researchContext
      ? `${researchContext} 구성원`
      : awarenessUsageDimensions
        ? "일반 응답자"
        : "관련 경험이 있는 응답자");
  if (
    /팀플|팀\s*프로젝트|조별\s*과제/.test(normalizedBrief) &&
    !/경험이\s*있는/.test(targetRespondents)
  ) {
    targetRespondents = `팀플 경험이 있는 ${targetRespondents}`;
  }

  if (
    researchSubject.length < 2 ||
    researchSubject.length > 80 ||
    surveyRequestPhraseCue.test(researchSubject)
  ) {
    throw new Error("조사 의뢰문에서 짧고 명확한 조사 대상을 분리하지 못했습니다.");
  }

  const dimensions = briefDimensions(
    researchSubject,
    split.content,
    semantics,
  );
  const recommendedTimeframe = briefTimeframe(
    researchSubject,
    split.content,
    semantics,
  );
  const subjectAudiencePrefix = researchSubject.match(/^(.{1,30}?)의\s+(.+)$/);
  const goalSubject =
    subjectAudiencePrefix && targetRespondents.includes(subjectAudiencePrefix[1])
      ? subjectAudiencePrefix[2]
      : researchSubject;
  const goalDimensions = labelWithParticle(
    dimensions.slice(0, 4).join(", "),
    "을",
    "를",
  );
  const researchGoal = `${labelWithParticle(targetRespondents, "의", "의")} ${goalSubject} 관련 ${goalDimensions} 파악한다.`;
  const isUsageStudy =
    semantics.kind === "usage" || /이용\s*(?:현황|경험|빈도)|사용\s*(?:현황|경험|빈도)/.test(split.content);
  const contextualSubject = researchContext
    ? `${researchContext} ${researchSubject}`
    : researchSubject;
  const surveyTitle = /팀플|팀\s*프로젝트|조별\s*과제/.test(normalizedBrief)
    ? `${researchSubject} 조사`
    : /학식|식당|급식/.test(researchSubject)
      ? `${researchSubject} 이용 경험 및 만족도 조사`
      : /불편\s*사항/.test(split.content)
        ? `${targetRespondents}의 ${researchSubject} 이용 빈도 및 불편 사항 조사`
        : awarenessUsageDimensions
          ? `${contextualSubject} 인식 및 ${awarenessUsageDimensions.usageVerb} ${awarenessUsageDimensions.usageDimension} 조사`
        : isUsageStudy
          ? `${targetRespondents}의 ${researchSubject} 이용 현황 및 경험 조사`
          : `${targetRespondents}의 ${researchSubject} 조사`;

  return {
    rawBrief: normalizedRaw,
    normalizedBrief,
    surveyTitle: surveyTitle.replace(/의\s+([^\s]+)의\s+/g, "의 $1 "),
    researchSubject,
    researchContext,
    targetRespondents,
    researchGoal,
    recommendedTimeframe,
    dimensions,
    excludedPhrases: [
      ...promotional.excluded,
      ...(requestPhrase ? [requestPhrase.trim()] : []),
    ],
    kind: semantics.kind,
    domain: inferDomain(targetRespondents, researchSubject, normalizedBrief),
    semantics: {
      ...semantics,
      respondentGroup: targetRespondents,
      evaluationTarget: researchSubject,
      explicitTopic: researchSubject,
      domain: inferDomain(targetRespondents, researchSubject, normalizedBrief),
    },
  };
}

const question = (
  id: number,
  title: string,
  reason: string,
  type: SurveyQuestionType,
  options?: string[],
  required = true,
): SurveyQuestion => ({
  id,
  title,
  reason,
  type,
  options,
  required,
});

const topicLabel = (subject: string) => `‘${subject}’`;

function topicWithParticle(
  subject: string,
  withBatchim: string,
  withoutBatchim: string,
) {
  const lastCharacter = [...subject.trim()].at(-1) ?? "";
  const code = lastCharacter.charCodeAt(0);
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return `${topicLabel(subject)}${hasBatchim ? withBatchim : withoutBatchim}`;
}

function labelWithParticle(
  label: string,
  withBatchim: string,
  withoutBatchim: string,
) {
  const lastCharacter = [...label.trim()].at(-1) ?? "";
  const code = lastCharacter.charCodeAt(0);
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return `${label}${hasBatchim ? withBatchim : withoutBatchim}`;
}

function membershipBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `현재 ${topic} 가입 상태를 알려주세요.`,
      "가입자, 이탈자, 잠재 가입자를 구분해 결과를 정확히 해석할 수 있어요.",
      "single",
      ["현재 가입해 활동 중", "과거에 활동했으나 현재는 아님", "가입하지 않았지만 관심 있음", "가입하지 않았고 관심 없음"],
    ),
    question(
      2,
      `앞으로 ${topic}에 가입하거나 활동할 의향이 어느 정도인가요?`,
      "현재 상태와 별개로 향후 가입 가능성을 5점 척도로 확인해요.",
      "scale",
    ),
    question(
      3,
      `${topic} 가입을 결정할 때 중요하게 보는 요소를 모두 골라주세요.`,
      "모집 메시지와 활동 운영에서 우선할 요소를 찾을 수 있어요.",
      "multiple",
      ["활동 내용", "활동 시간", "구성원 분위기", "진로·학업 도움", "회비 및 비용", "선후배 네트워크"],
    ),
    question(
      4,
      `${topic} 가입을 망설이게 하는 이유를 모두 골라주세요.`,
      "잠재 가입자의 실제 장벽을 파악해 모집 방식을 개선할 수 있어요.",
      "multiple",
      ["활동 정보 부족", "시간 부담", "관심 분야와 맞지 않음", "지원 절차 부담", "비용 부담", "아직 판단하기 어려움"],
    ),
    question(
      5,
      `${topic} 활동이나 모집과 관련해 더 알고 싶은 점이 있나요?`,
      "정해진 선택지로 놓친 궁금증과 요구를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "membership",
    intentLabel: "가입 여부·의향",
    subject,
    title: `${subject} 가입 및 관심도 조사`,
    description: `${subject}의 현재 가입 상태와 향후 가입 의향, 가입을 결정하는 요인을 파악하기 위한 익명 설문입니다.`,
    templateTitle: `${subject} 가입·관심도`,
    templateSummary: "현재 가입 상태, 향후 의향, 가입 결정 요인과 참여 장벽을 한 번에 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 가입 여부와 의향"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topicWithParticle(subject, "을", "를")} 처음 알게 된 경로는 무엇인가요?`,
        "잠재 가입자에게 실제로 도달하는 홍보 채널을 확인해요.",
        "single",
        ["지인·선후배", "에브리타임·커뮤니티", "인스타그램 등 SNS", "교내 홍보물", "설명회·박람회", "이번 설문에서 처음 알게 됨"],
      ),
      question(
        4,
        `${topic} 활동 중 가장 기대되는 부분을 모두 골라주세요.`,
        "가입 의향을 높이는 핵심 기대 가치를 구체적으로 찾을 수 있어요.",
        "multiple",
        ["관심 분야 활동", "친목과 교류", "프로젝트 경험", "진로·취업 도움", "선후배 네트워크", "교내외 행사 참여"],
      ),
      question(
        5,
        `${topic} 가입을 망설이게 하는 이유를 모두 골라주세요.`,
        "정보, 시간, 비용, 분위기 등 가입 전환을 막는 요인을 구분해요.",
        "multiple",
        ["활동 정보 부족", "시간 부담", "관심 분야와 맞지 않음", "지원 절차 부담", "비용 부담", "기존 구성원과 어울릴지 걱정"],
      ),
      question(
        6,
        `어떤 정보가 제공되면 ${topic} 가입 여부를 결정하기 쉬울까요?`,
        "모집 페이지와 설명회에서 먼저 안내할 정보를 정할 수 있어요.",
        "multiple",
        ["구체적인 활동 일정", "실제 활동 사례", "구성원 후기", "회비·비용", "선발 방식", "가입 후 얻을 수 있는 경험"],
      ),
      question(
        7,
        `${topic} 활동이나 모집에 바라는 점을 자유롭게 적어주세요.`,
        "선택지 밖의 기대와 우려를 받아 맞춤 개선안을 찾을 수 있어요.",
        "text",
        undefined,
        false,
      ),
    ],
  };
}

function problemBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic} 관련 불편이나 문제를 얼마나 자주 경험하시나요?`,
      "문제 경험의 빈도를 구분해 개선 필요 수준을 확인해요.",
      "single",
      ["거의 매번", "자주", "가끔", "드물게", "경험한 적 없음"],
    ),
    question(
      2,
      `${topic} 관련 문제에 영향을 주는 요소를 모두 골라주세요.`,
      "불편이 발생하는 원인을 영역별로 구분할 수 있어요.",
      "multiple",
      ["정보·안내 부족", "복잡한 절차", "시간·일정", "비용", "시설·접근성", "운영·응대"],
    ),
    question(
      3,
      `${topic} 관련 문제가 일상이나 경험에 미치는 영향은 어느 정도인가요?`,
      "단순 발생 여부와 별개로 체감 심각도를 측정해요.",
      "scale",
    ),
    question(
      4,
      `${topic}에서 가장 먼저 개선해야 할 부분은 무엇인가요?`,
      "한정된 자원을 투입할 최우선 개선 영역을 확인해요.",
      "single",
      ["정보와 안내", "이용 절차", "운영 시간", "비용", "시설과 접근성", "담당자 응대"],
    ),
    question(
      5,
      `${topic} 관련 불편을 겪은 상황과 개선 의견을 적어주세요.`,
      "문제가 발생한 구체적인 맥락과 해결 아이디어를 함께 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "problem",
    intentLabel: "문제·개선",
    subject,
    title: `${subject} 문제 및 개선 조사`,
    description: `${topic} 관련 반복적인 불편과 원인, 영향 수준 및 개선 우선순위를 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 문제·개선`,
    templateSummary: "문제 경험 빈도와 원인, 영향 수준, 가장 시급한 개선점을 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 문제 원인과 개선"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 3),
      question(
        4,
        `${topic} 관련 불편은 주로 어떤 상황에서 발생하나요?`,
        "문제의 발생 조건을 파악해 해결책을 더 구체적으로 설계해요.",
        "multiple",
        ["처음 이용할 때", "사람이 몰릴 때", "정보를 찾을 때", "신청·결제할 때", "문의가 필요할 때", "특정 상황 없이 반복됨"],
      ),
      ...templateQuestions.slice(3).map((item, index) => ({
        ...item,
        id: index + 5,
      })),
      question(
        7,
        `${topic} 관련 문제가 개선된다면 가장 기대되는 변화는 무엇인가요?`,
        "개선의 성공 기준을 응답자가 기대하는 결과로 정의해요.",
        "single",
        ["시간 절약", "이용 편의 향상", "비용 절감", "안전·신뢰 향상", "참여·이용 증가", "스트레스 감소"],
      ),
    ],
  };
}

type SatisfactionProfile = {
  screenerTitle: string;
  screenerOptions: string[];
  overallTitle: string;
  strengthsTitle: string;
  improvementTitle: string;
  areaOptions: string[];
  detailTitles: [string, string, string];
  closingTitle: string;
};

function satisfactionProfile(semantics: SurveySemantics): SatisfactionProfile {
  const { respondentGroup, evaluationTarget, domain } = semantics;
  const experienceBase = evaluationTarget
    .replace(
      /\s*(?:이용|사용|수강|참여|방문|수업)(?:\s*경험)?$/g,
      "",
    )
    .trim();
  const department = respondentGroup?.match(/([가-힣A-Za-z0-9]+학과)/)?.[1];
  const isDepartmentFreshman =
    domain === "department" &&
    Boolean(department) &&
    /신입생|새내기/.test(respondentGroup ?? "");

  if (isDepartmentFreshman && department) {
    return {
      screenerTitle: `현재 ${department} 신입생인가요?`,
      screenerOptions: [
        `네, 현재 ${department} 신입생입니다`,
        `${department} 소속이지만 신입생은 아닙니다`,
        `${department} 소속이 아닙니다`,
      ],
      overallTitle: `입학 후 지금까지의 ${department} 생활에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${department} 생활에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${department} 신입생의 생활을 위해 개선이 필요하다고 느낀 부분을 모두 골라주세요.`,
      areaOptions: [
        "전공 수업과 학업 경험",
        "학과 안내와 정보 제공",
        "교수·조교의 지원",
        "동기·선후배 관계",
        "학회·동아리·학생회 활동",
        "진로·전공 탐색 기회",
      ],
      detailTitles: [
        `${department} 전공 수업 경험에 얼마나 만족하시나요?`,
        "필요한 학과 안내와 정보를 제때 얻는 경험에 얼마나 만족하시나요?",
        "동기·선후배와 교류할 기회에 얼마나 만족하시나요?",
      ],
      closingTitle: `신입생의 ${department} 생활이 더 만족스러워지려면 무엇이 달라져야 한다고 생각하나요?`,
    };
  }

  if (domain === "course") {
    return {
      screenerTitle: `${labelWithParticle(experienceBase || evaluationTarget, "을", "를")} 실제로 수강하거나 참여한 적이 있나요?`,
      screenerOptions: [
        "현재 수강·참여 중",
        "최근에 수강·참여함",
        "과거에 수강·참여함",
        "수강·참여한 적 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "학습 목표와 내용 구성",
        "설명과 수업 진행",
        "수업 자료",
        "과제의 난이도·분량",
        "시험·평가의 공정성",
        "질문 응답과 피드백",
      ],
      detailTitles: [
        "수업 내용의 구성과 학습 도움에 얼마나 만족하시나요?",
        "설명·수업 자료·피드백에 얼마나 만족하시나요?",
        "과제와 시험 등 평가 방식에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}이 더 나아지기 위해 바라는 점을 구체적으로 적어주세요.`,
    };
  }

  if (domain === "club") {
    return {
      screenerTitle: `${evaluationTarget}에 실제로 참여한 경험이 있나요?`,
      screenerOptions: [
        "현재 활동 중",
        "과거에 활동함",
        "가입했지만 활동 경험은 거의 없음",
        "가입·활동 경험 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "활동 내용",
        "활동 일정과 빈도",
        "구성원 분위기",
        "운영진의 소통",
        "성장·진로에 대한 도움",
        "회비 대비 활동 가치",
      ],
      detailTitles: [
        "활동 내용과 구성에 얼마나 만족하시나요?",
        "활동 일정과 빈도에 얼마나 만족하시나요?",
        "구성원 분위기와 운영진 소통에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}이 더 만족스러워지기 위해 바라는 점을 적어주세요.`,
    };
  }

  if (domain === "library") {
    return {
      screenerTitle: `최근 ${labelWithParticle(experienceBase || evaluationTarget, "을", "를")} 직접 이용한 적이 있나요?`,
      screenerOptions: [
        "최근 1개월 내 이용함",
        "최근 3개월 내 이용함",
        "3개월보다 오래전에 이용함",
        "이용한 적 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "좌석과 학습 공간",
        "소음과 학습 환경",
        "청결과 쾌적함",
        "운영 시간",
        "자료·검색·대출",
        "직원 안내와 지원",
      ],
      detailTitles: [
        "좌석과 학습 공간에 얼마나 만족하시나요?",
        "소음·청결 등 학습 환경에 얼마나 만족하시나요?",
        "도서관 운영 시간은 이용하기에 편리한가요?",
      ],
      closingTitle: `${evaluationTarget}에서 겪은 불편이나 바라는 변화를 적어주세요.`,
    };
  }

  if (domain === "cafeteria") {
    const cafeteriaLabel = /식당|학식|구내식당/.test(evaluationTarget)
      ? evaluationTarget
      : `${evaluationTarget} 식당`;
    return {
      screenerTitle: `최근 ${cafeteriaLabel}에서 식사한 적이 있나요?`,
      screenerOptions: [
        "주 3회 이상 이용",
        "주 1~2회 이용",
        "월 1~3회 이용",
        "최근 이용한 적 없음",
      ],
      overallTitle: `${cafeteriaLabel}에서의 식사 경험에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${cafeteriaLabel}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${cafeteriaLabel}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "음식의 맛",
        "가격",
        "양",
        "메뉴 다양성",
        "대기 시간",
        "위생과 청결",
      ],
      detailTitles: [
        "음식의 맛과 품질에 얼마나 만족하시나요?",
        "가격과 양에 얼마나 만족하시나요?",
        "메뉴 다양성과 대기 시간에 얼마나 만족하시나요?",
      ],
      closingTitle: `${cafeteriaLabel}에서 가장 먼저 달라졌으면 하는 점을 적어주세요.`,
    };
  }

  if (domain === "dormitory") {
    return {
      screenerTitle: `${evaluationTarget}을 직접 경험한 적이 있나요?`,
      screenerOptions: [
        "현재 거주 중",
        "최근 학기에 거주함",
        "과거에 거주함",
        "거주한 적 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "방 상태와 생활 환경",
        "청결과 위생",
        "공용시설",
        "생활 규칙",
        "보안과 안전",
        "관리실 응대",
      ],
      detailTitles: [
        "방 상태와 생활 환경에 얼마나 만족하시나요?",
        "청결과 공용시설 관리에 얼마나 만족하시나요?",
        "안전 관리와 관리실 응대에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}이 더 만족스러워지기 위해 바라는 점을 적어주세요.`,
    };
  }

  if (domain === "building") {
    const movement = movementExperience(evaluationTarget);
    if (movement) {
      const { place, activity } = movement;
      const movementLabel = `${place} ${activity}`;
      const destination = labelWithParticle(place, "으로", "로");
      const placeObject = labelWithParticle(place, "을", "를");
      const screenerTitle =
        activity === "등하교"
          ? `이번 학기에 ${destination} 등교하거나 ${place}에서 하교한 빈도는 어느 정도인가요?`
          : `이번 학기에 ${labelWithParticle(movementLabel, "을", "를")} 한 빈도는 어느 정도인가요?`;
      return {
        screenerTitle,
        screenerOptions: [
          "주 4회 이상",
          "주 2~3회",
          "주 1회 이하",
          `이번 학기에 ${movementLabel} 경험 없음`,
        ],
        overallTitle: `${placeObject} 오가는 ${activity} 과정에 전반적으로 얼마나 만족하시나요?`,
        strengthsTitle: `${movementLabel}에서 비교적 편리하다고 느낀 부분을 모두 골라주세요.`,
        improvementTitle: `${movementLabel}에서 개선이 필요하다고 느낀 부분을 모두 골라주세요.`,
        areaOptions: [
          `정문·신촌역·기숙사 등 주요 출발지에서 ${place}까지의 이동 거리`,
          "실제 이동 소요시간",
          "오르막과 계단 부담",
          "비·눈·더위 등 날씨 대응",
          "등하교 시간대 혼잡도",
          "보행로 상태와 이동 안전",
          "셔틀·대중교통과의 연계",
          "길 찾기와 안내표지",
        ],
        detailTitles: [
          `주요 출발지에서 ${place}까지의 거리와 소요시간에 얼마나 만족하시나요?`,
          "오르막·계단 부담과 날씨에 따른 이동 불편은 어느 정도인가요?",
          "혼잡도·보행 안전·셔틀 및 대중교통 연계에 얼마나 만족하시나요?",
        ],
        closingTitle: `${movementLabel} 중 겪은 구체적인 불편이나 가장 먼저 바라는 개선점을 적어주세요.`,
      };
    }

    const buildingLabel =
      evaluationTarget
        .replace(/\s*(?:이용환경|이용(?:\s*경험)?)$/g, "")
        .trim() ||
      experienceBase ||
      evaluationTarget;
    return {
      screenerTitle: `이번 학기에 ${labelWithParticle(buildingLabel, "을", "를")} 직접 이용한 적이 있나요?`,
      screenerOptions: [
        "주 3회 이상 이용",
        "주 1~2회 이용",
        "월 1~3회 이용",
        "이번 학기에 이용한 적 없음",
      ],
      overallTitle: `${buildingLabel} 이용환경에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${buildingLabel}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${buildingLabel}에서 개선이 필요하다고 느낀 부분을 모두 골라주세요.`,
      areaOptions: [
        "주요 수업·활동 장소에서의 이동 거리",
        "건물 출입구와 외부 접근 편의",
        "강의실 좌석·수업 설비와 학습공간",
        "화장실·휴게공간 등 편의시설",
        "엘리베이터·계단과 건물 내부 동선",
        "안내표지와 길 찾기",
        "온도·환기·조명·소음 등 실내환경",
        "청결도와 혼잡도",
        "교통약자 접근성과 안전",
        "시설 상태와 유지보수",
      ],
      detailTitles: [
        `${buildingLabel}까지의 이동 거리와 건물 출입 접근성에 얼마나 만족하시나요?`,
        "강의실·화장실·휴게공간 등 건물 시설에 얼마나 만족하시나요?",
        "엘리베이터·계단·안내표지와 실내 이동 동선에 얼마나 만족하시나요?",
      ],
      closingTitle: `${buildingLabel}을 이용하며 불편했던 상황이나 가장 먼저 바라는 개선점을 적어주세요.`,
    };
  }

  if (domain === "facility") {
    const facilityLabel = experienceBase || evaluationTarget;
    const reservationTarget = facilityLabel
      .replace(/\s*예약(?:\s*경험)?$/g, "")
      .trim();
    const screenerTitle = /예약(?:\s*경험)?$/.test(facilityLabel)
      ? `최근 ${labelWithParticle(reservationTarget || facilityLabel, "을", "를")} 예약하거나 이용한 적이 있나요?`
      : `최근 ${labelWithParticle(facilityLabel, "을", "를")} 직접 이용한 적이 있나요?`;
    return {
      screenerTitle,
      screenerOptions: [
        "최근 1개월 내 이용",
        "최근 3개월 내 이용",
        "3개월보다 오래전에 이용",
        "직접 이용한 적 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "위치와 접근성",
        "공간·좌석과 이용 동선",
        "필요한 설비와 편의시설",
        "청결과 쾌적함",
        "정보 안내와 표지",
        "운영시간과 이용 절차",
        "교통약자 접근성",
        "안전과 시설 관리",
      ],
      detailTitles: [
        "위치와 접근 편의에 얼마나 만족하시나요?",
        "공간·설비·편의시설에 얼마나 만족하시나요?",
        "청결·안내·안전 관리에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}을 이용하며 겪은 불편이나 바라는 변화를 적어주세요.`,
    };
  }

  if (domain === "service") {
    const serviceLabel = experienceBase || evaluationTarget;
    const reservationTarget = serviceLabel
      .replace(/\s*예약(?:\s*경험)?$/g, "")
      .trim();
    const screenerTitle = /예약(?:\s*경험)?$/.test(serviceLabel)
      ? `최근 ${labelWithParticle(reservationTarget || serviceLabel, "을", "를")} 예약하거나 이용한 적이 있나요?`
      : `최근 ${labelWithParticle(serviceLabel, "을", "를")} 직접 사용하거나 이용한 적이 있나요?`;
    return {
      screenerTitle,
      screenerOptions: [
        "최근 1개월 내 이용",
        "최근 3개월 내 이용",
        "3개월보다 오래전에 이용",
        "직접 이용한 적 없음",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "핵심 기능의 정확성",
        "사용 편의성",
        "처리 속도",
        "안내의 명확성",
        "결과의 유용성",
        "오류와 안정성",
      ],
      detailTitles: [
        "원하는 결과를 정확히 얻는 경험에 얼마나 만족하시나요?",
        "사용 방법과 화면의 편리함에 얼마나 만족하시나요?",
        "처리 속도와 안정성에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}을 사용하며 겪은 상황이나 바라는 변화를 적어주세요.`,
    };
  }

  if (domain === "student-life" || domain === "department") {
    const departmentFreshman =
      respondentGroup?.match(/([가-힣A-Za-z0-9]+학과)/)?.[1] &&
      /신입생|새내기/.test(respondentGroup ?? "");
    return {
      screenerTitle: departmentFreshman
        ? `현재 ${respondentGroup?.match(/([가-힣A-Za-z0-9]+학과)/)?.[1]} 신입생인가요?`
        : respondentGroup
          ? `현재 ${respondentGroup}에 해당하시나요?`
          : "현재 이 설문의 학생 대상에 해당하시나요?",
      screenerOptions: [
        "네, 해당합니다",
        "과거에는 해당했습니다",
        "해당하지 않습니다",
      ],
      overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
      strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
      improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
      areaOptions: [
        "수업과 학업 경험",
        "학교·학과 정보 안내",
        "친구·선후배 관계",
        "교내 활동",
        "시설 이용",
        "진로·상담 지원",
      ],
      detailTitles: [
        "수업과 학업 경험에 얼마나 만족하시나요?",
        "필요한 정보와 지원을 얻는 경험에 얼마나 만족하시나요?",
        "친구·선후배와의 관계 및 소속감에 얼마나 만족하시나요?",
      ],
      closingTitle: `${evaluationTarget}이 더 만족스러워지기 위해 필요한 점을 적어주세요.`,
    };
  }

  const directExperience = respondentGroup
    ? `현재 ${respondentGroup}에 해당하거나 관련 경험이 있나요?`
    : `${labelWithParticle(evaluationTarget, "을", "를")} 직접 경험하거나 이용한 적이 있나요?`;
  return {
    screenerTitle: directExperience,
    screenerOptions: [
      "현재 직접 경험 중",
      "최근에 경험함",
      "과거에 경험함",
      "직접 경험한 적 없음",
    ],
    overallTitle: `${evaluationTarget}에 전반적으로 얼마나 만족하시나요?`,
    strengthsTitle: `${evaluationTarget}에서 만족한 부분을 모두 골라주세요.`,
    improvementTitle: `${evaluationTarget}에서 개선이 필요한 부분을 모두 골라주세요.`,
    areaOptions: [
      "내용과 품질",
      "이용·참여 편의",
      "정보와 안내",
      "운영 방식",
      "접근성과 시간",
      "담당자·구성원 응대",
    ],
    detailTitles: [
      "내용과 품질에 얼마나 만족하시나요?",
      "이용·참여 과정의 편리함에 얼마나 만족하시나요?",
      "정보 안내와 운영 방식에 얼마나 만족하시나요?",
    ],
    closingTitle: `${evaluationTarget}이 더 좋아지기 위해 바라는 점을 적어주세요.`,
  };
}

function satisfactionBlueprint(
  semantics: SurveySemantics,
): SurveyBlueprint {
  const {
    respondentGroup,
    evaluationTarget,
    explicitTopic,
    assumptions,
  } = semantics;
  const profile = satisfactionProfile(semantics);
  const department = respondentGroup?.match(/([가-힣A-Za-z0-9]+학과)/)?.[1];
  const isDepartmentFreshman =
    semantics.domain === "department" &&
    Boolean(department) &&
    /신입생|새내기/.test(respondentGroup ?? "");
  const movement = movementExperience(evaluationTarget);

  let titleFocus = evaluationTarget;
  if (movement) {
    titleFocus = `${movement.place} ${movement.activity}`;
  }
  if (respondentGroup) {
    const titleRespondent = respondentGroup.replace(
      /^(.+?)에\s*가입한\s+학생$/,
      "$1 회원",
    );
    titleFocus = titleRespondent;
    if (isDepartmentFreshman && !explicitTopic) {
      titleFocus = `${titleRespondent} 학과생활`;
    } else if (
      explicitTopic &&
      !titleRespondent.includes(explicitTopic) &&
      !explicitTopic.includes("만족")
    ) {
      titleFocus = `${titleRespondent} ${explicitTopic}`;
    }
  }

  const templateQuestions = [
    question(
      1,
      profile.screenerTitle,
      "조사 대상과 실제 경험 여부를 먼저 확인해 결과가 엉뚱한 집단과 섞이지 않게 해요.",
      "single",
      profile.screenerOptions,
    ),
    question(
      2,
      profile.overallTitle,
      "전체 만족도를 5점 척도로 확인해 세부 경험을 해석할 기준을 만들어요.",
      "scale",
    ),
    question(
      3,
      profile.strengthsTitle,
      "현재 경험에서 유지해야 할 강점을 구체적인 영역으로 확인해요.",
      "multiple",
      [...profile.areaOptions, "아직 만족한 부분이 없음"],
    ),
    question(
      4,
      profile.improvementTitle,
      "개선 수요가 몰리는 영역을 찾아 우선순위를 정할 수 있어요.",
      "multiple",
      [...profile.areaOptions, "개선이 필요하다고 느낀 부분 없음"],
    ),
    question(
      5,
      profile.closingTitle,
      "선택지로 담기 어려운 실제 상황과 구체적인 개선 아이디어를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  const aiQuestions = [
    { ...templateQuestions[0], id: 1 },
    { ...templateQuestions[1], id: 2 },
    question(
      3,
      profile.detailTitles[0],
      "전체 점수만으로 보이지 않는 첫 번째 핵심 경험을 별도로 진단해요.",
      "scale",
    ),
    question(
      4,
      profile.detailTitles[1],
      "개선 가능한 두 번째 핵심 경험을 같은 척도로 비교해요.",
      "scale",
    ),
    question(
      5,
      profile.detailTitles[2],
      "대상과 주제에 맞는 세 번째 핵심 경험의 만족도를 확인해요.",
      "scale",
    ),
    question(
      6,
      profile.improvementTitle.replace("모두 골라주세요", "우선적으로 골라주세요"),
      "세부 만족도와 함께 가장 먼저 손볼 영역을 직접 확인해요.",
      "multiple",
      [...profile.areaOptions, "개선이 필요하다고 느낀 부분 없음"],
    ),
    question(
      7,
      profile.closingTitle,
      "선택한 영역과 관련된 실제 상황과 바라는 변화를 구체적으로 받아요.",
      "text",
      undefined,
      false,
    ),
  ];

  const description = movement
    ? `${labelWithParticle(movement.place, "을", "를")} 오가는 ${movement.activity} 빈도와 거리·소요시간, 오르막·계단, 날씨, 혼잡·안전, 교통 연계 및 개선 의견을 파악하는 익명 설문입니다.`
    : respondentGroup
      ? `${labelWithParticle(respondentGroup, "을", "를")} 대상으로 ${evaluationTarget}의 만족 요인과 개선 필요 영역을 파악하는 익명 설문입니다.`
      : `${evaluationTarget}의 전반적인 만족도와 세부 경험, 개선 필요 영역을 파악하는 익명 설문입니다.`;
  const titleSuffix =
    movement && semantics.requestedAsOpinion ? "의견 조사" : "만족도 조사";

  return {
    kind: "satisfaction",
    intentLabel: movement ? "이동 경험·개선" : "만족도·개선",
    subject: titleFocus,
    title: `${titleFocus} ${titleSuffix}`,
    description,
    templateTitle: movement
      ? `${titleFocus} 핵심 의견`
      : `${titleFocus} 만족도`,
    templateSummary:
      "응답 대상 확인부터 전체 만족도, 세부 경험과 개선 우선순위까지 문맥에 맞게 확인해요.",
    detectedSignals: [],
    templateQuestions,
    aiQuestions,
    respondentGroup,
    evaluationTarget,
    goal: semantics.goalLabel,
    assumptions,
    aiTitle: `${titleFocus} 맞춤 설문`,
  };
}

function eventSatisfactionBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic}에 어느 정도 참여하셨나요?`,
      "전체 참여자와 일부 참여자를 구분해 만족도 결과를 더 정확히 해석해요.",
      "single",
      ["전체 일정에 참여함", "일부 일정에 참여함", "현장에는 방문했지만 프로그램에는 거의 참여하지 않음"],
    ),
    question(
      2,
      `${topic}에 전반적으로 얼마나 만족하셨나요?`,
      "참여자가 느낀 전체 만족도를 5점 척도로 확인해요.",
      "scale",
    ),
    question(
      3,
      `${topic}에서 만족한 부분을 모두 골라주세요.`,
      "다음 행사에서도 유지할 강점과 만족 요인을 찾을 수 있어요.",
      "multiple",
      ["프로그램 구성", "공연·콘텐츠", "진행과 안내", "현장 분위기", "장소와 시설", "먹거리·부스"],
    ),
    question(
      4,
      `${topic}에서 아쉽거나 개선이 필요했던 부분을 모두 골라주세요.`,
      "참여자가 실제로 체감한 개선 우선순위를 확인해요.",
      "multiple",
      ["프로그램 구성", "대기 시간·혼잡", "진행과 안내", "장소와 시설", "안전 관리", "먹거리·부스"],
    ),
    question(
      5,
      `다음 ${topicWithParticle(subject, "을", "를")} 위해 바라는 점을 자유롭게 적어주세요.`,
      "선택지로 놓친 구체적인 경험과 개선 의견을 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "event",
    intentLabel: "참여자 만족도·개선",
    subject,
    title: `${subject} 참여자 만족도 조사`,
    description: `${subject} 참여자의 전반적인 만족도와 만족 요인, 개선 요구를 파악하기 위한 익명 설문입니다.`,
    templateTitle: `${subject} 참여자 만족도`,
    templateSummary: "참여 범위와 전체 만족도, 좋았던 점, 개선 우선순위를 행사에 맞게 확인해요.",
    detectedSignals: [`대상 · ${subject} 참여자`, "목적 · 만족도와 개선점"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topic} 소식을 처음 접한 경로는 무엇인가요?`,
        "실제 참여자에게 도달한 홍보 채널을 확인해 다음 홍보에 활용해요.",
        "single",
        ["지인", "교내 커뮤니티", "SNS", "문자·이메일", "포스터·현수막", "기타"],
      ),
      ...templateQuestions.slice(2, 4).map((item, index) => ({
        ...item,
        id: index + 4,
      })),
      question(
        6,
        `다음 ${topic}에도 다시 참여할 의향이 어느 정도인가요?`,
        "현재 만족도가 실제 재참여 가능성으로 이어지는지 확인해요.",
        "scale",
      ),
      {
        ...templateQuestions[4],
        id: 7,
      },
    ],
  };
}

function eventBarrierBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic} 참여 여부를 알려주세요.`,
      "참여자와 비참여자를 먼저 구분해 불참 이유를 잘못 해석하지 않게 해요.",
      "single",
      [
        "전체 또는 대부분 참여함",
        "일부만 참여함",
        "참여하지 못했지만 관심은 있었음",
        "참여하지 않았고 관심도 없었음",
      ],
    ),
    question(
      2,
      `${topic}에 참여하지 못했거나 일부만 참여한 이유를 모두 골라주세요.`,
      "시간, 정보, 장소, 콘텐츠 등 실제 참여 장벽을 구분해요.",
      "multiple",
      [
        "일정·시간이 맞지 않음",
        "행사 정보를 늦게 알거나 잘 몰랐음",
        "관심 가는 프로그램이 부족했음",
        "장소·이동이 불편했음",
        "비용이 부담됐음",
        "함께 갈 사람이 없었음",
        "해당 없음 — 충분히 참여함",
      ],
    ),
    question(
      3,
      `어떤 프로그램이나 내용이 있다면 ${topic}에 참여하고 싶나요?`,
      "단순 불참 원인을 넘어 실제 참여를 만들 콘텐츠를 확인해요.",
      "multiple",
      [
        "공연·문화 콘텐츠",
        "친목·교류 프로그램",
        "체험·참여형 부스",
        "진로·학업 관련 프로그램",
        "먹거리·휴식 공간",
        "특별히 원하는 내용 없음",
      ],
    ),
    question(
      4,
      `다음 ${topic}에 참여할 의향이 어느 정도인가요?`,
      "현재 장벽이 해결될 때 향후 참여 가능성이 있는지 확인해요.",
      "scale",
    ),
    question(
      5,
      `${topic}에 더 쉽게 참여할 수 있으려면 무엇이 달라져야 할까요?`,
      "선택지로 놓친 개인 상황과 구체적인 개선 아이디어를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "event",
    intentLabel: "참여 여부·장벽",
    subject,
    title: `${subject} 참여 여부와 불참 이유 조사`,
    description: `${subject}의 참여 현황과 불참 이유, 향후 참여를 높일 조건을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 참여 여부·불참 이유`,
    templateSummary:
      "참여 여부를 먼저 나눈 뒤 불참 이유와 향후 참여 조건을 확인해요.",
    detectedSignals: [],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topic} 소식을 처음 접한 경로는 무엇인가요?`,
        "정보가 실제 대상에게 도달했는지 홍보 접점별로 확인해요.",
        "single",
        [
          "지인·선후배",
          "교내 커뮤니티",
          "인스타그램 등 SNS",
          "문자·이메일",
          "포스터·현수막",
          "행사를 알지 못했음",
        ],
      ),
      {
        ...templateQuestions[2],
        id: 4,
      },
      question(
        5,
        `${topic} 참여를 결정할 때 가장 중요한 조건을 모두 골라주세요.`,
        "프로그램 외에도 일정과 접근성 등 참여 전환 조건을 확인해요.",
        "multiple",
        [
          "일정과 운영 시간",
          "프로그램 내용",
          "장소와 접근성",
          "비용",
          "동행 여부",
          "사전 안내의 충분함",
        ],
      ),
      {
        ...templateQuestions[3],
        id: 6,
      },
      {
        ...templateQuestions[4],
        id: 7,
      },
    ],
  };
}

function eventBlueprint(subject: string, prompt: string): SurveyBlueprint {
  if (/만족|불만|평가|개선점/.test(prompt)) {
    return eventSatisfactionBlueprint(subject);
  }
  if (/불참|참여하지|참가하지/.test(prompt)) {
    return eventBarrierBlueprint(subject);
  }

  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic} 참여 여부를 알려주세요.`,
      "참여자와 비참여자를 구분해 이후 응답을 정확히 해석해요.",
      "single",
      ["참여함", "일부 일정만 참여함", "참여하지 못했지만 관심 있었음", "참여하지 않았고 관심 없었음"],
    ),
    question(
      2,
      `${topic}에 참여하거나 참여하지 않은 가장 큰 이유는 무엇인가요?`,
      "참여를 이끈 요인과 참여 장벽을 함께 확인해요.",
      "single",
      ["프로그램 내용", "지인과 함께하기 위해", "일정·시간", "장소·접근성", "홍보 정보", "관심 부족"],
    ),
    question(
      3,
      `${topic}의 전반적인 경험에 얼마나 만족하시나요?`,
      "행사 경험의 전체 수준을 공통 척도로 측정해요.",
      "scale",
    ),
    question(
      4,
      `${topic}에서 좋았던 부분을 모두 골라주세요.`,
      "다음 운영에서도 유지할 강점을 찾을 수 있어요.",
      "multiple",
      ["프로그램 구성", "진행과 안내", "현장 분위기", "장소와 시설", "참여자 혜택", "교류 기회"],
    ),
    question(
      5,
      `다음 ${topicWithParticle(subject, "을", "를")} 위해 개선할 점을 적어주세요.`,
      "다음 기획에 바로 반영할 구체적인 의견을 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "event",
    intentLabel: "참여·행사 경험",
    subject,
    title: `${subject} 참여 및 경험 조사`,
    description: `${subject}의 참여 현황과 경험, 다음 운영을 위한 개선점을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 참여·경험`,
    templateSummary: "참여 여부와 동기, 만족 요소, 다음 운영을 위한 개선점을 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 참여 현황과 경험"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topic} 소식을 처음 접한 경로는 무엇인가요?`,
        "실제 참여로 이어지는 홍보 채널을 찾을 수 있어요.",
        "single",
        ["지인", "교내 커뮤니티", "SNS", "문자·이메일", "포스터·현수막", "기타"],
      ),
      ...templateQuestions.slice(2).map((item, index) => ({
        ...item,
        id: index + 4,
      })),
      question(
        7,
        `앞으로 비슷한 ${topic}에 다시 참여할 의향이 어느 정도인가요?`,
        "현재 경험이 재참여 가능성으로 이어지는지 확인해요.",
        "scale",
      ),
    ],
  };
}

function adoptionBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topicWithParticle(subject, "을", "를")} 현재 알고 있거나 사용해본 적이 있나요?`,
      "인지, 체험, 현재 사용 단계를 구분해 결과를 해석해요.",
      "single",
      ["현재 사용 중", "사용해본 적 있음", "알지만 사용 경험 없음", "처음 들어봄"],
    ),
    question(
      2,
      `앞으로 ${topicWithParticle(subject, "을", "를")} 사용하거나 구매할 의향이 어느 정도인가요?`,
      "핵심 목표인 도입 가능성을 5점 척도로 측정해요.",
      "scale",
    ),
    question(
      3,
      `${topicWithParticle(subject, "을", "를")} 선택할 때 중요하게 보는 요소를 모두 골라주세요.`,
      "사용 의향을 높이는 핵심 가치를 파악해요.",
      "multiple",
      ["가격", "기능", "사용 편의성", "안전·신뢰성", "주변 평가", "디자인"],
    ),
    question(
      4,
      `${topic} 사용을 망설이게 하는 이유를 모두 골라주세요.`,
      "도입 전환을 막는 실제 장벽을 구분해요.",
      "multiple",
      ["가격 부담", "필요성 부족", "사용법이 어려워 보임", "품질·안전 우려", "정보 부족", "기존 대안에 만족"],
    ),
    question(
      5,
      `${topicWithParticle(subject, "을", "를")} 더 이용하고 싶게 만들 기능이나 조건을 적어주세요.`,
      "선택지 밖의 구체적인 도입 조건을 찾을 수 있어요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "adoption",
    intentLabel: "사용·구매 의향",
    subject,
    title: `${subject} 이용 의향 조사`,
    description: `${subject}에 대한 인지 수준과 이용 의향, 선택 요인 및 이용 장벽을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 이용 의향`,
    templateSummary: "인지·경험 단계부터 이용 의향, 선택 기준과 이용 장벽까지 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 사용 또는 구매 의향"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topicWithParticle(subject, "이", "가")} 필요하다고 느끼는 상황을 모두 골라주세요.`,
        "추상적인 의향을 실제 사용 장면과 연결해요.",
        "multiple",
        ["시간을 절약하고 싶을 때", "기존 방식이 불편할 때", "더 좋은 결과가 필요할 때", "주변에서 추천할 때", "가격 혜택이 있을 때", "아직 필요성을 느끼지 못함"],
      ),
      ...templateQuestions.slice(2).map((item, index) => ({
        ...item,
        id: index + 4,
      })),
      question(
        7,
        `${topicWithParticle(subject, "을", "를")} 처음 시도하기에 적절하다고 느끼는 조건은 무엇인가요?`,
        "체험, 가격, 정보 등 첫 사용을 만드는 전환 조건을 확인해요.",
        "single",
        ["무료 체험", "학생 할인", "주변 추천", "충분한 사용 후기", "간단한 사용 안내", "특별한 조건이 있어도 이용하지 않을 것 같음"],
      ),
    ],
  };
}

function usageBlueprint(subject: string, brief?: SurveyBrief): SurveyBlueprint {
  const timeframe = brief?.recommendedTimeframe || "최근 3개월";
  const targetRespondents = brief?.targetRespondents ?? null;
  const corpus = `${subject} ${brief?.normalizedBrief ?? ""}`;
  const contextPrefix = brief?.researchContext
    ? `${brief.researchContext.replace(/에서$/, "")}에서 `
    : "";
  const hasAwarenessDimension = hasAwarenessAndUsageDimensions(corpus);
  const isContentService =
    /웹툰|웹소설|OTT|동영상|영상\s*플랫폼|음악\s*스트리밍|콘텐츠\s*플랫폼/.test(corpus);
  const isDeliveryApp = /배달\s*앱|배달앱|음식\s*배달/.test(corpus);
  const questions: SurveyQuestion[] = [];

  if (hasAwarenessDimension) {
    questions.push(
      question(
        questions.length + 1,
        `${contextPrefix}${labelWithParticle(subject, "을", "를")} 이전부터 알고 있었나요?`,
        "조사 대상에 대한 사전 인지 수준을 실제 이용 경험과 분리해 확인해요.",
        "single",
        [
          "어떤 대상인지 잘 알고 있었음",
          "이름과 주요 특징을 알고 있었음",
          "이름만 들어본 적이 있음",
          "이번에 처음 알게 됨",
        ],
      ),
    );
  } else if (targetRespondents && /대학|학생/.test(targetRespondents)) {
    questions.push(
      question(
        questions.length + 1,
        "현재 대학교 또는 대학원에 재학하거나 휴학 중이신가요?",
        "응답자가 조사 대상인 대학생에 해당하는지 먼저 확인해 결과 해석의 기준을 세워요.",
        "single",
        ["재학 중", "휴학 중", "졸업 또는 수료", "해당하지 않음"],
      ),
    );
  }

  questions.push(
    question(
      questions.length + 1,
      `${timeframe} 이내 ${contextPrefix}${labelWithParticle(subject, "을", "를")} 이용한 적이 있나요?`,
      "최근 이용자와 비이용자를 구분해 이후 이용 경험 문항을 정확히 해석해요.",
      "single",
      ["예", "아니요"],
    ),
    question(
      questions.length + 2,
      `최근 1개월 동안 ${contextPrefix}${labelWithParticle(subject, "을", "를")} 얼마나 자주 이용했나요?`,
      "기준 기간을 고정해 이용 빈도를 서로 비교할 수 있게 해요.",
      "single",
      ["이용하지 않음", "월 1회", "월 2~3회", "월 4~7회", "월 8회 이상"],
    ),
  );

  if (isContentService) {
    questions.push(
      question(
        questions.length + 1,
        `${labelWithParticle(subject, "을", "를")} 한 번 이용할 때 평균적으로 얼마나 오래 이용하나요?`,
        "회당 이용 시간을 구분해 실제 콘텐츠 소비 강도를 파악해요.",
        "single",
        ["10분 미만", "10분 이상 20분 미만", "20분 이상 40분 미만", "40분 이상 1시간 미만", "1시간 이상"],
      ),
      question(
        questions.length + 2,
        `${labelWithParticle(subject, "을", "를")} 주로 어떤 상황에서 이용하나요?`,
        "통학, 휴식, 취침 전 등 실제 이용 맥락을 구분해 이용 행태를 설명해요.",
        "multiple",
        ["통학하거나 이동할 때", "수업 또는 일정 사이 쉬는 시간", "잠들기 전", "식사하거나 휴식할 때", "심심하거나 스트레스를 풀고 싶을 때", "좋아하는 작품의 업데이트를 확인할 때", "기타"],
      ),
      question(
        questions.length + 3,
        `${subject}에서 주로 이용하는 콘텐츠 장르를 모두 골라주세요.`,
        "콘텐츠 선호를 장르별로 비교해 주요 이용 동기를 파악해요.",
        "multiple",
        ["로맨스", "판타지", "액션", "드라마", "코미디", "스릴러·공포", "일상", "기타"],
      ),
      question(
        questions.length + 4,
        `${subject}의 전반적인 이용 경험에 얼마나 만족하시나요?`,
        "전반적 만족도를 공통 척도로 측정해 세부 경험과 함께 해석해요.",
        "scale",
      ),
      question(
        questions.length + 5,
        `${labelWithParticle(subject, "을", "를")} 이용하면서 불편하다고 느낀 점을 모두 골라주세요.`,
        "작품 탐색, 광고, 결제, 추천과 사용성 중 개선이 필요한 영역을 찾을 수 있어요.",
        "multiple",
        ["원하는 콘텐츠를 찾기 어려움", "광고가 많음", "유료 콘텐츠 또는 결제 부담", "앱이나 웹의 사용성이 불편함", "추천 콘텐츠가 취향과 맞지 않음", "댓글 또는 커뮤니티 경험이 좋지 않음", "특별히 불편한 점이 없음", "기타"],
      ),
      question(
        questions.length + 6,
        `최근 3개월 동안 ${subject}에서 유료 콘텐츠를 결제한 경험이 있나요?`,
        "무료 이용자와 결제 이용자를 구분해 비용 경험을 별도로 분석해요.",
        "single",
        ["정기적으로 결제함", "한두 번 결제함", "결제를 고민했지만 하지 않음", "결제한 적 없음"],
      ),
      question(
        questions.length + 7,
        `앞으로도 ${labelWithParticle(subject, "을", "를")} 계속 이용할 의향이 어느 정도인가요?`,
        "현재 경험이 지속 이용 가능성으로 이어지는지 확인해요.",
        "scale",
      ),
    );
  } else if (isDeliveryApp) {
    questions.push(
      question(
        questions.length + 1,
        `${labelWithParticle(subject, "을", "를")} 주로 어떤 상황에서 이용하나요?`,
        "실제 주문 상황을 구분해 이용 빈도의 맥락을 파악해요.",
        "multiple",
        ["퇴근 후 식사", "야근 또는 늦은 시간", "주말 식사", "모임 또는 손님 방문", "비나 눈 등 외출이 어려울 때", "쿠폰이나 할인 행사가 있을 때", "기타"],
      ),
      question(
        questions.length + 2,
        `${subject}을 선택할 때 가장 중요하게 보는 기준을 모두 골라주세요.`,
        "메뉴, 가격, 배달 시간과 혜택 중 실제 선택 기준을 비교해요.",
        "multiple",
        ["메뉴와 음식점 다양성", "배달비", "최소 주문 금액", "예상 배달 시간", "쿠폰·할인", "리뷰의 신뢰도", "앱 사용 편의"],
      ),
      question(
        questions.length + 3,
        `${labelWithParticle(subject, "을", "를")} 이용하면서 가장 불편했던 점을 모두 골라주세요.`,
        "주문·결제·배달 과정의 실제 불편을 구분해 개선 우선순위를 정해요.",
        "multiple",
        ["배달비 부담", "최소 주문 금액", "예상보다 긴 배달 시간", "메뉴 정보 부족", "리뷰 신뢰 어려움", "주문·결제 오류", "고객 지원 불편", "특별한 불편 없음"],
      ),
      question(
        questions.length + 4,
        `${subject}의 전반적인 이용 경험에 얼마나 만족하시나요?`,
        "이용 빈도와 불편 사항을 전반적 만족도와 연결해 해석해요.",
        "scale",
      ),
      question(
        questions.length + 5,
        `${subject} 이용에서 가장 먼저 개선되었으면 하는 점을 적어주세요.`,
        "선택지로 담기 어려운 실제 상황과 개선 요구를 수집해요.",
        "text",
        undefined,
        false,
      ),
    );
  } else {
    questions.push(
      question(
        questions.length + 1,
        `${contextPrefix}${labelWithParticle(subject, "을", "를")} 주로 어떤 목적으로 이용하나요?`,
        "실제 이용 목적을 한 가지 개념으로 분리해 이용 행태를 해석해요.",
        "multiple",
        ["수업·학습", "과제·업무", "정보 탐색", "소통·협업", "개인적인 용도", "기타"],
      ),
      question(
        questions.length + 2,
        `${subject}의 전반적인 이용 경험에 얼마나 만족하시나요?`,
        "전반적 경험 수준을 공통 척도로 확인해요.",
        "scale",
      ),
      question(
        questions.length + 3,
        `${labelWithParticle(subject, "을", "를")} 이용하면서 불편했던 점을 모두 골라주세요.`,
        "접근, 속도, 안내, 비용과 안정성 중 개선이 필요한 영역을 구분해요.",
        "multiple",
        ["원하는 내용을 찾기 어려움", "이용 절차가 복잡함", "속도가 느리거나 불안정함", "안내가 부족함", "비용이 부담됨", "특별한 불편 없음", "기타"],
      ),
      question(
        questions.length + 4,
        `앞으로도 ${labelWithParticle(subject, "을", "를")} 계속 이용할 의향이 어느 정도인가요?`,
        "현재 경험이 지속 이용 가능성으로 이어지는지 확인해요.",
        "scale",
      ),
      question(
        questions.length + 5,
        `${subject} 이용에서 가장 먼저 개선되었으면 하는 점을 적어주세요.`,
        "선택지 밖의 구체적인 경험과 개선 아이디어를 수집해요.",
        "text",
        undefined,
        false,
      ),
    );

    if (hasAwarenessDimension) {
      questions.pop();
    }
  }

  const templateQuestions = questions.slice(0, 5).map((item, index) => ({
    ...item,
    id: index + 1,
  }));
  const aiQuestions = questions.map((item, index) => ({ ...item, id: index + 1 }));
  return {
    kind: "usage",
    intentLabel: "이용 현황·경험",
    subject,
    title: brief?.surveyTitle ?? `${subject} 이용 현황 및 경험 조사`,
    description: brief
      ? `본 조사는 ${brief.targetRespondents}의 ${subject} 이용 행태와 서비스 경험을 파악하기 위한 조사입니다. ${timeframe}의 이용 경험을 기준으로 응답해 주세요.`
      : `${subject}의 실제 이용 방식과 만족도, 불편 요소 및 개선 요구를 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 이용 현황 및 경험`,
    templateSummary: "이용 여부와 빈도, 실제 이용 맥락, 만족도와 불편 사항을 대상 특성에 맞게 확인해요.",
    detectedSignals: [
      `응답 대상 · ${targetRespondents ?? "별도 지정 없음"}`,
      `조사 대상 · ${subject}`,
      `기준 기간 · ${timeframe}`,
    ],
    templateQuestions,
    aiQuestions,
    respondentGroup: targetRespondents,
    evaluationTarget: subject,
    goal: brief?.researchGoal ?? "이용 현황과 경험 파악",
    assumptions: brief ? [`${timeframe}의 경험을 기준으로 응답하도록 구성했어요.`] : [],
    domain: brief?.domain,
  };
}

function collaborationBlueprint(brief: SurveyBrief): SurveyBlueprint {
  const questions = [
    question(1, "최근 1년 이내 대학 수업에서 팀플을 수행한 경험이 있나요?", "실제 팀플 경험이 있는 응답자를 먼저 구분해 이후 답변을 정확히 해석해요.", "single", ["예", "아니요"]),
    question(2, "가장 최근 팀플에서 의견 충돌이나 갈등을 얼마나 자주 겪었나요?", "기준 경험을 하나로 고정해 갈등 발생 수준을 비교해요.", "single", ["전혀 없었음", "1회", "2~3회", "4회 이상", "프로젝트 내내 반복됨"]),
    question(3, "갈등이 생긴 주된 원인을 모두 골라주세요.", "역할, 참여도, 일정, 소통과 결과물 기준 중 실제 갈등 원인을 구분해요.", "multiple", ["역할 분담", "참여도 차이", "일정 조율", "의사소통 방식", "결과물 품질 기준", "리더십 또는 의사결정", "특별한 갈등 없음", "기타"]),
    question(4, "가장 최근 팀플의 역할 분담은 얼마나 공정했다고 느끼나요?", "갈등과 만족도에 영향을 주는 역할 분담의 공정성을 별도로 측정해요.", "scale"),
    question(5, "팀원 간 진행 상황과 의견은 주로 어떤 방식으로 공유했나요?", "실제 협업 채널과 소통 방식을 파악해 갈등 원인과 함께 분석해요.", "multiple", ["대면 회의", "카카오톡 등 메신저", "화상 회의", "공유 문서", "협업 도구", "정기적으로 공유하지 않음", "기타"]),
    question(6, "가장 최근 팀플의 협업 경험에 전반적으로 얼마나 만족하시나요?", "갈등, 역할 분담과 소통 경험을 종합한 만족도 기준을 만들어요.", "scale"),
    question(7, "다음 팀플에서 가장 먼저 달라졌으면 하는 점을 적어주세요.", "선택지로 담기 어려운 구체적인 개선 방법을 수집해요.", "text", undefined, false),
  ];
  return {
    kind: "problem",
    intentLabel: "갈등·협업 경험",
    subject: brief.researchSubject,
    title: brief.surveyTitle,
    description: `본 조사는 ${brief.targetRespondents}이 가장 최근 팀플에서 겪은 갈등 원인, 역할 분담, 소통 방식과 협업 만족도를 파악하기 위한 조사입니다.`,
    templateTitle: "팀플 갈등 및 협업 경험",
    templateSummary: "실제 팀플 경험을 기준으로 갈등, 역할 분담, 소통과 만족도를 분리해 확인해요.",
    detectedSignals: [
      `응답 대상 · ${brief.targetRespondents}`,
      `조사 대상 · ${brief.researchSubject}`,
      `기준 경험 · ${brief.recommendedTimeframe}`,
    ],
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    respondentGroup: brief.targetRespondents,
    evaluationTarget: brief.researchSubject,
    goal: brief.researchGoal,
    assumptions: [],
    domain: "student-life",
  };
}

function cafeteriaBriefBlueprint(brief: SurveyBrief): SurveyBlueprint {
  const subject = brief.researchSubject;
  const questions = [
    question(1, `현재 ${brief.targetRespondents}에 해당하시나요?`, "조사 대상 학생에 해당하는지 먼저 확인해 결과 해석의 기준을 세워요.", "single", ["재학 중", "휴학 중", "졸업 또는 수료", "해당하지 않음"]),
    question(2, `최근 1학기 동안 ${labelWithParticle(subject, "을", "를")} 이용한 적이 있나요?`, "최근 이용자와 비이용자를 구분해 만족도 결과가 섞이지 않게 해요.", "single", ["예", "아니요"]),
    question(3, `최근 1개월 동안 ${labelWithParticle(subject, "을", "를")} 평균적으로 얼마나 자주 이용했나요?`, "기준 기간을 고정해 실제 이용 빈도를 비교해요.", "single", ["이용하지 않음", "월 1~3회", "주 1~2회", "주 3~4회", "주 5회 이상"]),
    question(4, `${subject}을 선택할 때 중요하게 보는 요소를 모두 골라주세요.`, "학생이 식당을 선택하는 실제 기준을 파악해 만족도 결과와 연결해요.", "multiple", ["메뉴", "맛", "가격", "양", "대기 시간", "위생", "좌석과 혼잡", "이동 거리"]),
    question(5, `${subject}의 메뉴와 음식 맛에 얼마나 만족하시나요?`, "식당 경험의 핵심인 메뉴와 맛을 별도로 평가해요.", "scale"),
    question(6, `${subject}의 가격 대비 가치와 음식 양에 얼마나 만족하시나요?`, "가격 부담과 제공량을 함께 보는 가치 평가 기준을 만들어요.", "scale"),
    question(7, `${labelWithParticle(subject, "을", "를")} 이용하면서 불편했던 점을 모두 골라주세요.`, "대기, 혼잡, 위생과 운영 시간 중 개선이 필요한 영역을 구분해요.", "multiple", ["대기 시간이 김", "좌석이 부족하거나 혼잡함", "메뉴가 다양하지 않음", "가격이 부담됨", "음식 양이 부족함", "위생이 아쉬움", "운영 시간이 맞지 않음", "특별한 불편 없음"]),
    question(8, `${subject} 이용 경험에 전반적으로 얼마나 만족하시나요?`, "세부 경험을 종합한 전반적 만족도 기준을 만들어요.", "scale"),
    question(9, `${subject}에서 가장 먼저 개선되었으면 하는 점을 적어주세요.`, "선택지 밖의 구체적인 이용 상황과 개선 요구를 수집해요.", "text", undefined, false),
  ];
  return {
    kind: "satisfaction",
    intentLabel: "학식당 이용 경험·만족도",
    subject,
    title: brief.surveyTitle,
    description: `본 조사는 ${brief.targetRespondents}의 ${subject} 이용 경험과 만족도를 파악하기 위한 조사입니다. 최근 1학기의 이용 경험을 기준으로 응답해 주세요.`,
    templateTitle: `${subject} 이용 경험 및 만족도`,
    templateSummary: "이용 여부와 빈도부터 식당 고유 경험, 만족도와 개선점까지 확인해요.",
    detectedSignals: [
      `응답 대상 · ${brief.targetRespondents}`,
      `조사 대상 · ${subject}`,
      "목적 · 이용 경험 및 만족도",
    ],
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    respondentGroup: brief.targetRespondents,
    evaluationTarget: subject,
    goal: brief.researchGoal,
    assumptions: [],
    domain: "cafeteria",
  };
}

function needsBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topicWithParticle(subject, "이", "가")} 현재 얼마나 필요하다고 느끼시나요?`,
      "수요의 강도를 5점 척도로 비교할 수 있어요.",
      "scale",
    ),
    question(
      2,
      `${topicWithParticle(subject, "이", "가")} 필요한 가장 큰 이유는 무엇인가요?`,
      "수요가 생기는 핵심 상황과 목적을 확인해요.",
      "single",
      ["시간 절약", "비용 절감", "편의성 향상", "정보 부족 해결", "교류·참여 기회", "현재는 필요하지 않음"],
    ),
    question(
      3,
      `${topic}에서 중요하게 생각하는 조건을 모두 골라주세요.`,
      "제공 방식을 설계할 때 우선해야 할 조건을 찾을 수 있어요.",
      "multiple",
      ["가격", "접근성", "이용 시간", "품질", "신뢰성", "다양한 선택지"],
    ),
    question(
      4,
      `${topicWithParticle(subject, "을", "를")} 실제로 이용하기 어려운 이유를 모두 골라주세요.`,
      "잠재 수요가 실제 이용으로 이어지지 않는 장벽을 파악해요.",
      "multiple",
      ["정보 부족", "비용 부담", "시간이 맞지 않음", "접근이 어려움", "기존 대안으로 충분함", "필요성이 낮음"],
    ),
    question(
      5,
      `${topic}과 관련해 원하는 점을 자유롭게 적어주세요.`,
      "예상하지 못한 구체적인 요구와 아이디어를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "needs",
    intentLabel: "수요·필요",
    subject,
    title: `${subject} 수요 조사`,
    description: `${subject}에 대한 필요 수준과 이용 조건, 수요를 막는 요인을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 수요 파악`,
    templateSummary: "필요 수준, 이용 목적, 중요 조건과 이용 장벽을 함께 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 수요와 필요 조건"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topicWithParticle(subject, "을", "를")} 어느 정도 빈도로 이용할 것 같나요?`,
        "필요성뿐 아니라 예상 이용량을 구체적으로 확인해요.",
        "single",
        ["거의 매일", "주 1~3회", "월 1~3회", "특별한 상황에서만", "이용하지 않을 것 같음"],
      ),
      ...templateQuestions.slice(2).map((item, index) => ({
        ...item,
        id: index + 4,
      })),
      question(
        7,
        `${topicWithParticle(subject, "이", "가")} 제공된다면 가장 적절한 방식은 무엇인가요?`,
        "운영 형태와 접근 방식을 정할 수 있는 실무 정보를 얻어요.",
        "single",
        ["온라인", "오프라인", "온라인·오프라인 병행", "예약형", "상시 이용형", "잘 모르겠음"],
      ),
    ],
  };
}

function awarenessBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topicWithParticle(subject, "을", "를")} 이전부터 알고 있었나요?`,
      "비인지, 단순 인지, 경험 단계를 구분할 수 있어요.",
      "single",
      ["잘 알고 있음", "이름과 대략적인 내용은 알고 있음", "이름만 들어봄", "이번에 처음 알게 됨"],
    ),
    question(
      2,
      `${topicWithParticle(subject, "을", "를")} 어떤 경로로 알게 되었나요?`,
      "인지 형성에 실제로 기여한 접점을 파악해요.",
      "multiple",
      ["지인", "교내 커뮤니티", "SNS", "검색·기사", "포스터·홍보물", "이번 설문"],
    ),
    question(
      3,
      `${topic}에 대해 떠오르는 이미지를 모두 골라주세요.`,
      "현재 인식의 방향과 강점을 구체적인 속성으로 확인해요.",
      "multiple",
      ["신뢰할 수 있음", "도움이 됨", "새로움", "접근하기 쉬움", "잘 모르겠음", "관심이 가지 않음"],
    ),
    question(
      4,
      `${topic}에 대해 더 알아볼 의향이 어느 정도인가요?`,
      "현재 인지가 추가 탐색 의향으로 이어지는지 확인해요.",
      "scale",
    ),
    question(
      5,
      `${topic}에 대해 궁금하거나 더 알고 싶은 점을 적어주세요.`,
      "향후 안내와 홍보에서 먼저 설명할 내용을 찾을 수 있어요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "awareness",
    intentLabel: "인지도·인식",
    subject,
    title: `${subject} 인지도 및 인식 조사`,
    description: `${subject}에 대한 현재 인지도와 유입 경로, 이미지 및 추가 관심도를 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 인지도`,
    templateSummary: "인지 수준과 유입 경로, 현재 이미지, 추가 관심도를 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 인지도와 인식"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        `${topicWithParticle(subject, "을", "를")} 다른 사람에게 설명한다면 어떤 표현을 사용할 것 같나요?`,
        "응답자의 언어로 형성된 실제 이미지를 확인해요.",
        "text",
        undefined,
        false,
      ),
      question(
        7,
        `${topic} 관련 정보를 접하기에 가장 편한 채널은 무엇인가요?`,
        "향후 인지도 개선에 활용할 소통 채널을 정할 수 있어요.",
        "single",
        ["인스타그램 등 SNS", "교내 커뮤니티", "문자·이메일", "공식 웹사이트", "오프라인 설명회", "지인·선후배"],
      ),
    ],
  };
}

function adaptationBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic} 적응 정도를 전반적으로 평가해주세요.`,
      "현재 적응 수준을 공통 척도로 확인해 비교 기준을 만들어요.",
      "scale",
    ),
    question(
      2,
      `${topic}에서 가장 어려움을 느끼는 영역을 모두 골라주세요.`,
      "지원이 가장 필요한 영역을 우선순위로 정할 수 있어요.",
      "multiple",
      ["수업·학업", "친구·교우 관계", "학교 시설 이용", "동아리·교내 활동", "시간 관리", "진로 고민"],
    ),
    question(
      3,
      `${topic} 적응에 가장 도움이 된 것은 무엇인가요?`,
      "학생이 실제로 효과를 느낀 지원과 자원을 확인해요.",
      "single",
      ["친구·선배", "학교 안내", "교수·조교", "동아리·학생회", "온라인 커뮤니티", "스스로 정보 탐색"],
    ),
    question(
      4,
      `${topicWithParticle(subject, "을", "를")} 위해 추가로 필요한 지원을 모두 골라주세요.`,
      "새로운 지원 프로그램의 구체적인 수요를 파악해요.",
      "multiple",
      ["학업 안내", "멘토링", "친목 프로그램", "시설 이용 안내", "상담", "진로 정보"],
    ),
    question(
      5,
      `${topic}과 관련해 학교에 바라는 점을 적어주세요.`,
      "선택지에서 놓친 개인 경험과 지원 요구를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "adaptation",
    intentLabel: "학교생활 적응",
    subject,
    title: `${subject} 적응 조사`,
    description: `${subject}의 현재 적응 수준과 어려움, 도움이 된 자원 및 추가 지원 수요를 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 적응도`,
    templateSummary: "적응 수준, 어려움, 도움 자원과 추가 지원 수요를 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 적응 경험과 지원"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions.slice(0, 2),
      question(
        3,
        `${topic} 관련 정보를 충분히 얻고 있다고 느끼나요?`,
        "적응 문제 중 정보 부족이 차지하는 영향을 확인해요.",
        "scale",
      ),
      ...templateQuestions.slice(2).map((item, index) => ({
        ...item,
        id: index + 4,
      })),
      question(
        7,
        `${topic} 과정에서 기억에 남는 경험을 자유롭게 알려주세요.`,
        "정량 문항으로 설명되지 않는 적응의 맥락을 발견해요.",
        "text",
        undefined,
        false,
      ),
    ],
  };
}

function frequencyActionQuestion(focus: string) {
  const verbNoun = focus.match(
    /^(.+?)\s+(이용|사용|방문|구매|주문|참여|관람)$/,
  );
  if (verbNoun) {
    return `최근 1개월 동안 ${labelWithParticle(verbNoun[1], "을", "를")} 얼마나 자주 ${verbNoun[2]}하나요?`;
  }
  return `최근 1개월 동안 ${labelWithParticle(focus, "을", "를")} 얼마나 자주 하나요?`;
}

function actionFrequencyBlueprint(
  subject: string,
  focus: string,
): SurveyBlueprint {
  const activity = labelWithParticle(focus, "을", "를");
  const firstQuestion = question(
    1,
    frequencyActionQuestion(focus),
    "행동이 실제로 반복되는 주기를 명확한 시간 단위로 측정해요.",
    "single",
    [
      "전혀 하지 않음",
      "월 1회 미만",
      "월 1~3회",
      "주 1~2회",
      "주 3~4회",
      "주 5회 이상",
    ],
  );
  const templateQuestions = /카공/.test(focus)
    ? [
        firstQuestion,
        question(
          2,
          "한 번 카공할 때 보통 얼마나 오래 공부하나요?",
          "카공 1회의 평균 지속 시간을 비교해요.",
          "single",
          ["1시간 미만", "1시간 이상 2시간 미만", "2시간 이상 3시간 미만", "3시간 이상", "일정하지 않음"],
        ),
        question(
          3,
          "카공을 주로 하는 시간대를 모두 골라주세요.",
          "카공이 집중되는 시간대를 확인해 이용 패턴을 파악해요.",
          "multiple",
          ["오전", "점심시간", "오후", "저녁", "밤", "일정하지 않음"],
        ),
        question(
          4,
          "주로 어떤 카페에서 카공하나요?",
          "카공 장소의 유형을 비교해 선호 환경을 파악해요.",
          "single",
          ["학교 안 카페", "대형 프랜차이즈 카페", "개인 카페", "스터디카페", "기타", "카공하지 않음"],
        ),
        question(
          5,
          "카공할 장소를 고를 때 중요하게 보는 조건을 모두 골라주세요.",
          "카공 장소 선택에 영향을 주는 핵심 조건을 파악해요.",
          "multiple",
          ["거리", "좌석과 테이블", "소음 수준", "콘센트", "영업시간", "음료 가격", "매장 분위기", "혼잡도"],
        ),
      ]
    : [
        firstQuestion,
        question(
          2,
          `${activity} 주로 하는 요일을 모두 골라주세요.`,
          "행동이 반복되는 요일과 생활 패턴을 확인해요.",
          "multiple",
          ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일", "일정하지 않음"],
        ),
        question(
          3,
          `${activity} 주로 하는 시간대를 모두 골라주세요.`,
          "행동이 집중되는 시간대를 파악해요.",
          "multiple",
          ["오전", "점심시간", "오후", "저녁", "밤", "일정하지 않음"],
        ),
        question(
          4,
          `${activity} 하게 되는 가장 큰 이유는 무엇인가요?`,
          "행동을 반복하게 만드는 주된 동기를 확인해요.",
          "single",
          ["필요해서", "습관적으로", "즐거워서", "주변 사람의 영향", "시간을 보내기 위해", "기타"],
        ),
        question(
          5,
          `${activity} 할 때 중요하게 생각하는 조건을 모두 골라주세요.`,
          "행동의 방식과 선택에 영향을 주는 조건을 파악해요.",
          "multiple",
          ["시간", "비용", "장소", "편의성", "함께하는 사람", "품질·효과", "특별히 없음"],
        ),
      ];
  const aiQuestions = [
    ...templateQuestions,
    /카공/.test(focus)
      ? question(
          6,
          "카공 한 번에 음료나 음식으로 보통 얼마를 지출하나요?",
          "카공 1회당 지출 규모를 구간별로 비교해요.",
          "single",
          ["5천원 미만", "5천원 이상 1만원 미만", "1만원 이상 1만 5천원 미만", "1만 5천원 이상", "지출하지 않음"],
        )
      : question(
          6,
          `3개월 전과 비교해 최근 ${activity} 하는 빈도는 어떻게 달라졌나요?`,
          "최근 행동 빈도의 증가 또는 감소를 확인해요.",
          "single",
          ["많이 줄었음", "조금 줄었음", "비슷함", "조금 늘었음", "많이 늘었음"],
        ),
    /카공/.test(focus)
      ? question(
          7,
          "카공을 하는 가장 큰 이유는 무엇인가요?",
          "카공 행동을 선택하는 핵심 동기를 파악해요.",
          "single",
          ["집보다 집중이 잘돼서", "학교보다 가까워서", "공부 분위기가 좋아서", "친구와 함께 공부하려고", "음료나 공간을 이용하려고", "기타"],
        )
      : question(
          7,
          `${focus} 횟수나 상황과 관련해 덧붙이고 싶은 내용이 있다면 적어주세요.`,
          "선택지만으로 설명하기 어려운 행동 맥락을 수집해요.",
          "text",
          undefined,
          false,
        ),
  ];

  return {
    kind: "general",
    intentLabel: "행동 빈도",
    subject,
    title: `${subject} 조사`,
    description: `${focus} 행동이 반복되는 주기와 대표적인 이용 패턴을 확인하는 익명 설문입니다.`,
    templateTitle: `${focus} 빈도`,
    templateSummary: "행동 빈도를 명확한 시간 단위로 묻고 실제 이용 패턴을 함께 확인해요.",
    detectedSignals: [`측정 행동 · ${focus}`, "목적 · 행동 빈도 파악"],
    templateQuestions,
    aiQuestions,
  };
}

function frequencyBlueprint(subject: string): SurveyBlueprint {
  const focus = subject
    .replace(
      /\s*(?:을|를)?\s*(?:하는|느끼는|경험하는|떠올리는)?\s*(?:빈도|횟수)$/,
      "",
    )
    .trim();
  if (actionFrequencyCue.test(focus)) {
    return actionFrequencyBlueprint(subject, focus);
  }

  const experienceNoun = focus.includes("생각") ? "생각이" : "경험이";
  const occurrenceQuestion = focus.includes("생각")
    ? `최근 1개월 동안 ${labelWithParticle(focus, "이", "가")} 얼마나 자주 드나요?`
    : `최근 1개월 동안 ${labelWithParticle(focus, "을", "를")} 얼마나 자주 경험하나요?`;
  const templateQuestions = [
    question(
      1,
      occurrenceQuestion,
      "생각이나 경험이 실제로 나타나는 주기를 명확한 시간 단위로 측정해요.",
      "single",
      ["전혀 없음", "월 1~3일", "주 1~2일", "주 3~4일", "거의 매일", "하루에 여러 번"],
    ),
    question(
      2,
      `그 ${experienceNoun} 드는 날은 보통 하루에 몇 번 정도인가요?`,
      "하루 안에서 반복되는 횟수를 구분해 전체 빈도를 더 정확히 해석해요.",
      "single",
      ["1번", "2~3번", "4~5번", "6번 이상", "해당 없음"],
    ),
    question(
      3,
      `일주일 중 그 ${experienceNoun} 드는 날은 보통 며칠인가요?`,
      "주 단위로 나타나는 빈도를 확인해 응답자의 체감 차이를 비교해요.",
      "single",
      ["0일", "1~2일", "3~4일", "5~6일", "매일"],
    ),
    question(
      4,
      `그 ${experienceNoun} 가장 자주 드는 시간대를 모두 골라주세요.`,
      "빈도가 높아지는 시간대를 확인해 결과를 구체적으로 해석해요.",
      "multiple",
      ["등교 직후", "오전", "점심시간", "오후", "저녁", "특정 시간대 없음"],
    ),
    question(
      5,
      `그 ${experienceNoun} 특히 자주 나타나는 상황을 모두 골라주세요.`,
      "빈도 차이가 나타나는 대표 상황을 구분해요.",
      "multiple",
      ["수업 전후", "공강", "과제·시험 기간", "식사 전후", "동아리·모임 전후", "특정 상황 없음"],
    ),
  ];
  const aiQuestions = [
    ...templateQuestions,
    question(
      6,
      `학기 초와 비교해 최근 그 ${experienceNoun} 드는 빈도는 어떻게 달라졌나요?`,
      "최근 빈도의 변화를 확인해 일시적인 응답과 지속적인 경향을 구분해요.",
      "single",
      ["많이 줄었음", "조금 줄었음", "비슷함", "조금 늘었음", "많이 늘었음"],
    ),
    question(
      7,
      "빈도와 관련해 덧붙이고 싶은 상황이 있다면 적어주세요.",
      "정해진 선택지로 설명하기 어려운 빈도 맥락만 선택적으로 받아요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "general",
    intentLabel: "빈도 조사",
    subject,
    title: `${subject} 조사`,
    description: `${focus || subject}의 빈도를 문자 그대로 확인하는 익명 설문입니다.`,
    templateTitle: `${focus || subject} 빈도`,
    templateSummary: "요청한 빈도를 기간과 반복 횟수 기준으로 확인해요.",
    detectedSignals: [`측정 내용 · ${subject}`, "목적 · 빈도 파악"],
    templateQuestions,
    aiQuestions,
  };
}

function directProportionQuestionTitle(intent: DirectProportionIntent) {
  const qualifier = intent.qualifyingGroup
    .replace(/\s*(?:학생|사람|응답자)(?:들)?$/g, "")
    .trim();
  const action = qualifier.match(/^(.+?)(?:(을|를)\s*)?하는$/);
  if (action) {
    return action[2]
      ? `현재 ${action[1]}${action[2]} 하고 있나요?`
      : `현재 ${action[1]}하고 있나요?`;
  }
  const inProgress = qualifier.match(/^(.+?)\s*중인$/);
  if (inProgress) return `현재 ${inProgress[1]} 중인가요?`;
  const residence = qualifier.match(/^(.+?)에\s*거주하는$/);
  if (residence) return `현재 ${residence[1]}에 거주하고 있나요?`;
  const possession = qualifier.match(/^(.+?)(이|가)\s*있는$/);
  if (possession) return `현재 ${possession[1]}${possession[2]} 있나요?`;

  const condition = intent.conditionLabel;
  return `현재 ${condition}에 해당하나요?`;
}

function consumptionHabitsBlueprint(subject: string): SurveyBlueprint {
  const templateQuestions = [
    question(
      1,
      "최근 한 달 동안 등록금과 보증금을 제외한 생활비로 얼마 정도를 지출했나요?",
      "학생별 월간 소비 규모를 구간으로 비교해요.",
      "single",
      [
        "30만원 미만",
        "30만원 이상 50만원 미만",
        "50만원 이상 70만원 미만",
        "70만원 이상 100만원 미만",
        "100만원 이상",
        "잘 모르겠음",
      ],
    ),
    question(
      2,
      "평소 지출이 많은 항목을 모두 골라주세요.",
      "생활비가 주로 쓰이는 영역을 파악해 소비 구성을 비교해요.",
      "multiple",
      [
        "식비·카페",
        "주거·관리비",
        "교통",
        "쇼핑·생활용품",
        "문화·여가",
        "교육·자기계발",
        "통신·구독 서비스",
        "모임·교제",
      ],
    ),
    question(
      3,
      "지출 내역을 확인하거나 기록하는 편인가요?",
      "소비를 점검하고 예산을 관리하는 습관의 정도를 확인해요.",
      "single",
      ["항상 기록함", "자주 확인함", "가끔 확인함", "거의 확인하지 않음", "전혀 확인하지 않음"],
    ),
    question(
      4,
      "물건이나 서비스를 구매할 때 중요하게 보는 기준을 모두 골라주세요.",
      "구매 결정을 좌우하는 가격·품질·편의 기준을 비교해요.",
      "multiple",
      ["가격", "품질", "필요성", "할인·혜택", "후기·평점", "브랜드", "구매 편의성", "주변 추천"],
    ),
    question(
      5,
      "가장 자주 사용하는 결제 수단은 무엇인가요?",
      "소비가 실제로 이루어지는 주된 결제 방식을 파악해요.",
      "single",
      ["체크카드", "신용카드", "간편결제", "현금", "계좌이체", "기타"],
    ),
  ];

  return {
    kind: "general",
    intentLabel: "소비 행태",
    subject,
    title: `${subject} 조사`,
    description: `${subject}의 지출 규모와 영역, 예산 관리, 구매 기준, 결제 방식 및 계획 밖 지출을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 핵심 문항`,
    templateSummary: "지출 규모와 구성, 구매 결정 및 관리 습관을 구체적으로 확인해요.",
    detectedSignals: [`조사 내용 · ${subject}`, "목적 · 소비 행태 파악"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        "계획하지 않았던 물건이나 서비스를 충동적으로 구매하는 빈도는 어느 정도인가요?",
        "계획 소비와 충동 소비의 차이를 비교해요.",
        "single",
        ["전혀 없음", "드물게", "가끔", "자주", "매우 자주"],
      ),
      question(
        7,
        "현재 소비 습관에서 줄이거나 바꾸고 싶은 부분이 있다면 적어주세요.",
        "선택지로 드러나지 않은 소비 고민과 변화 목표를 수집해요.",
        "text",
        undefined,
        false,
      ),
    ],
  };
}

function proportionBlueprint(intent: DirectProportionIntent): SurveyBlueprint {
  const { population, qualifyingGroup, conditionLabel } = intent;
  const ratioQuestion = question(
    1,
    directProportionQuestionTitle(intent),
    "‘예’ 응답 수를 전체 유효 응답 수로 나눠 해당 학생의 비율을 계산해요.",
    "single",
    ["예", "아니요"],
  );

  return {
    kind: "general",
    intentLabel: "비율 조사",
    subject: `${conditionLabel} 여부`,
    title: `${population} ${conditionLabel} 비율 조사`,
    description: `${population} 중 ${qualifyingGroup}의 비율을 한 문항으로 파악하는 익명 설문입니다.`,
    templateTitle: `${conditionLabel} 비율`,
    templateSummary: "해당 여부만 물어 전체 응답자 중 비율을 바로 계산해요.",
    detectedSignals: [
      `모집단 · ${population}`,
      `해당 조건 · ${qualifyingGroup}`,
      "목적 · 비율 계산",
    ],
    templateQuestions: [ratioQuestion],
    aiQuestions: [ratioQuestion],
    respondentGroup: population,
    evaluationTarget: `${conditionLabel} 여부`,
    goal: "해당 학생 비율 파악",
    assumptions: [],
    aiTitle: `${population} ${conditionLabel} 비율 맞춤 설문`,
    domain: "general",
  };
}

function sleepDurationBlueprint(subject: string): SurveyBlueprint {
  const durationOptions = [
    "5시간 미만",
    "5시간 이상 6시간 미만",
    "6시간 이상 7시간 미만",
    "7시간 이상 8시간 미만",
    "8시간 이상 9시간 미만",
    "9시간 이상",
  ];
  const templateQuestions = [
    question(
      1,
      "평일에 하루 평균 몇 시간 정도 자나요?",
      "수업이 있는 평일의 실제 수면 시간을 구간별로 비교해요.",
      "single",
      durationOptions,
    ),
    question(
      2,
      "주말이나 공휴일에는 하루 평균 몇 시간 정도 자나요?",
      "주말 수면 시간을 평일과 비교해 부족한 잠을 보충하는 경향을 확인해요.",
      "single",
      durationOptions,
    ),
    question(
      3,
      "현재 수면 시간이 본인에게 충분하다고 느끼나요?",
      "실제 수면 시간과 응답자가 느끼는 충분함의 차이를 확인해요.",
      "single",
      ["매우 부족함", "부족한 편", "보통", "충분한 편", "매우 충분함"],
    ),
    question(
      4,
      "본인에게 가장 적절하다고 생각하는 하루 수면 시간은 얼마인가요?",
      "대학생이 생각하는 적정 수면 시간을 실제 수면 시간과 비교해요.",
      "single",
      durationOptions,
    ),
    question(
      5,
      "수면 시간이 부족해지는 주된 이유를 모두 골라주세요.",
      "충분한 수면을 방해하는 생활 요인을 구체적으로 파악해요.",
      "multiple",
      [
        "과제·시험",
        "아르바이트",
        "스마트폰·SNS·영상 시청",
        "모임·약속",
        "통학 시간",
        "스트레스·불면",
        "생활 리듬이 불규칙해서",
        "수면 시간이 부족하지 않음",
      ],
    ),
  ];

  return {
    kind: "general",
    intentLabel: "수면 시간",
    subject,
    title: `${subject} 조사`,
    description:
      "대학생의 평일·주말 수면 시간과 충분함, 적정 수면 시간에 대한 인식, 수면 부족의 원인과 영향을 파악하는 익명 설문입니다.",
    templateTitle: "대학생 수면 시간 핵심 문항",
    templateSummary:
      "실제 수면 시간과 충분함에 대한 의견을 함께 물어 생활 패턴을 구체적으로 확인해요.",
    detectedSignals: ["측정 내용 · 수면 시간", "목적 · 실제 시간과 인식 파악"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        "수면 시간 부족이 일상에 미치는 영향을 모두 골라주세요.",
        "수면 부족이 학업과 생활에 연결되는 양상을 구분해요.",
        "multiple",
        [
          "낮 시간 피로·졸림",
          "수업·과제 집중력 저하",
          "기분 변화·예민함",
          "지각·결석",
          "카페인 의존 증가",
          "건강 문제",
          "특별한 영향 없음",
        ],
      ),
      question(
        7,
        "대학생이 충분한 수면 시간을 확보하려면 가장 필요한 변화가 무엇이라고 생각하나요?",
        "선택지로 담기 어려운 수면 시간에 대한 의견과 개선 아이디어를 수집해요.",
        "text",
        undefined,
        false,
      ),
    ],
  };
}

function durationMeasurementBlueprint(
  subject: string,
  measurement: SurveyMeasurement,
): SurveyBlueprint {
  const focus = measurement.target;
  const isRepeatableActivity =
    /(이용|사용|시청|게임|공부|학습|운동|독서|통학|등하교|근무)$/.test(
      focus,
    );
  const durationOptions = [
    "전혀 하지 않음",
    "30분 미만",
    "30분 이상 1시간 미만",
    "1시간 이상 2시간 미만",
    "2시간 이상 3시간 미만",
    "3시간 이상 4시간 미만",
    "4시간 이상",
  ];
  const templateQuestions = [
    question(
      1,
      `평일 하루 평균 ${focus} 시간은 얼마나 되나요?`,
      `${measurement.sourceTopic}을 추상적으로 평가하지 않고 평일의 실제 시간량을 구간으로 측정해요.`,
      "single",
      durationOptions,
    ),
    question(
      2,
      `주말이나 공휴일 하루 평균 ${focus} 시간은 얼마나 되나요?`,
      "평일과 비수업일의 시간 사용 차이를 비교해요.",
      "single",
      durationOptions,
    ),
    question(
      3,
      `일주일 중 ${focus} 시간이 있는 날은 보통 며칠인가요?`,
      "하루 시간량과 별도로 일주일 동안 반복되는 일수를 확인해요.",
      "single",
      ["0일", "1일", "2~3일", "4~5일", "6일", "매일"],
    ),
    question(
      4,
      `${focus} 시간이 가장 긴 시간대를 모두 골라주세요.`,
      "시간 사용이 집중되는 때를 구분해 실제 이용 패턴을 분석해요.",
      "multiple",
      ["오전 6~9시", "오전 9시~낮 12시", "낮 12시~오후 3시", "오후 3~6시", "오후 6~9시", "오후 9시 이후"],
    ),
    isRepeatableActivity
      ? question(
          5,
          `${focus} 시간을 주로 어떤 목적으로 쓰나요?`,
          "같은 이용 시간이라도 목적에 따라 시간 사용의 의미가 달라지는 점을 구분해요.",
          "multiple",
          ["학업·업무", "정보 탐색", "소통·교류", "오락·휴식", "습관적으로", "기타"],
        )
      : question(
          5,
          `${focus} 시간이 평소보다 길어지는 상황을 모두 골라주세요.`,
          "시간량이 달라지는 실제 맥락을 구분해요.",
          "multiple",
          ["평일", "주말·공휴일", "과제·시험 기간", "이동이 많은 날", "약속·모임이 있는 날", "특정한 상황 없음"],
        ),
  ];

  return {
    kind: "general",
    intentLabel: "실제 시간 사용",
    subject,
    title: `${subject} 조사`,
    description: `${subject}을 실제 시간 단위로 측정하고 평일·주말, 반복 일수와 시간대별 패턴을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 핵심 문항`,
    templateSummary: "측정 대상 자체를 평가하지 않고 실제 분·시간 단위와 기준 기간을 제시해 응답할 수 있게 구성했어요.",
    detectedSignals: [
      `행동 대상 · ${focus}`,
      `측정 기준 · ${measurement.metricLabel}`,
      "목적 · 실제 시간량 파악",
    ],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        `3개월 전과 비교하면 ${focus} 시간은 어떻게 달라졌나요?`,
        "최근 시간 사용이 늘었는지 줄었는지 추세를 확인해요.",
        "single",
        ["많이 줄었음", "조금 줄었음", "비슷함", "조금 늘었음", "많이 늘었음"],
      ),
      question(
        7,
        `${focus} 시간을 앞으로 어떻게 조절하고 싶은지, 그 이유와 함께 적어주세요.`,
        "현재 시간량에 대한 해석과 원하는 변화를 구체적으로 수집해요.",
        "text",
        undefined,
        false,
      ),
    ],
  };
}

function generalBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topic}과 현재 얼마나 관련이 있나요?`,
      "응답자와 조사 주제의 관련성을 먼저 확인해요.",
      "single",
      ["직접 경험 중", "과거에 경험함", "알고 있지만 경험 없음", "잘 모름"],
    ),
    question(
      2,
      `${topic}에 대해 전반적으로 어떻게 평가하시나요?`,
      "주제에 대한 전체 평가를 공통 척도로 확인해요.",
      "scale",
    ),
    question(
      3,
      `${topic}과 관련해 중요하게 생각하는 요소를 모두 골라주세요.`,
      "응답자의 판단 기준과 우선순위를 찾을 수 있어요.",
      "multiple",
      ["편의성", "품질", "비용", "신뢰성", "접근성", "주변 의견"],
    ),
    question(
      4,
      `${topic}과 관련해 불편하거나 걱정되는 점을 모두 골라주세요.`,
      "현재 경험과 선택을 막는 요인을 구분해요.",
      "multiple",
      ["정보 부족", "시간 부담", "비용 부담", "이용 절차", "신뢰하기 어려움", "특별한 문제 없음"],
    ),
    question(
      5,
      `${topic}과 관련해 전하고 싶은 의견을 자유롭게 적어주세요.`,
      "선택지 밖의 구체적인 경험과 아이디어를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "general",
    intentLabel: "의견·경험",
    subject,
    title: `${subject} 의견 조사`,
    description: `${subject}에 대한 경험과 평가, 중요 요소 및 개선 의견을 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 기본 의견`,
    templateSummary: "주제 관련 경험, 전체 평가, 중요 요소와 개선 의견을 균형 있게 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 경험과 의견 파악"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        `${topicWithParticle(subject, "이", "가")} 앞으로 어떻게 달라지면 좋을까요?`,
        "현재 평가를 넘어 응답자가 원하는 방향을 구체화해요.",
        "text",
        undefined,
        false,
      ),
      question(
        7,
        `${topic}과 관련한 의견이 실제 결정에 얼마나 중요하게 반영되어야 한다고 생각하시나요?`,
        "의견의 방향뿐 아니라 응답자가 기대하는 반영 수준도 함께 확인해요.",
        "scale",
      ),
    ],
  };
}

function attachSemantics(
  blueprint: SurveyBlueprint,
  semantics: SurveySemantics,
): SurveyBlueprint {
  const {
    respondentGroup,
    evaluationTarget,
    explicitTopic,
    goalLabel,
    assumptions,
  } = semantics;
  const isEventSatisfaction =
    blueprint.kind === "event" && blueprint.title.includes("만족도");
  const eventTitleFocus = isEventSatisfaction
    ? respondentGroup
      ? explicitTopic && !respondentGroup.includes(explicitTopic)
        ? `${respondentGroup} ${explicitTopic}`
        : respondentGroup
      : evaluationTarget
    : null;
  const respondentTitleFocus =
    respondentGroup && blueprint.kind !== "satisfaction" && !isEventSatisfaction
      ? [
          respondentGroup,
          explicitTopic &&
          !respondentGroup.includes(explicitTopic) &&
          !explicitTopic.includes(respondentGroup) &&
          !/^(?:경험|사용\s*경험|이용\s*경험)$/.test(explicitTopic)
            ? explicitTopic
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  const titlePrefix = blueprint.title.startsWith(evaluationTarget)
    ? evaluationTarget
    : blueprint.title.startsWith(blueprint.subject)
      ? blueprint.subject
      : "";
  const titleSuffix = titlePrefix
    ? blueprint.title.slice(titlePrefix.length).trim()
    : blueprint.title;
  const title = eventTitleFocus
    ? `${eventTitleFocus} 만족도 조사`
    : respondentTitleFocus
      ? `${respondentTitleFocus} ${titleSuffix}`
      : blueprint.title;
  const templatePrefix = blueprint.templateTitle.startsWith(evaluationTarget)
    ? evaluationTarget
    : blueprint.templateTitle.startsWith(blueprint.subject)
      ? blueprint.subject
      : "";
  const templateSuffix = templatePrefix
    ? blueprint.templateTitle.slice(templatePrefix.length).trim()
    : blueprint.templateTitle;
  const templateTitle =
    eventTitleFocus
      ? `${eventTitleFocus} 만족도`
      : respondentTitleFocus
        ? `${respondentTitleFocus} ${templateSuffix}`
        : blueprint.templateTitle;
  const description =
    respondentGroup &&
    blueprint.kind !== "satisfaction" &&
    !blueprint.description.includes(`${respondentGroup}을 대상으로`) &&
    !blueprint.description.includes(`${respondentGroup}를 대상으로`)
      ? `${labelWithParticle(respondentGroup, "을", "를")} 대상으로, ${blueprint.description}`
      : blueprint.description;

  return {
    ...blueprint,
    subject:
      blueprint.kind === "satisfaction"
        ? blueprint.subject
        : evaluationTarget,
    title: title
      .replace(/사용 경험\s+사용 경험/g, "사용 경험")
      .replace(/사용자\s+사용 경험 조사/g, "사용자 경험 조사")
      .replace(/이용자\s+사용 경험 조사/g, "이용자 경험 조사")
      .replace(/만족도\s+만족도 조사/g, "만족도 조사"),
    description,
    templateTitle: templateTitle
      .replace(/사용자\s+사용 경험/g, "사용자 경험")
      .replace(/이용자\s+사용 경험/g, "이용자 경험"),
    detectedSignals: [
      `응답 대상 · ${respondentGroup ?? "별도 지정 없음"}`,
      `조사 내용 · ${evaluationTarget}`,
      `목적 · ${goalLabel}`,
    ],
    respondentGroup,
    evaluationTarget,
    goal: goalLabel,
    assumptions,
    domain: semantics.domain,
    aiTitle:
      blueprint.aiTitle ??
      `${title.replace(/\s*조사$/, "")} 맞춤 설문`,
    templateQuestions: blueprint.templateQuestions.map((item, index) => ({
      ...item,
      id: index + 1,
    })),
    aiQuestions: blueprint.aiQuestions.map((item, index) => ({
      ...item,
      id: index + 1,
    })),
  };
}

export function generateSurvey(brief: SurveyBrief): SurveyBlueprint {
  const normalized = brief.normalizedBrief;
  const semantics = brief.semantics;
  const subject = brief.researchSubject;
  let blueprint: SurveyBlueprint;

  if (/팀플|팀\s*프로젝트|조별\s*과제/.test(normalized)) {
    return collaborationBlueprint(brief);
  }
  if (/학식|식당|급식|구내식당/.test(subject)) {
    return cafeteriaBriefBlueprint(brief);
  }
  if (
    semantics.kind === "usage" ||
    /(?:이용|사용)\s*(?:빈도|현황|경험|행태|실태)/.test(normalized)
  ) {
    return usageBlueprint(subject, brief);
  }

  if (sleepDurationCue.test(semantics.explicitTopic ?? "")) {
    blueprint = sleepDurationBlueprint(subject);
  } else if (consumptionHabitCue.test(semantics.explicitTopic ?? "")) {
    blueprint = consumptionHabitsBlueprint(subject);
  } else if (/(?:빈도|횟수)$/.test(semantics.explicitTopic ?? "")) {
    blueprint = frequencyBlueprint(subject);
  } else if (semantics.measurement?.kind === "duration") {
    blueprint = durationMeasurementBlueprint(subject, semantics.measurement);
  } else {
    switch (semantics.kind) {
      case "membership":
        blueprint = membershipBlueprint(subject);
        break;
      case "problem":
        blueprint = problemBlueprint(subject);
        break;
      case "satisfaction":
        blueprint = satisfactionBlueprint(semantics);
        break;
      case "event":
        blueprint = eventBlueprint(subject, normalized);
        break;
      case "adoption":
        blueprint = adoptionBlueprint(subject);
        break;
      case "needs":
        blueprint = needsBlueprint(subject);
        break;
      case "awareness":
        blueprint = awarenessBlueprint(subject);
        break;
      case "adaptation":
        blueprint = adaptationBlueprint(subject);
        break;
      default:
        blueprint = generalBlueprint(subject);
    }
  }

  return attachSemantics(blueprint, {
    ...semantics,
    respondentGroup: brief.targetRespondents,
    evaluationTarget: brief.researchSubject,
    explicitTopic: brief.researchSubject,
    domain: brief.domain,
    goalLabel: brief.researchGoal,
  });
}

export function analyzeSurveyPrompt(rawPrompt: string): SurveyBlueprint {
  const directProportion = parseDirectProportionRequest(rawPrompt);
  if (directProportion) return proportionBlueprint(directProportion);

  if (surveyRequestPhraseCue.test(normalizePrompt(rawPrompt))) {
    return generateSurvey(parseSurveyBrief(rawPrompt));
  }

  const normalized = stripRequestWrapper(rawPrompt);
  const semantics = parseSurveySemantics(normalized);
  const subject = semantics.evaluationTarget;
  let blueprint: SurveyBlueprint;

  if (sleepDurationCue.test(semantics.explicitTopic ?? "")) {
    blueprint = sleepDurationBlueprint(subject);
  } else if (consumptionHabitCue.test(semantics.explicitTopic ?? "")) {
    blueprint = consumptionHabitsBlueprint(subject);
  } else if (/(?:빈도|횟수)$/.test(semantics.explicitTopic ?? "")) {
    blueprint = frequencyBlueprint(subject);
  } else if (semantics.measurement?.kind === "duration") {
    blueprint = durationMeasurementBlueprint(subject, semantics.measurement);
  } else {
    switch (semantics.kind) {
      case "membership":
        blueprint = membershipBlueprint(subject);
        break;
      case "problem":
        blueprint = problemBlueprint(subject);
        break;
      case "satisfaction":
        blueprint = satisfactionBlueprint(semantics);
        break;
      case "event":
        blueprint = eventBlueprint(subject, normalized);
        break;
      case "adoption":
        blueprint = adoptionBlueprint(subject);
        break;
      case "usage":
        return generateSurvey(parseSurveyBrief(rawPrompt));
      case "needs":
        blueprint = needsBlueprint(subject);
        break;
      case "awareness":
        blueprint = awarenessBlueprint(subject);
        break;
      case "adaptation":
        blueprint = adaptationBlueprint(subject);
        break;
      default:
        blueprint = generalBlueprint(subject);
    }
  }

  return attachSemantics(blueprint, semantics);
}

function normalizedSurveyText(value: string) {
  return value
    .replace(/[\s?!.,'"“”‘’()\[\]{}·:;_-]/g, "")
    .toLocaleLowerCase("ko-KR");
}

function bigramSimilarity(left: string, right: string) {
  const a = normalizedSurveyText(left);
  const b = normalizedSurveyText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pairs = (value: string) => {
    const result: string[] = [];
    for (let index = 0; index < value.length - 1; index += 1) {
      result.push(value.slice(index, index + 2));
    }
    return result;
  };
  const leftPairs = pairs(a);
  const rightPairs = pairs(b);
  const remaining = new Map<string, number>();
  for (const pair of leftPairs) remaining.set(pair, (remaining.get(pair) ?? 0) + 1);
  let overlap = 0;
  for (const pair of rightPairs) {
    const count = remaining.get(pair) ?? 0;
    if (count > 0) {
      overlap += 1;
      remaining.set(pair, count - 1);
    }
  }
  return (2 * overlap) / Math.max(1, leftPairs.length + rightPairs.length);
}

type SurveyOptionInterval = {
  context: string;
  unit: string;
  minimum: number;
  maximum: number;
  minimumInclusive: boolean;
  maximumInclusive: boolean;
};

function normalizedIntervalMeasure(value: number, unit: string) {
  if (unit === "시간") return { value: value * 60, unit: "duration-minutes" };
  if (unit === "분") return { value, unit: "duration-minutes" };
  if (unit === "만원") return { value: value * 10_000, unit: "currency-won" };
  if (unit === "원") return { value, unit: "currency-won" };
  return { value, unit: unit || "count" };
}

function surveyOptionInterval(option: string): SurveyOptionInterval | null {
  const normalized = option.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const context = normalized.match(/^(최근\s+\S+|하루|일주일|주|월|학기)/)?.[0] ?? "";
  const bounded = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)?\s*이상\s*(?:[~～-]\s*)?(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*미만/,
  );
  if (bounded) {
    const minimum = normalizedIntervalMeasure(
      Number(bounded[1]),
      bounded[2] || bounded[4] || "count",
    );
    const maximum = normalizedIntervalMeasure(Number(bounded[3]), bounded[4] || bounded[2] || "count");
    if (minimum.unit !== maximum.unit) return null;
    return {
      context,
      unit: minimum.unit,
      minimum: minimum.value,
      maximum: maximum.value,
      minimumInclusive: true,
      maximumInclusive: false,
    };
  }
  const range = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)?\s*[~～-]\s*(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)/,
  );
  if (range) {
    const minimum = normalizedIntervalMeasure(
      Number(range[1]),
      range[2] || range[4] || "count",
    );
    const maximum = normalizedIntervalMeasure(Number(range[3]), range[4] || range[2] || "count");
    if (minimum.unit !== maximum.unit) return null;
    return {
      context,
      unit: minimum.unit,
      minimum: minimum.value,
      maximum: maximum.value,
      minimumInclusive: true,
      maximumInclusive: true,
    };
  }
  const upper = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*미만/,
  );
  if (upper) {
    const maximum = normalizedIntervalMeasure(Number(upper[1]), upper[2]);
    return {
      context,
      unit: maximum.unit,
      minimum: Number.NEGATIVE_INFINITY,
      maximum: maximum.value,
      minimumInclusive: false,
      maximumInclusive: false,
    };
  }
  const lower = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*이상/,
  );
  if (lower) {
    const minimum = normalizedIntervalMeasure(Number(lower[1]), lower[2]);
    return {
      context,
      unit: minimum.unit,
      minimum: minimum.value,
      maximum: Number.POSITIVE_INFINITY,
      minimumInclusive: true,
      maximumInclusive: false,
    };
  }
  return null;
}

function intervalsOverlap(left: SurveyOptionInterval, right: SurveyOptionInterval) {
  if (left.context !== right.context || left.unit !== right.unit) return false;
  if (left.maximum < right.minimum || right.maximum < left.minimum) return false;
  if (left.maximum === right.minimum) {
    return left.maximumInclusive && right.minimumInclusive;
  }
  if (right.maximum === left.minimum) {
    return right.maximumInclusive && left.minimumInclusive;
  }
  return true;
}

export function validateSurvey(
  rawBrief: string,
  brief: SurveyBrief,
  blueprint: SurveyBlueprint,
) {
  const issues: string[] = [];
  const normalizedRaw = normalizedSurveyText(rawBrief);
  const requestExpression = /(분석|조사|파악|확인|알아보)(?:해|하|고)?\s*싶(?:어|어요|습니다)/;
  const titles = new Set<string>();
  const allText = [
    blueprint.title,
    blueprint.description,
    blueprint.respondentGroup ?? "",
    ...blueprint.aiQuestions.flatMap((item) => [item.title, ...(item.options ?? [])]),
  ].join(" ");

  if (
    brief.researchSubject.length < 2 ||
    brief.researchSubject.length > 80 ||
    requestExpression.test(brief.researchSubject) ||
    /(?:과|와|및)$/.test(brief.researchSubject)
  ) {
    issues.push("researchSubject가 짧은 명사구로 분리되지 않았습니다.");
  }

  for (const item of blueprint.aiQuestions) {
    const normalizedTitle = normalizedSurveyText(item.title);
    if (
      normalizedRaw.length >= 18 &&
      (normalizedTitle.includes(normalizedRaw) ||
        bigramSimilarity(rawBrief, item.title) >= 0.72)
    ) {
      issues.push(`문항 ${item.id}에 조사 의뢰문이 그대로 사용되었습니다.`);
    }
    if (requestExpression.test(item.title)) {
      issues.push(`문항 ${item.id}에 조사 목적 표현이 포함되었습니다.`);
    }
    if (/\s및(?:을|를|은|는|이|가|의)/.test(item.title)) {
      issues.push(`문항 ${item.id}에 잘못 결합된 접속사와 조사가 포함되었습니다.`);
    }
    if (
      /(?:만족|평가).*(?:과|와|및).*(?:불편|개선|의향|빈도|시간|비용)|(?:불편|개선).*(?:과|와|및).*(?:만족|의향|빈도|시간)|(?:빈도|횟수|시간|비용).*(?:과|와|및).*(?:만족|불편|의향)/.test(
        item.title,
      ) ||
      /(?:계속|지속)\s*이용.*(?:추천|권유)|(?:추천|권유).*(?:계속|지속)\s*이용/.test(
        item.title,
      )
    ) {
      issues.push(`문항 ${item.id}가 서로 다른 두 개 이상의 개념을 함께 묻고 있습니다.`);
    }
    if (/(?:얼마나\s*자주|이용\s*빈도|사용\s*빈도)/.test(item.title) &&
        !/(?:최근|지난|하루|일주일|한\s*달|한달|1개월|3개월|학기|일\s*동안|주\s*동안|월\s*동안)/.test(item.title)) {
      issues.push(`문항 ${item.id}의 이용 빈도에 기준 기간이 없습니다.`);
    }
    if (titles.has(normalizedTitle)) {
      issues.push(`문항 ${item.id}가 앞선 문항과 중복됩니다.`);
    }
    titles.add(normalizedTitle);

    if (item.options) {
      const normalizedOptions = item.options.map(normalizedSurveyText);
      if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        issues.push(`문항 ${item.id}에 중복 선택지가 있습니다.`);
      }
      const intervals = item.options
        .map((option) => ({ option, interval: surveyOptionInterval(option) }))
        .filter(
          (entry): entry is { option: string; interval: SurveyOptionInterval } =>
            Boolean(entry.interval),
        );
      for (let leftIndex = 0; leftIndex < intervals.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < intervals.length; rightIndex += 1) {
          if (intervalsOverlap(intervals[leftIndex].interval, intervals[rightIndex].interval)) {
            issues.push(
              `문항 ${item.id}의 선택지 범위가 겹칩니다: '${intervals[leftIndex].option}' / '${intervals[rightIndex].option}'`,
            );
          }
        }
      }
    }
  }

  const domainMismatchOptions = ["정보 탐색", "과제·업무", "구매·신청", "기록·관리"];
  if (
    /웹툰|웹소설|OTT|콘텐츠\s*플랫폼/.test(brief.researchSubject) &&
    domainMismatchOptions.filter((option) => allText.includes(option)).length >= 2
  ) {
    issues.push("콘텐츠 서비스 설문에 범용 업무용 선택지가 사용되었습니다.");
  }

  const targetToken = brief.targetRespondents
    .replace(/^(?:팀플\s*경험이\s*있는)\s*/, "")
    .replace(/(?:들)?$/, "")
    .trim();
  if (
    targetToken &&
    brief.targetRespondents !== "관련 경험이 있는 응답자" &&
    !allText.includes(targetToken) &&
    !(/학생/.test(targetToken) && /학생/.test(allText))
  ) {
    issues.push("응답 대상 정보가 제목, 안내문과 문항에서 누락되었습니다.");
  }

  return [...new Set(issues)];
}

export function isLiteralFrequencySurveyRequest(rawPrompt: string) {
  const semantics = parseSurveySemantics(rawPrompt);
  return /(?:빈도|횟수)$/.test(semantics.explicitTopic ?? "");
}

export function isSleepDurationSurveyRequest(rawPrompt: string) {
  const semantics = parseSurveySemantics(rawPrompt);
  return sleepDurationCue.test(
    semantics.explicitTopic ?? semantics.evaluationTarget,
  );
}

export function isExplicitDurationSurveyRequest(rawPrompt: string) {
  const semantics = parseSurveySemantics(rawPrompt);
  return (
    semantics.measurement?.kind === "duration" &&
    !sleepDurationCue.test(
      semantics.explicitTopic ?? semantics.evaluationTarget,
    )
  );
}

export function hasActionableSurveyDirection(rawPrompt: string) {
  const normalized = rawPrompt.replace(/\s+/g, " ").trim();
  if (
    !normalized ||
    /^(?:설문|설문\s*조사|조사|만족도|의견|생각|평가|수요|문제점|개선점|대학생\s*설문|학교\s*설문)$/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /(만족|불만|문제|개선|평가|선호|수요|인지|의향|경험|이용|사용|소비|지출|습관|가입|참여|적응|학교생활|대학생활|등하교|통학|구매|불편|장벽|행태|빈도|횟수|얼마나|정도|시간|기간|비율|비중|퍼센트|여부|선택|순위|생각|느낌)/.test(
    normalized,
  );
}
