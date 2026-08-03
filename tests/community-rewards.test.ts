import assert from "node:assert/strict";
import test from "node:test";
import {
  communityCategoryLabel,
  isCommunityCategory,
  isCommunityScope,
  normalizedCommunityPost,
} from "../app/community";
import { surveyRewardAmount } from "../app/rewards";

test("커뮤니티 글의 범위와 카테고리를 안전하게 정규화한다", () => {
  assert.equal(isCommunityScope("all"), true);
  assert.equal(isCommunityScope("private"), false);
  assert.equal(isCommunityCategory("survey"), true);
  assert.equal(communityCategoryLabel("study"), "스터디·팀원");
  assert.deepEqual(
    normalizedCommunityPost({
      title: "  설문   참여자 구해요 ",
      content: "  경영대 학생 대상입니다.  ",
      category: "survey",
      visibility: "school",
    }),
    {
      title: "설문 참여자 구해요",
      content: "경영대 학생 대상입니다.",
      category: "survey",
      visibility: "school",
    },
  );
});

test("캐시는 로그인한 타인 설문 응답자에게 설문당 한 번 지급할 금액만 계산한다", () => {
  assert.equal(surveyRewardAmount({ respondentId: null, ownerId: "owner", rewardCash: 30 }), 0);
  assert.equal(surveyRewardAmount({ respondentId: "owner", ownerId: "owner", rewardCash: 30 }), 0);
  assert.equal(surveyRewardAmount({ respondentId: "member", ownerId: "owner", rewardCash: 30 }), 30);
  assert.equal(surveyRewardAmount({ respondentId: "member", ownerId: "owner", rewardCash: 5000 }), 1000);
});
