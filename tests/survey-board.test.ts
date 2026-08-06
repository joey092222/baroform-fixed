import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryLabel,
  isSchoolId,
  isSurveyCategory,
  schoolLabel,
  surveyPublicationState,
  surveyCategories,
} from "../app/survey-board";

test("연세대학교 가입자와 학교 게시판 분류를 식별한다", () => {
  assert.equal(isSchoolId("yonsei"), true);
  assert.equal(isSchoolId("unknown"), false);
  assert.equal(schoolLabel("yonsei"), "연세대학교 신촌캠퍼스");
});

test("링크 배포와 학교 게시는 모두 로그인된 작성자만 가능하다", () => {
  assert.deepEqual(surveyPublicationState(true, true), {
    requiresLogin: false,
    listingRequested: true,
    isListed: true,
  });
  assert.deepEqual(surveyPublicationState(true, false), {
    requiresLogin: true,
    listingRequested: true,
    isListed: false,
  });
  assert.deepEqual(surveyPublicationState(false, false), {
    requiresLogin: true,
    listingRequested: false,
    isListed: false,
  });
  assert.deepEqual(surveyPublicationState(false, true), {
    requiresLogin: false,
    listingRequested: false,
    isListed: false,
  });
});

test("겹치지 않는 여섯 개 업로드 카테고리를 제공한다", () => {
  assert.deepEqual(
    surveyCategories.map((category) => category.label),
    ["수업·과제", "동아리·학생단체", "학회·연구", "교내생활", "진로·취업", "기타"],
  );
  assert.equal(isSurveyCategory("course"), true);
  assert.equal(isSurveyCategory("advertisement"), false);
  assert.equal(categoryLabel("research"), "학회·연구");
});
