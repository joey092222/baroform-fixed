export const schoolOptions = [
  {
    id: "yonsei",
    name: "연세대학교",
    campus: "신촌캠퍼스",
  },
] as const;

export type SchoolId = (typeof schoolOptions)[number]["id"];

export const surveyCategories = [
  { id: "course", label: "수업·과제" },
  { id: "club", label: "동아리·학생단체" },
  { id: "research", label: "학회·연구" },
  { id: "campus", label: "교내생활" },
  { id: "career", label: "진로·취업" },
  { id: "other", label: "기타" },
] as const;

export type SurveyCategory = (typeof surveyCategories)[number]["id"];

export function isSchoolId(value: string): value is SchoolId {
  return schoolOptions.some((school) => school.id === value);
}

export function isSurveyCategory(value: string): value is SurveyCategory {
  return surveyCategories.some((category) => category.id === value);
}

export function schoolLabel(id: string) {
  const school = schoolOptions.find((item) => item.id === id);
  return school ? `${school.name} ${school.campus}` : "학교 미지정";
}

export function categoryLabel(id: string) {
  return surveyCategories.find((item) => item.id === id)?.label ?? "기타";
}

export function surveyPublicationState(
  listingRequested: boolean,
  hasAuthenticatedOwner: boolean,
) {
  return {
    requiresLogin: listingRequested && !hasAuthenticatedOwner,
    listingRequested,
    isListed: listingRequested && hasAuthenticatedOwner,
  };
}
