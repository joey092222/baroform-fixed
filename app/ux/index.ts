/**
 * The UX layer: state, flows, rules, and data access for Baroform.
 *
 * Contains no markup and no styling. Any UI — the current one, or a rewrite from
 * scratch — consumes this module and nothing under `app/ui/`.
 *
 * See docs/UX-SPEC.md for what each flow guarantees.
 */

export * from "./types";
export * from "./navigation";
export * as surveyEditing from "./survey-editing";
export * as surveyResponse from "./survey-response";
export * as surveyCover from "./survey-cover";

export { ApiError, isUnauthorized } from "./data/http";
export * as surveysApi from "./data/surveys";
export * as authApi from "./data/auth";
export * as walletApi from "./data/wallet";
export * as pulsesApi from "./data/pulses";
export * as communityApi from "./data/community";
export * as surveyDraftApi from "./data/survey-draft";
export * as managedSurvey from "./data/managed-survey";

export { useToast, toastDurations } from "./state/use-toast";
export { useSession } from "./state/use-session";
export { useNavigation } from "./state/use-navigation";
export { useSurveyCatalog } from "./state/use-survey-catalog";
export { useSurveyDraft } from "./state/use-survey-draft";
export { useSurveyGeneration } from "./state/use-survey-generation";
export { useSurveyResponse } from "./state/use-survey-response";
export { usePublish } from "./state/use-publish";
export { useSurveyClaim } from "./state/use-survey-claim";

export type { ToastController } from "./state/use-toast";
export type { SessionController } from "./state/use-session";
export type { NavigationController } from "./state/use-navigation";
export type { SurveyCatalogController } from "./state/use-survey-catalog";
export type { SurveyDraftController } from "./state/use-survey-draft";
export type { SurveyGenerationController } from "./state/use-survey-generation";
export type { SurveyResponseController } from "./state/use-survey-response";
export type { PublishController } from "./state/use-publish";
