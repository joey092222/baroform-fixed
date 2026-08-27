import assert from "node:assert/strict";
import test from "node:test";

import {
  expandTemplate,
  findTemplate,
  surveyTemplates,
  templateBlocks,
  templateCategories,
  templateQuestionCount,
  templatesByCategory,
} from "../app/survey-templates";

test("템플릿 28종과 카테고리 6종이 모두 실려 있다", () => {
  assert.equal(surveyTemplates.length, 28);
  assert.equal(templateCategories.length, 6);
  const covered = new Set(surveyTemplates.map((template) => template.category));
  assert.equal(covered.size, 6);
});

test("템플릿 id는 중복되지 않는다", () => {
  const ids = surveyTemplates.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("모든 템플릿이 정의된 블록만 참조한다", () => {
  for (const template of surveyTemplates) {
    assert.ok(template.blocks.length > 0, `${template.id} 블록 없음`);
    for (const blockId of template.blocks) {
      assert.ok(templateBlocks[blockId], `${template.id} → ${blockId} 정의 없음`);
    }
  }
});

test("카테고리별 합이 전체와 같다", () => {
  const total = templateCategories.reduce(
    (sum, category) => sum + templatesByCategory(category).length,
    0,
  );
  assert.equal(total, surveyTemplates.length);
});

test("선택형 문항에는 선택지가 두 개 이상 있다", () => {
  for (const block of Object.values(templateBlocks)) {
    for (const field of block.fields) {
      if (field.type !== "single" && field.type !== "multiple") continue;
      // 주제에 따라 채워지는 예시 선택지는 비어 있을 수 있다.
      if (!field.options) continue;
      assert.ok(
        field.options.length >= 2,
        `${block.id} · ${field.label} 선택지 ${field.options.length}개`,
      );
    }
  }
});

test("펼친 문항은 id가 1부터 빈틈 없이 이어진다", () => {
  for (const template of surveyTemplates) {
    const questions = expandTemplate(template);
    assert.ok(questions.length > 0, `${template.id} 문항 없음`);
    questions.forEach((question, index) => {
      assert.equal(question.id, index + 1, `${template.id} id 불연속`);
      assert.ok(question.title.length > 0, `${template.id} 빈 제목`);
      assert.ok(question.reason.length > 0, `${template.id} 근거 누락`);
    });
  }
});

test("척도 문항은 1–5 범위를 갖는다", () => {
  const scales = surveyTemplates
    .flatMap((template) => expandTemplate(template))
    .filter((question) => question.type === "scale");
  assert.ok(scales.length > 0);
  for (const scale of scales) {
    assert.equal(scale.scaleMin, 1);
    assert.equal(scale.scaleMax, 5);
  }
});

test("안내 문구는 섹션으로 들어가고 문항 수에서 빠진다", () => {
  const template = findTemplate("course_consumer_perception");
  assert.ok(template, "course_consumer_perception 템플릿 없음");
  const questions = expandTemplate(template);
  const sections = questions.filter((question) => question.type === "section");
  // INTRO 안내문 + CONTACT_REWARD 의 개인정보 파기 고지 — 둘 다 응답할 것이 없다.
  assert.equal(sections.length, 2);
  assert.equal(questions[0].type, "section", "안내문이 맨 앞에 오지 않는다");
  assert.equal(templateQuestionCount(template), questions.length - sections.length);
});

test("모든 템플릿에서 문항 수가 섹션을 빼고 계산된다", () => {
  for (const template of surveyTemplates) {
    const questions = expandTemplate(template);
    const sections = questions.filter((question) => question.type === "section");
    assert.equal(
      templateQuestionCount(template),
      questions.length - sections.length,
      `${template.id} 문항 수 불일치`,
    );
  }
});

test("조사 대상을 주면 자리표시자 문구가 바뀐다", () => {
  const template = findTemplate("course_consumer_perception");
  assert.ok(template);
  const generic = expandTemplate(template);
  const named = expandTemplate(template, "중앙도서관");

  const hasPlaceholder = generic.some((question) =>
    question.title.includes("해당 서비스/제품"),
  );
  assert.ok(hasPlaceholder, "자리표시자가 있는 문항이 없어 검증 불가");
  assert.ok(
    !named.some((question) => question.title.includes("해당 서비스/제품")),
    "자리표시자가 남아있다",
  );
  assert.ok(named.some((question) => question.title.includes("중앙도서관")));
});

test("조사 대상을 주지 않으면 문구를 건드리지 않는다", () => {
  const template = findTemplate("course_consumer_perception");
  assert.ok(template);
  const a = expandTemplate(template);
  const b = expandTemplate(template, "");
  assert.deepEqual(
    a.map((question) => question.title),
    b.map((question) => question.title),
  );
});

test("동아리 지원서는 이름·학번을 필수로 받는다", () => {
  const template = findTemplate("club_recruitment_application");
  assert.ok(template);
  const questions = expandTemplate(template);
  for (const label of ["이름", "학번"]) {
    const found = questions.find((question) => question.title === label);
    assert.ok(found, `${label} 문항 없음`);
    assert.equal(found.required, true, `${label}가 필수가 아니다`);
  }
});

test("표본 건수가 기록되어 있고 합이 분석 규모와 맞는다", () => {
  for (const template of surveyTemplates) {
    assert.ok(template.sampleCount > 0, `${template.id} 표본 0건`);
  }
  const total = surveyTemplates.reduce(
    (sum, template) => sum + template.sampleCount,
    0,
  );
  // 318건 분석 기반. 한 설문이 여러 유형에 걸치지 않으므로 합이 이를 넘으면 안 된다.
  assert.ok(total <= 318, `표본 합계 ${total}건이 분석 규모 318건을 넘는다`);
});
