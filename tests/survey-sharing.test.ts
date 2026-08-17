import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSurveyMetadata,
  buildSurveyShareDescription,
  buildUnavailableSurveyMetadata,
  fitOpenGraphTitle,
  surveySharePath,
} from "../app/survey-share";

const firstSurvey = {
  slug: "a1b2c3d4e5f6",
  title: "대학생의 네이버웹툰 이용 경험 조사",
  description:
    "연세대 재학생의 네이버웹툰 이용 빈도와 만족도를 알아보는 설문입니다",
  targetAudience: "연세대학교 재학생",
  durationMinutes: 3,
  questionCount: 12,
  rewardCash: 30,
  updatedAt: "2026-08-17T10:00:00.000Z",
};

const secondSurvey = {
  ...firstSurvey,
  slug: "0f1e2d3c4b5a",
  title: "대학생 평균 수면 시간 조사",
  description: "대학생의 평일 수면 시간과 지각 경험을 알아보는 설문입니다",
  durationMinutes: 4,
  questionCount: 9,
};

test("공개 설문 canonical 경로는 서버가 처리하는 shareToken 라우트다", () => {
  assert.equal(surveySharePath(firstSurvey.slug), "/s/a1b2c3d4e5f6");
  assert.equal(surveySharePath("a/b"), "/s/a%2Fb");
});

test("서로 다른 설문은 서로 다른 OG title, description, image를 만든다", () => {
  const first = buildSurveyMetadata(firstSurvey);
  const second = buildSurveyMetadata(secondSurvey);

  assert.notEqual(first.openGraph?.title, second.openGraph?.title);
  assert.notEqual(first.openGraph?.description, second.openGraph?.description);
  assert.notDeepEqual(first.openGraph?.images, second.openGraph?.images);
  assert.equal(first.openGraph?.siteName, "바로폼");
  assert.equal((first.openGraph as { type?: string } | undefined)?.type, "website");
  assert.equal((first.twitter as { card?: string } | undefined)?.card, "summary_large_image");
  assert.match(String(first.alternates?.canonical), /\/s\/a1b2c3d4e5f6$/);
});

test("설문 설명은 저장된 소개와 시간·문항 수를 결정론적으로 조합한다", () => {
  assert.equal(
    buildSurveyShareDescription(firstSurvey),
    "연세대 재학생의 네이버웹툰 이용 빈도와 만족도를 알아보는 설문입니다. 약 3분 · 12문항",
  );
});

test("비공개·없는 설문용 metadata에는 설문 제목이 섞이지 않는다", () => {
  const privateTitle = "절대 공개하면 안 되는 임시 설문";
  const metadata = buildUnavailableSurveyMetadata(firstSurvey.slug);
  assert.doesNotMatch(JSON.stringify(metadata), new RegExp(privateTitle));
  assert.equal((metadata.robots as { index?: boolean } | undefined)?.index, false);
});

test("OG 제목은 최대 두 줄과 말줄임으로 안전하게 제한한다", () => {
  const lines = fitOpenGraphTitle("아주 긴 설문 제목".repeat(10));
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => Array.from(line).length <= 22));
  assert.match(lines[1], /…$/);
});

test("운영 공개 조회와 share route는 익명 공개 조건과 서버 metadata를 사용한다", async () => {
  const [dataSource, pageSource, imageSource] = await Promise.all([
    readFile("app/lib/public-survey.ts", "utf8"),
    readFile("app/s/[shareToken]/page.tsx", "utf8"),
    readFile("app/s/[shareToken]/opengraph-image.tsx", "utf8"),
  ]);

  assert.match(dataSource, /eq\(surveys\.isPublic, true\)/);
  assert.doesNotMatch(dataSource, /manageToken/);
  assert.match(pageSource, /generateMetadata/);
  assert.match(pageSource, /getPublicSurvey/);
  assert.match(imageSource, /ImageResponse/);
  assert.doesNotMatch(imageSource, /OpenAI|openai/);
});
