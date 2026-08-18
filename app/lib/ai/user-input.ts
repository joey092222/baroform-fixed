export type SurveyUserInputSelection = {
  rawUserInput: string;
  sourceField: "userInput" | "prompt" | null;
};

export function normalizeUserInput(input: string): string {
  return input.replace(/\r\n?/g, "\n").trim();
}

export function selectSurveyUserInput(payload: {
  userInput?: unknown;
  prompt?: unknown;
}): SurveyUserInputSelection {
  if (typeof payload.userInput === "string") {
    return { rawUserInput: payload.userInput, sourceField: "userInput" };
  }
  if (typeof payload.prompt === "string") {
    return { rawUserInput: payload.prompt, sourceField: "prompt" };
  }
  return { rawUserInput: "", sourceField: null };
}
