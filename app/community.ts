export const communityCategories = [
  { id: "free", label: "자유" },
  { id: "survey", label: "설문·리서치" },
  { id: "study", label: "스터디·팀원" },
  { id: "campus", label: "학교생활" },
] as const;

export type CommunityCategory = (typeof communityCategories)[number]["id"];
export type CommunityScope = "all" | "school";

export function isCommunityCategory(value: string): value is CommunityCategory {
  return communityCategories.some((category) => category.id === value);
}

export function isCommunityScope(value: string): value is CommunityScope {
  return value === "all" || value === "school";
}

export function communityCategoryLabel(value: string) {
  return communityCategories.find((category) => category.id === value)?.label ?? "자유";
}

export function normalizedCommunityPost(input: {
  title?: unknown;
  content?: unknown;
  category?: unknown;
  visibility?: unknown;
}) {
  const title = typeof input.title === "string" ? input.title.replace(/\s+/g, " ").trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const category = typeof input.category === "string" && isCommunityCategory(input.category)
    ? input.category
    : "free";
  const visibility = typeof input.visibility === "string" && isCommunityScope(input.visibility)
    ? input.visibility
    : "all";

  return { title, content, category, visibility };
}
