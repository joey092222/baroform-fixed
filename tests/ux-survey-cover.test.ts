import assert from "node:assert/strict";
import test from "node:test";

import {
  categoryLabel,
  coverKeywordFromTitle,
  coverPackSize,
  coverPhotoIndex,
  coverPhotoSrc,
  coverSearchTerms,
  coverTone,
  maxCoverKeywordLength,
  photoCreditNotice,
  surveyCover,
} from "../app/ux/survey-cover";
import { surveyCategories } from "../app/survey-board";
import type { PublicSurvey } from "../app/ux/types";

function survey(
  overrides: Partial<Pick<PublicSurvey, "slug" | "title" | "category">> = {},
): Pick<PublicSurvey, "slug" | "title" | "category"> {
  return {
    slug: "library-seats",
    title: "도서관 좌석 예약제, 지금 방식이 맞을까요?",
    category: "campus",
    ...overrides,
  };
}

test("모든 설문 분류에 검색어와 색조가 빠짐없이 정의된다", () => {
  for (const category of surveyCategories) {
    const terms = coverSearchTerms[category.id];
    assert.ok(terms.length > 0, `${category.id} 검색어 없음`);
    const tone = coverTone(category.id);
    assert.match(tone.field, /^#[0-9A-F]{6}$/i);
    assert.match(tone.ink, /^#[0-9A-F]{6}$/i);
  }
});

test("제목이 질문형이면 주제어만 남긴다", () => {
  assert.equal(
    coverKeywordFromTitle("도서관 좌석 예약제, 지금 방식이 맞을까요?"),
    "도서관 좌석 예약제",
  );
  assert.equal(
    coverKeywordFromTitle("팀 프로젝트 갈등에 대한 설문"),
    "팀 프로젝트 갈등",
  );
  assert.equal(coverKeywordFromTitle("학식 만족도 조사"), "학식 만족도");
});

test("쉼표 없는 질문형 제목은 서술어를 떼고 주제만 남긴다", () => {
  assert.equal(
    coverKeywordFromTitle("팀에서 실제로 쓰는 협업 도구는?"),
    "팀에서 실제로 쓰는 협업 도구",
  );
  assert.equal(coverKeywordFromTitle("카페에서 공부하는 이유가 뭔가요?"), "카페에서 공부하는 이유");
  // 「하면 좋을까요」 전체가 서술어라 「다시」까지만 남는 것이 맞다.
  assert.equal(coverKeywordFromTitle("비대면 수업을 다시 하면 좋을까요?"), "비대면 수업을 다시");
});

test("서술어가 없으면 조사를 떼지 않는다", () => {
  // 「도」는 만족도의 일부이지 붙어 있는 조사가 아니다.
  assert.equal(coverKeywordFromTitle("학식 만족도 조사"), "학식 만족도");
  assert.equal(coverKeywordFromTitle("교내 시설 이용 실태"), "교내 시설 이용 실태");
});

test("쉼표가 있으면 앞 절을 그대로 쓴다", () => {
  assert.equal(coverKeywordFromTitle("교내 셔틀 배차 간격, 늘려야 할까요?"), "교내 셔틀 배차 간격");
  assert.equal(coverKeywordFromTitle("신메뉴 가격, 얼마까지 낼 수 있나요?"), "신메뉴 가격");
});

test("괄호 안 부연은 표지에 올리지 않는다", () => {
  assert.equal(
    coverKeywordFromTitle("소비 성향 조사 (구매 심리 중심)"),
    "소비 성향",
  );
});

test("주제어가 길면 잘라내되 상한을 넘지 않는다", () => {
  const keyword = coverKeywordFromTitle(
    "교내 셔틀버스 배차 간격과 노선 조정에 대한 재학생 인식",
  );
  assert.ok(
    keyword.length <= maxCoverKeywordLength,
    `${keyword.length}자로 상한 초과`,
  );
  assert.ok(keyword.endsWith("…"));
});

test("주제어를 뽑을 수 없는 제목이어도 빈 문자열을 내지 않는다", () => {
  assert.equal(coverKeywordFromTitle("설문"), "설문");
  assert.equal(coverKeywordFromTitle("???"), "???");
});

test("같은 설문은 항상 같은 사진을 받는다", () => {
  const first = coverPhotoIndex("library-seats");
  const second = coverPhotoIndex("library-seats");
  assert.equal(first, second);
});

test("사진 번호는 팩 크기를 벗어나지 않는다", () => {
  const slugs = ["a", "library-seats", "team-conflict", "설문-2026", "z".repeat(80)];
  for (const slug of slugs) {
    const index = coverPhotoIndex(slug);
    assert.ok(index >= 0 && index < coverPackSize, `${slug} → ${index}`);
  }
});

test("팩 크기가 0이면 사진 번호를 0으로 접는다", () => {
  assert.equal(coverPhotoIndex("library-seats", 0), 0);
});

test("서로 다른 설문은 사진이 갈린다", () => {
  const indexes = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((slug) =>
      coverPhotoIndex(slug),
    ),
  );
  assert.ok(indexes.size > 1, "모든 설문이 같은 사진을 받고 있음");
});

test("사진 경로는 분류별 팩 안을 가리킨다", () => {
  const src = coverPhotoSrc("campus", "library-seats");
  assert.match(src, /^\/covers\/campus\/[0-7]\.jpg$/);
});

test("사진 팩이 있으면 사진 표지를, 없으면 주제어 표지를 낸다", () => {
  const withPhoto = surveyCover(survey());
  assert.equal(withPhoto.kind, "photo");
  assert.equal(withPhoto.keyword, "도서관 좌석 예약제");
  assert.equal(withPhoto.tag, "교내생활");

  const withoutPhoto = surveyCover(survey(), { hasPhotoPack: false });
  assert.equal(withoutPhoto.kind, "topic");
  assert.equal(withoutPhoto.keyword, "도서관 좌석 예약제");
  assert.equal(withoutPhoto.tag, "교내생활");
  assert.deepEqual(withoutPhoto.tone, coverTone("campus"));
});

test("분류 이름은 게시판 라벨을 그대로 쓴다", () => {
  assert.equal(categoryLabel("course"), "수업·과제");
  assert.equal(categoryLabel("career"), "진로·취업");
});

test("Pexels 출처 표기가 준비되어 있다", () => {
  assert.ok(photoCreditNotice.text.includes("Pexels"));
  assert.equal(photoCreditNotice.href, "https://www.pexels.com");
});
