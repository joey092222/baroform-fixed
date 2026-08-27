import type { SurveyQuestion } from "../survey-intent";
import type { SurveyCategory } from "../survey-board";
import type { CommunityCategory, CommunityScope } from "../community";

/**
 * Domain types shared by the UX layer and any UI that renders it.
 * Nothing here describes presentation — a replacement UI reuses this file as is.
 */

export type Question = SurveyQuestion;

export type PublicSurvey = {
  source?: "internal" | "external";
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  schoolId: string;
  category: SurveyCategory;
  campus: string;
  durationMinutes: number;
  rewardCash: number;
  targetAudience?: string;
  responseCount?: number;
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
  questions?: Question[];
  externalUrl?: string;
  platform?: string;
  targetResponses?: number;
  participantCount?: number;
};

export type OwnedSurvey = PublicSurvey & {
  manageToken: string;
  responseCount: number;
  listingRequested: boolean;
  isListed: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  schoolId: string;
};

export type WalletTransaction = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type WalletData = {
  balance: number;
  transactions: WalletTransaction[];
};

export type StoredAnswer = {
  questionId: number;
  title: string;
  type: Question["type"];
  value: number | string | string[];
};

export type StoredResponse = {
  id: string;
  answers: StoredAnswer[];
  completionSeconds: number;
  createdAt: string;
  quality?: {
    score: number;
    status: "usable" | "review" | "exclude";
    reasons: string[];
  };
};

export type SurveyReferenceImage = {
  id: string;
  name: string;
  dataUrl: string;
};

export type SurveyReferenceFile = {
  id: string;
  name: string;
  fileToken: string;
  mimeType: string;
  size: number;
};

export type SurveyReferences = {
  images: SurveyReferenceImage[];
  files: SurveyReferenceFile[];
  links: string[];
};

export type ManagedSurveySnapshot = {
  slug: string;
  manageToken: string;
  title: string;
  questions: Question[];
};

export type SurveyReward = {
  amount: number;
  balance: number | null;
  requiresLogin: boolean;
  ownSurvey: boolean;
};

/** The one document that must survive create -> edit -> publish. */
export type SurveyDraftDocument = {
  title: string;
  description: string;
  questions: Question[];
};

export type CommunityPost = {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  visibility: CommunityScope;
  schoolId: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  isMine: boolean;
};

export type CommunityComment = {
  id: string;
  content: string;
  authorName: string;
  schoolId: string;
  createdAt: string;
};

export const emptySurveyReferences: SurveyReferences = {
  images: [],
  files: [],
  links: [],
};

export function hasSurveyReferences(references: SurveyReferences) {
  return (
    references.images.length > 0 ||
    references.files.length > 0 ||
    references.links.length > 0
  );
}

export function surveyReferenceCount(references: SurveyReferences) {
  return (
    references.images.length + references.files.length + references.links.length
  );
}

export function referenceImageDataLength(references: SurveyReferences) {
  return references.images.reduce(
    (total, image) => total + image.dataUrl.length,
    0,
  );
}

export function referenceFilesTotalBytes(references: SurveyReferences) {
  return references.files.reduce((total, file) => total + file.size, 0);
}
