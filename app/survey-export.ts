import type { SurveyQuestion } from "./survey-intent";

export type ExportAnswer = {
  questionId: number;
  title: string;
  type: SurveyQuestion["type"];
  value: number | string | string[];
};

export type ExportResponse = {
  id: string;
  answers: ExportAnswer[];
  completionSeconds: number;
  createdAt: string;
};

export type SurveyExportPayload = {
  title: string;
  questions: SurveyQuestion[];
  responses: ExportResponse[];
};

export type ExportDistributionRow = {
  label: string;
  count: number;
  percentage: number;
};

export type ExportQuestionSummary = {
  number: number;
  question: SurveyQuestion;
  typeLabel: string;
  responseCount: number;
  headline: string;
  distribution: ExportDistributionRow[];
  textResponses: string[];
};

export type SurveyExportModel = {
  title: string;
  generatedAt: Date;
  totalResponses: number;
  averageSeconds: number;
  firstResponseAt: string;
  lastResponseAt: string;
  rawRows: Array<Array<string | number>>;
  questionSummaries: ExportQuestionSummary[];
};

const questionTypeLabels: Record<SurveyQuestion["type"], string> = {
  scale: "척도형",
  single: "단일 선택",
  multiple: "복수 선택",
  dropdown: "드롭다운",
  shortText: "단답형",
  text: "서술형",
  date: "날짜",
  time: "시간",
  section: "구분",
};

function hasValue(value: ExportAnswer["value"] | undefined) {
  return (
    value !== undefined &&
    value !== "" &&
    (!Array.isArray(value) || value.length > 0)
  );
}

function answerText(value: ExportAnswer["value"] | undefined) {
  if (Array.isArray(value)) return value.join(" · ");
  return String(value ?? "");
}

function answerValues(question: SurveyQuestion, responses: ExportResponse[]) {
  return responses
    .map(
      (response) =>
        response.answers.find((answer) => answer.questionId === question.id)
          ?.value,
    )
    .filter(
      (value): value is ExportAnswer["value"] => hasValue(value),
    );
}

function responseDateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function percentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function summarizeQuestion(
  question: SurveyQuestion,
  responses: ExportResponse[],
  number: number,
): ExportQuestionSummary {
  const values = answerValues(question, responses);

  if (question.type === "scale") {
    const numbers = values.filter(
      (value): value is number => typeof value === "number",
    );
    const minimum = question.scaleMin === 0 ? 0 : 1;
    const maximum = Math.min(10, Math.max(minimum + 1, question.scaleMax ?? 5));
    const average =
      numbers.length > 0
        ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
        : 0;
    return {
      number,
      question,
      typeLabel: questionTypeLabels[question.type],
      responseCount: numbers.length,
      headline:
        numbers.length > 0
          ? `평균 ${average.toFixed(2)} / ${maximum}`
          : "응답 없음",
      distribution: Array.from(
        { length: maximum - minimum + 1 },
        (_, index) => minimum + index,
      ).map((score) => {
        const count = numbers.filter((value) => value === score).length;
        return {
          label: `${score}점`,
          count,
          percentage: percentage(count, numbers.length),
        };
      }),
      textResponses: [],
    };
  }

  if (
    question.type === "single" ||
    question.type === "multiple" ||
    question.type === "dropdown"
  ) {
    const choices = values.flatMap((value) =>
      Array.isArray(value) ? value : typeof value === "string" ? [value] : [],
    );
    const labels = [
      ...(question.options ?? []),
      ...choices.filter((choice) => !(question.options ?? []).includes(choice)),
    ].filter((label, index, all) => all.indexOf(label) === index);
    const distribution = labels.map((label) => {
      const count = choices.filter((choice) => choice === label).length;
      return {
        label,
        count,
        percentage: percentage(count, values.length),
      };
    });
    const top = [...distribution].sort((a, b) => b.count - a.count)[0];
    return {
      number,
      question,
      typeLabel: questionTypeLabels[question.type],
      responseCount: values.length,
      headline:
        top && top.count > 0
          ? `${top.label} ${top.count}명 (${top.percentage}%)`
          : "응답 없음",
      distribution,
      textResponses: [],
    };
  }

  const textResponses = values.map(answerText).filter(Boolean);
  return {
    number,
    question,
    typeLabel: questionTypeLabels[question.type],
    responseCount: textResponses.length,
    headline:
      textResponses.length > 0 ? `응답 ${textResponses.length}개` : "응답 없음",
    distribution: [],
    textResponses,
  };
}

export function buildSurveyExportModel({
  title,
  questions,
  responses,
}: SurveyExportPayload): SurveyExportModel {
  const answerQuestions = questions.filter(
    (question) => question.type !== "section",
  );
  const sortedDates = responses
    .map((response) => new Date(response.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const averageSeconds =
    responses.length > 0
      ? Math.round(
          responses.reduce(
            (sum, response) => sum + response.completionSeconds,
            0,
          ) / responses.length,
        )
      : 0;

  return {
    title: title.trim() || "바로폼 설문",
    generatedAt: new Date(),
    totalResponses: responses.length,
    averageSeconds,
    firstResponseAt:
      sortedDates.length > 0
        ? responseDateValue(sortedDates[0].toISOString())
        : "—",
    lastResponseAt:
      sortedDates.length > 0
        ? responseDateValue(sortedDates[sortedDates.length - 1].toISOString())
        : "—",
    rawRows: [
      [
        "응답 번호",
        "응답 ID",
        "응답 일시",
        "소요 시간(초)",
        ...answerQuestions.map(
          (question, index) => `Q${index + 1}. ${question.title}`,
        ),
      ],
      ...responses.map((response, responseIndex) => [
        responseIndex + 1,
        response.id,
        responseDateValue(response.createdAt),
        response.completionSeconds,
        ...answerQuestions.map((question) =>
          answerText(
            response.answers.find(
              (answer) => answer.questionId === question.id,
            )?.value,
          ),
        ),
      ]),
    ],
    questionSummaries: answerQuestions.map((question, index) =>
      summarizeQuestion(question, responses, index + 1),
    ),
  };
}

function safeFilename(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "바로폼 설문").slice(0, 80);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildSurveyCsv(payload: SurveyExportPayload) {
  const model = buildSurveyExportModel(payload);
  const escapeCell = (value: string | number) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };
  return `\uFEFF${model.rawRows
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n")}`;
}

export function downloadSurveyCsv(payload: SurveyExportPayload) {
  const model = buildSurveyExportModel(payload);
  downloadBlob(
    new Blob([buildSurveyCsv(payload)], { type: "text/csv;charset=utf-8" }),
    `${safeFilename(model.title)}-설문결과.csv`,
  );
}

export async function createSurveyExcelBlob(payload: SurveyExportPayload) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const model = buildSurveyExportModel(payload);
  const summaryRows: Array<Array<string | number>> = [
    ["설문 제목", model.title],
    ["전체 응답", model.totalResponses],
    ["평균 응답 시간(초)", model.averageSeconds],
    ["첫 응답", model.firstResponseAt],
    ["마지막 응답", model.lastResponseAt],
    [],
    [
      "문항 번호",
      "문항",
      "유형",
      "유효 응답",
      "핵심 결과",
      "선택지/점수",
      "인원",
      "비율(%)",
    ],
  ];
  model.questionSummaries.forEach((summary) => {
    if (summary.distribution.length > 0) {
      summary.distribution.forEach((row, index) => {
        summaryRows.push([
          index === 0 ? `Q${summary.number}` : "",
          index === 0 ? summary.question.title : "",
          index === 0 ? summary.typeLabel : "",
          index === 0 ? summary.responseCount : "",
          index === 0 ? summary.headline : "",
          row.label,
          row.count,
          row.percentage,
        ]);
      });
    } else {
      summaryRows.push([
        `Q${summary.number}`,
        summary.question.title,
        summary.typeLabel,
        summary.responseCount,
        summary.headline,
        "",
        "",
        "",
      ]);
    }
  });
  const spreadsheetRows = (
    rows: Array<Array<string | number>>,
    emphasizedRows: number[],
  ) =>
    rows.map((row, rowIndex) =>
      row.map((value) => ({
        value,
        type: typeof value === "number" ? Number : String,
        fontWeight: emphasizedRows.includes(rowIndex) ? ("bold" as const) : undefined,
        backgroundColor: emphasizedRows.includes(rowIndex) ? "#E9EEF5" : undefined,
        color: "#17243A",
        wrap: true,
      })),
    );
  const writer = writeXlsxFile(
    [
      {
        data: spreadsheetRows(model.rawRows, [0]),
        sheet: "응답 원본",
        stickyRowsCount: 1,
        columns: model.rawRows[0].map((_, index) => ({
          width: index === 0 ? 12 : index === 1 ? 38 : index < 4 ? 22 : 36,
        })),
      },
      {
        data: spreadsheetRows(summaryRows, [0, 1, 2, 3, 4, 6]),
        sheet: "문항별 요약",
        columns: [
          { width: 12 },
          { width: 48 },
          { width: 14 },
          { width: 12 },
          { width: 30 },
          { width: 28 },
          { width: 10 },
          { width: 12 },
        ],
      },
    ],
    {},
  );
  const blob = await writer.toBlob();
  return new Blob([blob], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function downloadSurveyExcel(payload: SurveyExportPayload) {
  const model = buildSurveyExportModel(payload);
  downloadBlob(
    await createSurveyExcelBlob(payload),
    `${safeFilename(model.title)}-설문결과.xlsx`,
  );
}

function durationText(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}분 ${remainder}초` : `${minutes}분`;
}

export async function createSurveyWordBlob(payload: SurveyExportPayload) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");
  const model = buildSurveyExportModel(payload);
  const border = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "DDE3EA",
  };
  const tableBorders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
  const cell = (text: string, bold = false) =>
    new TableCell({
      margins: { top: 110, bottom: 110, left: 140, right: 140 },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, font: "Malgun Gothic" })],
        }),
      ],
    });
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [
    new Paragraph({
      text: model.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "설문 결과 보고서",
          color: "526174",
          size: 24,
          font: "Malgun Gothic",
        }),
      ],
      spacing: { after: 320 },
    }),
    new Paragraph({ text: "조사 개요", heading: HeadingLevel.HEADING_1 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [
        new TableRow({ children: [cell("전체 응답", true), cell(`${model.totalResponses}개`)] }),
        new TableRow({ children: [cell("평균 응답 시간", true), cell(durationText(model.averageSeconds))] }),
        new TableRow({ children: [cell("응답 기간", true), cell(`${model.firstResponseAt} ~ ${model.lastResponseAt}`)] }),
        new TableRow({
          children: [
            cell("보고서 생성", true),
            cell(responseDateValue(model.generatedAt.toISOString())),
          ],
        }),
      ],
    }),
    new Paragraph({
      text: "문항별 결과",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 420 },
    }),
  ];

  model.questionSummaries.forEach((summary) => {
    children.push(
      new Paragraph({
        text: `Q${summary.number}. ${summary.question.title}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 90 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${summary.typeLabel} · 유효 응답 ${summary.responseCount}개 · ${summary.headline}`,
            color: "526174",
            font: "Malgun Gothic",
          }),
        ],
        spacing: { after: 150 },
      }),
    );
    if (summary.distribution.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            new TableRow({
              children: [
                cell("선택지 / 점수", true),
                cell("응답 수", true),
                cell("비율", true),
              ],
            }),
            ...summary.distribution.map(
              (row) =>
                new TableRow({
                  children: [
                    cell(row.label),
                    cell(`${row.count}명`),
                    cell(`${row.percentage}%`),
                  ],
                }),
            ),
          ],
        }),
      );
    } else if (summary.textResponses.length > 0) {
      const visibleResponses = summary.textResponses.slice(0, 100);
      children.push(
        ...visibleResponses.map(
          (response, index) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. `,
                  bold: true,
                  color: "526174",
                  font: "Malgun Gothic",
                }),
                new TextRun({ text: response, font: "Malgun Gothic" }),
              ],
              spacing: { after: 90 },
            }),
        ),
      );
      if (summary.textResponses.length > visibleResponses.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `나머지 ${summary.textResponses.length - visibleResponses.length}개 응답은 Excel 원본에서 확인할 수 있습니다.`,
                italics: true,
                color: "68778B",
                font: "Malgun Gothic",
              }),
            ],
          }),
        );
      }
    }
  });

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Malgun Gothic", size: 20, color: "17243A" },
          paragraph: { spacing: { line: 280 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function downloadSurveyWord(payload: SurveyExportPayload) {
  const model = buildSurveyExportModel(payload);
  downloadBlob(
    await createSurveyWordBlob(payload),
    `${safeFilename(model.title)}-설문결과.docx`,
  );
}
