import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Guards against a bug that fails silently.
 *
 * Drizzle renders `${table.column}` inside a raw `sql` template as a bare
 * `"column"` with no table prefix. In a correlated subquery that name resolves
 * against the subquery's own table instead of the outer one, so
 *
 *   SELECT COUNT(*) FROM responses WHERE responses.survey_id = ${surveys.id}
 *
 * compiles to `... = "id"` and matches `responses.id` — every count comes back
 * as 0 and nothing raises. It shipped once already: response counts, community
 * like/comment counts, and external-survey visit counts were all zero after the
 * Neon → Supabase move.
 *
 * Inside a correlated subquery, write the outer table's column literally.
 */
const routesWithSubqueries = [
  "app/api/surveys/route.ts",
  "app/api/community/route.ts",
  "app/api/external-surveys/route.ts",
  "app/api/workspaces/route.ts",
];

function subqueryLines(source: string) {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /\bWHERE\b/i.test(line) && /\$\{/.test(line));
}

test("상관 서브쿼리에 drizzle 컬럼 보간을 쓰지 않는다", () => {
  const offenders: string[] = [];
  for (const file of routesWithSubqueries) {
    const source = readFileSync(file, "utf8");
    for (const { line, number } of subqueryLines(source)) {
      offenders.push(`${file}:${number} — ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `상관 서브쿼리의 WHERE 절에 \${...} 보간이 있습니다. 접두사 없는 컬럼명으로 ` +
      `컴파일되어 집계가 조용히 0이 됩니다. 바깥 테이블 컬럼을 문자열로 적어주세요.\n` +
      offenders.join("\n"),
  );
});

test("집계 서브쿼리가 바깥 테이블을 이름으로 한정한다", () => {
  const expected: Array<[string, string]> = [
    ["app/api/surveys/route.ts", "responses.survey_id = surveys.id"],
    ["app/api/community/route.ts", "community_likes.post_id = community_posts.id"],
    ["app/api/community/route.ts", "community_comments.post_id = community_posts.id"],
    [
      "app/api/external-surveys/route.ts",
      "external_survey_visits.external_survey_id = external_surveys.id",
    ],
    ["app/api/workspaces/route.ts", "responses.survey_id = surveys.id"],
  ];
  for (const [file, clause] of expected) {
    const source = readFileSync(file, "utf8");
    assert.ok(
      source.includes(clause),
      `${file} 에 "${clause}" 가 없습니다. 집계 대상이 바뀌었다면 이 테스트도 함께 고쳐주세요.`,
    );
  }
});
