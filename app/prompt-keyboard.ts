export type PromptKeyboardEvent = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
};

export function shouldSubmitPromptOnEnter(event: PromptKeyboardEvent) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
