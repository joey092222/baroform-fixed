import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitPromptOnEnter } from "../app/prompt-keyboard";

test("설문 주제 입력창은 Enter로 제출한다", () => {
  assert.equal(
    shouldSubmitPromptOnEnter({
      key: "Enter",
      shiftKey: false,
      isComposing: false,
    }),
    true,
  );
});

test("Shift+Enter와 한글 조합 중 Enter는 제출하지 않는다", () => {
  assert.equal(
    shouldSubmitPromptOnEnter({
      key: "Enter",
      shiftKey: true,
      isComposing: false,
    }),
    false,
  );
  assert.equal(
    shouldSubmitPromptOnEnter({
      key: "Enter",
      shiftKey: false,
      isComposing: true,
    }),
    false,
  );
});
