import assert from "node:assert/strict";
import test from "node:test";

import {
  appViews,
  isAppView,
  readEntryIntent,
  urlForView,
  viewOwnsItsUrl,
} from "../app/ux/navigation";
import {
  isValidManageToken,
  isValidSurveySlug,
} from "../app/ux/data/managed-survey";

test("진입 URL은 랜딩·앱·설문·검토 네 가지 의도로만 해석된다", () => {
  // 랜딩은 별도 사이트가 맡으므로 루트는 앱입니다. 랜딩 시안은 ?landing=1.
  assert.deepEqual(readEntryIntent(""), { kind: "app" });
  assert.deepEqual(readEntryIntent("?app=1"), { kind: "app" });
  assert.deepEqual(readEntryIntent("?landing=1"), { kind: "landing" });
  assert.deepEqual(readEntryIntent("?landing=0"), { kind: "app" });
  assert.deepEqual(readEntryIntent("?survey=abc123def456"), {
    kind: "survey",
    slug: "abc123def456",
  });
});

test("검토 토큰은 32자 hex만 인정하고, 설문 파라미터보다 우선한다", () => {
  const token = "a".repeat(32);
  assert.deepEqual(readEntryIntent(`?workspaceReview=${token}`), {
    kind: "workspace-review",
    token,
  });
  assert.deepEqual(
    readEntryIntent(`?workspaceReview=${token}&survey=abc123def456`),
    { kind: "workspace-review", token },
    "검토 링크가 설문 링크를 이긴다",
  );
  assert.deepEqual(readEntryIntent("?workspaceReview=tooshort"), {
    kind: "app",
  });
  assert.deepEqual(readEntryIntent(`?workspaceReview=${"A".repeat(32)}`), {
    kind: "app",
  });
});

test("앱 화면이 쿼리 없는 URL을 쓰고, 응답 화면은 자기 URL을 직접 관리한다", () => {
  // 루트가 앱이므로 반대가 됐습니다 — 랜딩 시안만 쿼리를 답니다.
  assert.equal(urlForView("landing", "/"), "/?landing=1");
  assert.equal(urlForView("home", "/"), "/");
  assert.equal(urlForView("editor", "/"), "/");
  assert.equal(viewOwnsItsUrl("survey"), true);
  assert.equal(viewOwnsItsUrl("home"), false);
});

test("화면 목록은 13개이며 문자열 판별이 가능하다", () => {
  assert.equal(appViews.length, 13);
  assert.equal(isAppView("editor"), true);
  assert.equal(isAppView("nope"), false);
});

test("로컬에 보관하는 설문 핸들은 형식을 검증한다", () => {
  assert.equal(isValidSurveySlug("abc123def456"), true);
  assert.equal(isValidSurveySlug("ABC123DEF456"), false, "대문자는 거부한다");
  assert.equal(isValidSurveySlug("abc123"), false);
  assert.equal(isValidManageToken("f".repeat(32)), true);
  assert.equal(isValidManageToken("f".repeat(31)), false);
  assert.equal(isValidManageToken(null), false);
});
