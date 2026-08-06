import assert from "node:assert/strict";
import test from "node:test";
import {
  campusPulseTimeLeft,
  rankCampusPulses,
  type CampusPulse,
} from "../app/campus-pulse";

function pulse(id: string, totalVotes: number, createdAt: string): CampusPulse {
  return {
    id,
    question: `${id} 질문`,
    options: ["예", "아니요"],
    createdAt,
    expiresAt: "2026-08-08T00:00:00.000Z",
    totalVotes,
    myVote: null,
    overall: [totalVotes, 0],
  };
}

test("캠퍼스의 생각은 참여자가 가장 많은 투표를 대표로 고른다", () => {
  const ranked = rankCampusPulses([
    pulse("new", 4, "2026-08-06T02:00:00.000Z"),
    pulse("popular", 18, "2026-08-05T02:00:00.000Z"),
    pulse("old", 4, "2026-08-04T02:00:00.000Z"),
  ]);

  assert.equal(ranked[0]?.id, "popular");
  assert.deepEqual(ranked.map((item) => item.id), ["popular", "new", "old"]);
});

test("캠퍼스 투표의 남은 시간을 시간과 일 단위로 표시한다", () => {
  const now = new Date("2026-08-06T00:00:00.000Z").getTime();
  assert.equal(campusPulseTimeLeft("2026-08-06T05:00:00.000Z", now), "5시간 남음");
  assert.equal(campusPulseTimeLeft("2026-08-08T00:00:00.000Z", now), "2일 남음");
});
