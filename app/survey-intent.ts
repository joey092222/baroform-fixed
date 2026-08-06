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

export type SurveySemantics = {
  respondentGroup: string | null;
  evaluationTarget: string;
  explicitTopic: string | null;
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

const normalizePrompt = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

const personHead =
  "(?:학생|대학생|신입생|새내기|재학생|졸업생|교환학생|복학생|수강생|수강자|이용자|비이용자|사용자|가입자|회원|참여자|참가자|참석자|방문객|관람객|구매자|고객|직원|교직원|교수|조교|주민|거주자|거주생|자취생|기숙사생|학부모|응답자|지원자|20대|\\d{2}학번)";

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
    /앱|서비스|사이트|플랫폼|제품|기능|사용자|사용한|이용한|쓰는/.test(
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
    kind,
    domain,
    goalLabel: literalFrequency
      ? "빈도 파악"
      : literalConsumptionHabits
        ? "소비 행태 파악"
        : literalSleepDuration
          ? "수면 시간과 인식 파악"
          : movement
            ? "이동 경험과 개선점"
            : goalLabels[kind],
    requestedAsOpinion,
    topicWasInferred,
    assumptions,
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
        "운영 시간과 자료 이용 편의에 얼마나 만족하시나요?",
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

function usageBlueprint(subject: string): SurveyBlueprint {
  const topic = topicLabel(subject);
  const templateQuestions = [
    question(
      1,
      `${topicWithParticle(subject, "을", "를")} 얼마나 자주 사용하거나 이용하시나요?`,
      "응답자의 실제 이용 수준을 구분해 분석 기준을 만들어요.",
      "single",
      ["거의 매일", "주 1~3회", "월 1~3회", "드물게", "사용한 적 없음"],
    ),
    question(
      2,
      `${topicWithParticle(subject, "을", "를")} 주로 어떤 목적으로 이용하나요?`,
      "사용자가 해결하려는 핵심 과업을 확인해요.",
      "multiple",
      ["정보 탐색", "과제·업무", "소통·교류", "구매·신청", "기록·관리", "기타"],
    ),
    question(
      3,
      `${topic} 사용 경험에 전반적으로 얼마나 만족하시나요?`,
      "이용 빈도와 함께 전체 경험 품질을 측정해요.",
      "scale",
    ),
    question(
      4,
      `${topicWithParticle(subject, "을", "를")} 사용하며 불편했던 부분을 모두 골라주세요.`,
      "이탈이나 불만을 만드는 사용성 문제를 구체적으로 찾을 수 있어요.",
      "multiple",
      ["원하는 기능을 찾기 어려움", "절차가 복잡함", "속도가 느림", "안내가 부족함", "오류가 있음", "특별한 불편 없음"],
    ),
    question(
      5,
      `${topic}에서 가장 먼저 개선되었으면 하는 점을 적어주세요.`,
      "사용자가 체감하는 최우선 개선 과제를 수집해요.",
      "text",
      undefined,
      false,
    ),
  ];

  return {
    kind: "usage",
    intentLabel: "사용 경험·행태",
    subject,
    title: `${subject} 사용 경험 조사`,
    description: `${subject}의 실제 이용 방식과 만족도, 불편 요소 및 개선 요구를 파악하는 익명 설문입니다.`,
    templateTitle: `${subject} 사용 경험`,
    templateSummary: "이용 빈도와 목적, 만족도, 불편 요소, 개선 요구를 흐름에 맞게 확인해요.",
    detectedSignals: [`대상 · ${subject}`, "목적 · 사용 경험과 개선"],
    templateQuestions,
    aiQuestions: [
      ...templateQuestions,
      question(
        6,
        `${topic}에서 가장 자주 사용하는 기능이나 영역은 무엇인가요?`,
        "핵심 사용 흐름을 찾아 개선 우선순위를 정할 수 있어요.",
        "text",
        undefined,
        false,
      ),
      question(
        7,
        `앞으로도 ${topicWithParticle(subject, "을", "를")} 계속 이용할 의향이 어느 정도인가요?`,
        "현재 경험이 지속 이용 가능성으로 이어지는지 확인해요.",
        "scale",
      ),
    ],
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
    return `${labelWithParticle(verbNoun[1], "을", "를")} 얼마나 자주 ${verbNoun[2]}하나요?`;
  }
  return `${labelWithParticle(focus, "을", "를")} 얼마나 자주 하나요?`;
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
    ? `${labelWithParticle(focus, "이", "가")} 얼마나 자주 드나요?`
    : `${labelWithParticle(focus, "을", "를")} 얼마나 자주 경험하나요?`;
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

export function analyzeSurveyPrompt(rawPrompt: string): SurveyBlueprint {
  const directProportion = parseDirectProportionRequest(rawPrompt);
  if (directProportion) return proportionBlueprint(directProportion);

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
