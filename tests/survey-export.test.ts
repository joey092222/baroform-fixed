import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSurveyCsv,
  buildSurveyExportModel,
  createSurveyExcelBlob,
  createSurveyWordBlob,
  type SurveyExportPayload,
} from "../app/survey-export";

const payload: SurveyExportPayload = {
  title: "경영관 이용 조사",
  questions: [
    {
      id: 1,
      title: "시설에 얼마나 만족하시나요?",
      reason: "만족도 확인",
      type: "scale",
      required: true,
      scaleMin: 1,
      scaleMax: 5,
    },
    {
      id: 2,
      title: "개선할 항목을 골라주세요.",
      reason: "개선 우선순위 확인",
      type: "multiple",
      required: true,
      options: ["좌석", "환기", "안내표지"],
    },
    {
      id: 3,
      title: "구체적인 의견을 적어주세요.",
      reason: "상세 의견 확인",
      type: "text",
      required: false,
    },
    {
      id: 4,
      title: "응답자 정보",
      reason: "섹션 구분",
      type: "section",
      required: false,
    },
  ],
  responses: [
    {
      id: "response-1",
      completionSeconds: 20,
      createdAt: "2026-08-03T01:00:00.000Z",
      answers: [
        { questionId: 1, title: "시설 만족", type: "scale", value: 4 },
        {
          questionId: 2,
          title: "개선 항목",
          type: "multiple",
          value: ["좌석", "환기"],
        },
        {
          questionId: 3,
          title: "의견",
          type: "text",
          value: "좌석이 좁고, 안내가 \"복잡해요\".",
        },
      ],
    },
    {
      id: "response-2",
      completionSeconds: 40,
      createdAt: "2026-08-03T02:00:00.000Z",
      answers: [
        { questionId: 1, title: "시설 만족", type: "scale", value: 5 },
        {
          questionId: 2,
          title: "개선 항목",
          type: "multiple",
          value: ["좌석"],
        },
      ],
    },
  ],
};

test("Excel과 Word가 공유하는 결과 모델에 원본과 문항 요약을 정확히 만든다", () => {
  const model = buildSurveyExportModel(payload);

  assert.equal(model.totalResponses, 2);
  assert.equal(model.averageSeconds, 30);
  assert.equal(model.rawRows.length, 3);
  assert.equal(model.rawRows[0].length, 7);
  assert.equal(model.rawRows[1][5], "좌석 · 환기");
  assert.equal(model.questionSummaries.length, 3);
  assert.equal(model.questionSummaries[0].headline, "평균 4.50 / 5");
  assert.deepEqual(model.questionSummaries[1].distribution[0], {
    label: "좌석",
    count: 2,
    percentage: 100,
  });
  assert.deepEqual(model.questionSummaries[2].textResponses, [
    "좌석이 좁고, 안내가 \"복잡해요\".",
  ]);
});

test("CSV는 한글용 BOM과 쉼표·따옴표 이스케이프를 포함한다", () => {
  const csv = buildSurveyCsv(payload);

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /"좌석 · 환기"/);
  assert.match(csv, /"좌석이 좁고, 안내가 ""복잡해요""\."/);
  assert.equal(csv.split("\r\n").length, 3);
});

test("Excel과 Word 파일을 실제 Office 문서로 생성한다", async () => {
  const [excelBlob, wordBlob] = await Promise.all([
    createSurveyExcelBlob(payload),
    createSurveyWordBlob(payload),
  ]);
  const { unzipSync, strFromU8 } = await import("fflate");
  const excelArchive = unzipSync(new Uint8Array(await excelBlob.arrayBuffer()));
  const workbookXml = strFromU8(excelArchive["xl/workbook.xml"]);
  const wordHeader = new Uint8Array(await wordBlob.slice(0, 2).arrayBuffer());

  assert.match(workbookXml, /name="응답 원본"/);
  assert.match(workbookXml, /name="문항별 요약"/);
  assert.ok(excelArchive["xl/worksheets/sheet1.xml"]);
  assert.ok(excelArchive["xl/worksheets/sheet2.xml"]);
  assert.equal(excelBlob.size > 2_000, true);
  assert.deepEqual([...wordHeader], [0x50, 0x4b]);
  assert.equal(wordBlob.size > 5_000, true);
});
