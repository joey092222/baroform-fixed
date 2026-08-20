import type { SurveyEntityType } from "./survey-knowledge";

export type SurveyResearchEntityCandidate = {
  input_name: string;
  resolved_name: string | null;
  resolved_as: string | null;
  affiliation_or_location: string | null;
  confidence: "verified" | "probable" | "unresolved";
};

export type CanonicalEvaluationTargetSource =
  | "canonical_evaluation_target"
  | "canonical_subject"
  | "matched_research_entity"
  | "survey_plan"
  | "research_entity_fallback";

export type CanonicalEvaluationTargetResolution = {
  evaluationTarget: string;
  recognizedEntity: string | null;
  matchedResearchEntity: SurveyResearchEntityCandidate | null;
  source: CanonicalEvaluationTargetSource;
  entityType: SurveyEntityType;
  confidence: "high" | "medium" | "low";
};

function cleanTarget(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeEvaluationTargetForComparison(
  value: string | null | undefined,
) {
  return cleanTarget(value)
    .toLocaleLowerCase("ko-KR")
    .replace(/대학교|대학/g, "대")
    .replace(/[^0-9a-z가-힣]/g, "");
}

const removableTargetDescriptor =
  /^(?:건물|시설|공간|장소|서비스|플랫폼|제품|앱|애플리케이션|식당|카페)$/;

function targetMatchScore(
  canonicalTarget: string,
  candidateTarget: string | null | undefined,
) {
  const canonical = normalizeEvaluationTargetForComparison(canonicalTarget);
  const candidate = normalizeEvaluationTargetForComparison(candidateTarget);
  if (!canonical || !candidate) return 0;
  if (canonical === candidate) return 100;

  // The canonical parser joins coordinated constructs with "및", while the
  // model or a verified source may use the natural Korean particles "과/와".
  // Treat those spellings as equivalent only when one side explicitly uses
  // the coordination marker. This avoids globally stripping "과" from words
  // such as "결과" or "학과".
  const coordinatedVariants = (value: string) => {
    const parts = cleanTarget(value)
      .toLocaleLowerCase("ko-KR")
      .split(/\s+및\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) return new Set<string>();
    return new Set(
      [" 및 ", "과 ", "와 "].map((separator) =>
        normalizeEvaluationTargetForComparison(parts.join(separator)),
      ),
    );
  };
  const canonicalVariants = coordinatedVariants(canonicalTarget);
  const candidateVariants = coordinatedVariants(candidateTarget ?? "");
  if (
    canonicalVariants.has(candidate) ||
    candidateVariants.has(canonical)
  ) {
    return 98;
  }

  // A verified label may add an affiliation or a harmless type descriptor to
  // the user-facing canonical target (e.g. "대우관" -> "연세대 대우관").
  if (candidate.length > canonical.length && candidate.includes(canonical)) {
    return candidate.endsWith(canonical) ? 90 : 80;
  }

  // Do not treat a parent brand as its child service ("네이버" is not
  // "네이버 웹툰"). Only allow the shorter entity when the remaining text is
  // a generic target-type descriptor.
  if (canonical.length > candidate.length && canonical.startsWith(candidate)) {
    const remainder = canonical.slice(candidate.length);
    if (removableTargetDescriptor.test(remainder)) return 70;
  }
  return 0;
}

export function evaluationTargetsSemanticallyMatch(
  canonicalTarget: string | null | undefined,
  candidateTarget: string | null | undefined,
) {
  return targetMatchScore(cleanTarget(canonicalTarget), candidateTarget) > 0;
}

export function isGenericEvaluationTargetLabel(
  value: string | null | undefined,
) {
  return /^(?:비율|현황|실태|경험|만족도|의견|인식|태도|수요|조사)$/.test(
    normalizeEvaluationTargetForComparison(value),
  );
}

function confidenceRank(
  confidence: SurveyResearchEntityCandidate["confidence"],
) {
  if (confidence === "verified") return 3;
  if (confidence === "probable") return 2;
  return 1;
}

function entityDisplayName(entity: SurveyResearchEntityCandidate) {
  return cleanTarget(entity.resolved_name) || cleanTarget(entity.input_name);
}

function entityTargetMatchScore(
  canonicalTarget: string,
  entity: SurveyResearchEntityCandidate,
) {
  const displayName = entityDisplayName(entity);
  const affiliation = cleanTarget(entity.affiliation_or_location);
  return Math.max(
    targetMatchScore(canonicalTarget, entity.resolved_name),
    targetMatchScore(canonicalTarget, entity.input_name),
    affiliation
      ? targetMatchScore(canonicalTarget, `${affiliation} ${displayName}`)
      : 0,
  );
}

export function selectResearchEntityMatchingEvaluationTarget(
  canonicalTarget: string,
  researchEntities: readonly SurveyResearchEntityCandidate[],
) {
  return researchEntities
    .flatMap((entity) => {
      const score = entityTargetMatchScore(canonicalTarget, entity);
      return score > 0 ? [{ entity, score }] : [];
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const confidenceDifference =
        confidenceRank(right.entity.confidence) -
        confidenceRank(left.entity.confidence);
      if (confidenceDifference !== 0) return confidenceDifference;
      return entityDisplayName(left.entity).localeCompare(
        entityDisplayName(right.entity),
        "ko-KR",
      );
    })[0]?.entity ?? null;
}

function typeFromResolvedAs(
  value: string | null | undefined,
  fallback: SurveyEntityType,
): SurveyEntityType {
  const label = value ?? "";
  if (/건물|관|시설|공간|장소/.test(label)) return "building";
  if (/식당|카페|급식/.test(label)) return "cafeteria";
  if (/동아리|학회/.test(label)) return "club";
  if (/행사|프로그램|축제/.test(label)) return "event";
  if (/수업|강의|과목/.test(label)) return "course";
  if (/도서관/.test(label)) return "library";
  if (/기숙사|생활관/.test(label)) return "dormitory";
  if (/서비스|앱|브랜드|플랫폼|제품/.test(label)) return "service";
  return fallback;
}

function outputConfidence(
  entity: SurveyResearchEntityCandidate | null,
): CanonicalEvaluationTargetResolution["confidence"] {
  if (entity?.confidence === "verified") return "high";
  if (entity?.confidence === "probable") return "medium";
  return "low";
}

function deterministicResearchFallback(
  researchEntities: readonly SurveyResearchEntityCandidate[],
) {
  return [...researchEntities].sort((left, right) => {
    const confidenceDifference =
      confidenceRank(right.confidence) - confidenceRank(left.confidence);
    if (confidenceDifference !== 0) return confidenceDifference;
    return entityDisplayName(left).localeCompare(
      entityDisplayName(right),
      "ko-KR",
    );
  })[0] ?? null;
}

export function resolveCanonicalEvaluationTarget({
  canonicalEvaluationTarget,
  canonicalSubject,
  researchEntities,
  surveyPlanTarget,
  fallbackEntityType,
}: {
  canonicalEvaluationTarget?: string | null;
  canonicalSubject?: string | null;
  researchEntities: readonly SurveyResearchEntityCandidate[];
  surveyPlanTarget?: string | null;
  fallbackEntityType: SurveyEntityType;
}): CanonicalEvaluationTargetResolution {
  const explicitCanonicalTarget = cleanTarget(canonicalEvaluationTarget);
  const subject = cleanTarget(canonicalSubject);
  const surveyPlan = cleanTarget(surveyPlanTarget);
  const canonicalTarget = explicitCanonicalTarget || subject;

  if (canonicalTarget) {
    const matchedResearchEntity =
      selectResearchEntityMatchingEvaluationTarget(
        canonicalTarget,
        researchEntities,
      );
    return {
      evaluationTarget: canonicalTarget,
      recognizedEntity: canonicalTarget,
      matchedResearchEntity,
      source: explicitCanonicalTarget
        ? "canonical_evaluation_target"
        : "canonical_subject",
      entityType: matchedResearchEntity
        ? typeFromResolvedAs(
            matchedResearchEntity.resolved_as,
            fallbackEntityType,
          )
        : fallbackEntityType,
      confidence: outputConfidence(matchedResearchEntity),
    };
  }

  const planMatch = surveyPlan
    ? selectResearchEntityMatchingEvaluationTarget(
        surveyPlan,
        researchEntities,
      )
    : null;
  const fallbackEntity = planMatch ?? deterministicResearchFallback(researchEntities);
  const fallbackTarget = fallbackEntity
    ? entityDisplayName(fallbackEntity)
    : surveyPlan;
  return {
    evaluationTarget: fallbackTarget,
    recognizedEntity: fallbackTarget || null,
    matchedResearchEntity: fallbackEntity,
    source: planMatch
      ? "survey_plan"
      : fallbackEntity
        ? "research_entity_fallback"
        : "survey_plan",
    entityType: fallbackEntity
      ? typeFromResolvedAs(fallbackEntity.resolved_as, fallbackEntityType)
      : fallbackEntityType,
    confidence: outputConfidence(fallbackEntity),
  };
}
