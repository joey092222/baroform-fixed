import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSurveyMetadata,
  buildSurveyShareDescription,
  buildUnavailableSurveyMetadata,
  defaultOpenGraphImagePath,
  fitOpenGraphDescription,
  fitOpenGraphTitle,
  surveyOpenGraphImagePath,
  surveyOpenGraphImageSize,
  surveyOpenGraphImageUrl,
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
  assert.equal(
    surveyOpenGraphImagePath(firstSurvey.slug),
    "/api/og/survey/a1b2c3d4e5f6",
  );
});

test("서로 다른 설문은 서로 다른 OG title, description, image를 만든다", () => {
  const first = buildSurveyMetadata(firstSurvey);
  const second = buildSurveyMetadata(secondSurvey);

  assert.notEqual(first.openGraph?.title, second.openGraph?.title);
  assert.notEqual(first.openGraph?.description, second.openGraph?.description);
  assert.notDeepEqual(first.openGraph?.images, second.openGraph?.images);
  assert.equal(first.openGraph?.title, firstSurvey.title);
  assert.equal(first.openGraph?.siteName, "바로폼");
  assert.equal(first.openGraph?.locale, "ko_KR");
  assert.equal((first.openGraph as { type?: string } | undefined)?.type, "website");
  const [firstImage] = first.openGraph?.images as Array<{
    width: number;
    height: number;
    type: string;
  }>;
  // 숫자를 여기 다시 적지 않는다. 예전에는 800x400이 박혀 있어서, 카드가
  // 1236x686으로 바뀌고 metadata만 800x400에 남았을 때 이 테스트가 통과해 버렸다.
  // 카카오톡은 선언된 규격과 실제 이미지가 다르면 미리보기를 통째로 포기한다.
  assert.deepEqual(
    { width: firstImage.width, height: firstImage.height, type: firstImage.type },
    {
      width: surveyOpenGraphImageSize.width,
      height: surveyOpenGraphImageSize.height,
      type: "image/png",
    },
  );
  assert.equal((first.twitter as { card?: string } | undefined)?.card, "summary_large_image");
  assert.match(String(first.alternates?.canonical), /\/s\/a1b2c3d4e5f6$/);
  assert.match(
    surveyOpenGraphImageUrl(firstSurvey),
    /\/api\/og\/survey\/a1b2c3d4e5f6\?v=/,
  );
});

test("설문 설명은 저장된 소개와 시간·문항 수를 결정론적으로 조합한다", () => {
  const description = buildSurveyShareDescription(firstSurvey);
  assert.ok(Array.from(description).length <= 110);
  assert.match(description, /연세대학교 재학생 대상 · 약 3분 · 12문항$/);
  assert.doesNotMatch(description, /<[^>]+>|\s{2,}/);

  const emptyDescription = buildSurveyShareDescription({
    ...firstSurvey,
    description: "",
  });
  assert.match(emptyDescription, /네이버웹툰 이용 경험 조사/);
  assert.match(emptyDescription, /약 3분 · 12문항$/);
});

test("비공개·없는 설문용 metadata에는 설문 제목이 섞이지 않는다", () => {
  const privateTitle = "절대 공개하면 안 되는 임시 설문";
  const metadata = buildUnavailableSurveyMetadata(firstSurvey.slug);
  assert.doesNotMatch(JSON.stringify(metadata), new RegExp(privateTitle));
  assert.equal(metadata.title, "바로폼 | 설문을 쉽고 빠르게");
  assert.match(JSON.stringify(metadata.openGraph?.images), new RegExp(defaultOpenGraphImagePath));
  assert.equal((metadata.robots as { index?: boolean } | undefined)?.index, false);
});

test("OG 제목은 최대 두 줄과 말줄임으로 안전하게 제한한다", () => {
  const lines = fitOpenGraphTitle("아주 긴 설문 제목".repeat(10));
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => Array.from(line).length <= 20));
  assert.match(lines[1], /…$/);

  const descriptionLines = fitOpenGraphDescription("긴 설명입니다".repeat(30));
  assert.equal(descriptionLines.length, 2);
  assert.ok(descriptionLines.every((line) => Array.from(line).length <= 35));
  assert.match(descriptionLines[1], /…$/);
});

test("공유 카드 규격과 글꼴은 한 곳에서만 정의한다", async () => {
  const [cardSource, fontSource] = await Promise.all([
    readFile("app/lib/og-survey-card.tsx", "utf8"),
    readFile("app/lib/open-graph-font.ts", "utf8"),
  ]);

  // 카드가 크기를 새로 적으면 metadata와 어긋난다. 실제로 그렇게 어긋났을 때
  // 카카오톡은 미리보기를 통째로 포기하고 링크를 맨 텍스트로 띄웠다.
  assert.match(cardSource, /imageSize = surveyOpenGraphImageSize/);
  assert.doesNotMatch(cardSource, /export const imageSize = \{/);

  // satori는 없는 굵기를 합성하지 못한다. 라벨 볼드 / 값 레귤러를 지키려면 둘 다 실어야 한다.
  assert.match(fontSource, /Pretendard-Regular-Baroform\.ttf/);
  assert.match(fontSource, /Pretendard-Bold-Baroform\.ttf/);
});

test("운영 공개 조회와 share route는 익명 공개 조건과 서버 metadata를 사용한다", async () => {
  const [
    dataSource,
    pageSource,
    imageSource,
    fontSource,
    configSource,
    environmentExample,
    shareMetadataSource,
    appSource,
  ] = await Promise.all([
    readFile("app/lib/public-survey.ts", "utf8"),
    readFile("app/s/[shareToken]/page.tsx", "utf8"),
    readFile("app/api/og/survey/[shareToken]/route.tsx", "utf8"),
    readFile("app/lib/open-graph-font.ts", "utf8"),
    readFile("next.config.ts", "utf8"),
    readFile(".env.example", "utf8"),
    readFile("app/survey-share.ts", "utf8"),
    readFile("app/page.tsx", "utf8"),
  ]);

  assert.match(dataSource, /eq\(surveys\.isPublic, true\)/);
  assert.doesNotMatch(dataSource, /manageToken/);
  assert.match(pageSource, /generateMetadata/);
  assert.match(pageSource, /getPublicSurvey/);
  assert.match(imageSource, /ImageResponse/);
  assert.doesNotMatch(imageSource, /OpenAI|openai/);
  assert.match(fontSource, /Pretendard-Bold-Baroform\.ttf/);
  assert.doesNotMatch(fontSource, /\.woff2/);
  assert.match(fontSource, /readFile/);
  assert.doesNotMatch(fontSource, /fetch\(/);
  assert.match(configSource, /kakaotalk-scrap/);
  assert.match(environmentExample, /^NEXT_PUBLIC_SITE_URL=$/m);
  assert.doesNotMatch(shareMetadataSource, /baroform-fixed\.vercel\.app/);
  assert.match(appSource, /navigator\.clipboard\.writeText\(shareUrl\)/);
  assert.match(appSource, /fetch\(`\/api\/surveys\/\$\{survey\.slug\}\/responses`/);
  assert.match(appSource, /initialSurvey\s*\?\s*"survey"\s*:\s*"landing"/);
  await readFile("public/og/baroform-default.png");
});
