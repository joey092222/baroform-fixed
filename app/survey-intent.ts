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
  if (participatedObject) return participatedObject[1].tri…26937 tokens truncated… 전과 비교하면 ${focus} 시간은 어떻게 달라졌나요?`,
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
        blueprint = usageBlueprint(
          subject.replace(/\s*(?:이용|사용)\s*경험$/, "").trim() || subject,
        );
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

function surveyOptionInterval(option: string): SurveyOptionInterval | null {
  const normalized = option.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const context = normalized.match(/^(최근\s+\S+|하루|일주일|주|월|학기)/)?.[0] ?? "";
  const bounded = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)?\s*이상\s*(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*미만/,
  );
  if (bounded) {
    return {
      context,
      unit: bounded[4] || bounded[2] || "count",
      minimum: Number(bounded[1]),
      maximum: Number(bounded[3]),
      minimumInclusive: true,
      maximumInclusive: false,
    };
  }
  const range = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)?\s*[~～-]\s*(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)/,
  );
  if (range) {
    return {
      context,
      unit: range[4] || range[2] || "count",
      minimum: Number(range[1]),
      maximum: Number(range[3]),
      minimumInclusive: true,
      maximumInclusive: true,
    };
  }
  const upper = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*미만/,
  );
  if (upper) {
    return {
      context,
      unit: upper[2],
      minimum: Number.NEGATIVE_INFINITY,
      maximum: Number(upper[1]),
      minimumInclusive: false,
      maximumInclusive: false,
    };
  }
  const lower = normalized.match(
    /(\d+(?:\.\d+)?)\s*(회|분|시간|원|만원|개|명)\s*이상/,
  );
  if (lower) {
    return {
      context,
      unit: lower[2],
      minimum: Number(lower[1]),
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
    requestExpression.test(brief.researchSubject)
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
    if (
      /(?:만족|평가).*(?:과|와|및).*(?:불편|개선|의향|빈도|시간|비용)|(?:불편|개선).*(?:과|와|및).*(?:만족|의향|빈도|시간)|(?:빈도|횟수|시간|비용).*(?:과|와|및).*(?:만족|불편|의향)/.test(
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

