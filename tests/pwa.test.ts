import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import manifest from "../app/manifest";

test("PWA는 설치 후 앱 홈을 독립 창으로 연다", () => {
  const value = manifest();

  assert.equal(value.start_url, "/?app=1");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.short_name, "바로폼");
});

test("일반 아이콘과 마스커블 아이콘을 모두 제공한다", () => {
  const icons = manifest().icons ?? [];

  assert.equal(icons.some((icon) => icon.sizes === "192x192"), true);
  assert.equal(icons.some((icon) => icon.sizes === "512x512"), true);
  assert.equal(icons.some((icon) => icon.purpose === "maskable"), true);
});

test("서비스 워커는 API 응답을 캐시하지 않고 오프라인 진입 화면을 둔다", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(source, /const OFFLINE_URL = "\/offline"/);
  assert.doesNotMatch(source, /startsWith\("\/api\/"\)/);
  assert.match(source, /request\.mode === "navigate"/);
});
