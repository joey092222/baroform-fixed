import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { surveyRegressionDatasetSchema } from "../v1/schema";
import {
  auditedSurveyRegressionCaseSchema,
  auditedSurveyRegressionDatasetSchema,
  type AuditedSurveyRegressionCase,
} from "./schema";

const auditedAt = "2026-08-19T00:00:00.000Z";
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const originalDirectory = resolve(directory, "../v1");
const reportDirectory = resolve(root, "reports");

const originalFiles = {
  dev: resolve(originalDirectory, "dev.json"),
  holdout: resolve(originalDirectory, "holdout.json"),
};

const noisyQualityOverrides = new Set([
  "dev-past-001",
  "dev-past-009",
]);

const explicitAuditOverrides: Record<
  string,
  Partial<AuditedSurveyRegressionCase>
> = {
  "dev-complex-011": {
    inputQuality: "noisy_recoverable",
    expectedTargetPopulation: ["최근 한 달 동안 별마루 카페를 이용한 주민"],
    contextEntities: ["별마루 카페"],
    expectedEligibilityConditions: ["최근 한 달 내 별마루 카페 이용"],
    expectedSurveyObject: ["별마루 카페의 새 메뉴"],
    expectedPurposeConcepts: ["새 메뉴 만족도"],
    requiredQuestionConcepts: ["만족도"],
    screeningExpected: true,
    forbiddenPurposeConcepts: [
      "별마루 카페 일반 이용 경험",
      "별마루 카페 전체 만족도",
      "주민 일반 특성",
    ],
  },
};

const respondentConditionPattern =
  /(?:이용|사용|참여|참가|가입|구매|방문|시청|주문|수강|통학|출근|운동|클릭|먹|다니)(?:한|하는|했던|하지|하지\s*않|한\s*적|지\s*않)|(?:비이용|미구매|불참|미가입|비방문|비시청|비주문)|(?:최근|지난|이번)\s+(?:\d+|한|두|세|네)?\s*(?:일|주|주일|개월|달|학기|년)/u;

const concreteContextPattern =
  /(?:대학교|대학|학부|학과|전공|도서관|체육관|상담센터|식당|카페|매장|센터|플랫폼|서비스|프로그램|앱|어플|웹툰|강의|수업|축제|캠프|멘토링|학식|관$)/u;

function inputQualityFor(item: {
  id: string;
  expectedOutcome: string;
  tags: string[];
}) {
  if (item.expectedOutcome === "clarification") return "ambiguous" as const;
  if (item.tags.includes("noisy_input") || noisyQualityOverrides.has(item.id)) {
    return "noisy_recoverable" as const;
  }
  return "clear" as const;
}

function eligibilityFor(targets: string[]) {
  return targets.filter((target) => respondentConditionPattern.test(target));
}

function contextEntitiesFor(item: {
  expectedSurveyObject: string[];
  mustPreserveTerms: string[];
}) {
  return [
    ...new Set(
      [...item.expectedSurveyObject, ...item.mustPreserveTerms].filter((value) =>
        concreteContextPattern.test(value),
      ),
    ),
  ];
}

function auditCase(
  item: ReturnType<typeof surveyRegressionDatasetSchema.parse>["cases"][number],
) {
  const expectedEligibilityConditions = eligibilityFor(
    item.expectedTargetPopulation,
  );
  return auditedSurveyRegressionCaseSchema.parse({
    ...item,
    inputQuality: inputQualityFor(item),
    contextEntities: contextEntitiesFor(item),
    expectedEligibilityConditions,
    screeningExpected:
      item.expectedOutcome === "survey" &&
      expectedEligibilityConditions.length > 0,
    forbiddenPurposeConcepts: [],
    ...explicitAuditOverrides[item.id],
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function auditAction(item: AuditedSurveyRegressionCase) {
  if (item.id === "dev-complex-011") return "rewrite_for_clear_split";
  if (item.inputQuality === "noisy_recoverable") {
    return "keep_as_noisy_recoverable";
  }
  if (item.inputQuality === "ambiguous") return "relabel_as_clarification";
  return "keep_as_is";
}

function auditReason(item: AuditedSurveyRegressionCase) {
  if (item.id === "dev-complex-011") {
    return "도치된 만족도 목적, 최근 이용 적격 조건, 카페 맥락, 새 메뉴 평가 대상을 분리함. 모델 출력과 무관하게 문장 자체의 우세한 해석을 기준으로 함.";
  }
  if (item.inputQuality === "noisy_recoverable") {
    return "축약·구어체·조사 생략이 있으나 응답 대상과 조사 목적의 우세한 해석이 하나이므로 복구 가능한 입력으로 보존함.";
  }
  if (item.inputQuality === "ambiguous") {
    return "응답 대상 또는 구체적인 조사 대상·기준이 빠져 있어 임의 설문 대신 clarification이 필요함.";
  }
  return "응답 대상과 조사 대상 또는 목적이 제품 입력으로 충분히 식별되는 문장·명사구이므로 유지함.";
}

await mkdir(directory, { recursive: true });
await mkdir(reportDirectory, { recursive: true });

const originals = await Promise.all(
  Object.entries(originalFiles).map(async ([split, path]) => {
    const raw = await readFile(path, "utf8");
    return {
      split: split as "dev" | "holdout",
      raw,
      dataset: surveyRegressionDatasetSchema.parse(JSON.parse(raw)),
    };
  }),
);

const auditedDatasets = originals.map(({ split, dataset }) =>
  auditedSurveyRegressionDatasetSchema.parse({
    version: "v1.1-audited",
    sourceVersion: "v1-original",
    split,
    seed: dataset.seed,
    generatedAt: dataset.generatedAt,
    auditedAt,
    cases: dataset.cases.map(auditCase),
  }),
);
const allCases = auditedDatasets.flatMap((dataset) => dataset.cases);

const changelog = allCases.map((item) => {
  const original = originals
    .flatMap(({ dataset }) => dataset.cases)
    .find((candidate) => candidate.id === item.id)!;
  return {
    caseId: item.id,
    action: auditAction(item),
    previousInput: original.input,
    revisedInput: item.input,
    previousExpectation: {
      expectedOutcome: original.expectedOutcome,
      expectedTargetPopulation: original.expectedTargetPopulation,
      expectedSurveyObject: original.expectedSurveyObject,
      expectedPurposeConcepts: original.expectedPurposeConcepts,
      requiredQuestionConcepts: original.requiredQuestionConcepts,
    },
    revisedExpectation: {
      inputQuality: item.inputQuality,
      expectedOutcome: item.expectedOutcome,
      expectedTargetPopulation: item.expectedTargetPopulation,
      expectedEligibilityConditions: item.expectedEligibilityConditions,
      contextEntities: item.contextEntities,
      expectedSurveyObject: item.expectedSurveyObject,
      expectedPurposeConcepts: item.expectedPurposeConcepts,
      requiredQuestionConcepts: item.requiredQuestionConcepts,
      screeningExpected: item.screeningExpected,
      forbiddenPurposeConcepts: item.forbiddenPurposeConcepts,
    },
    reason: auditReason(item),
    semanticBasis:
      "입력 자체의 한국어 의미, 서술 관계, 조사 대상·응답 대상·적격 조건·조사 목적 구분을 기준으로 판정함.",
    inputQuality: item.inputQuality,
  };
});

const counts = Object.fromEntries(
  ["clear", "noisy_recoverable", "ambiguous", "invalid_test_sentence"].map(
    (quality) => [
      quality,
      allCases.filter((item) => item.inputQuality === quality).length,
    ],
  ),
);
const actions = Object.fromEntries(
  [
    "keep_as_is",
    "rewrite_for_clear_split",
    "keep_as_noisy_recoverable",
    "relabel_as_clarification",
    "invalid_test_sentence_replace",
  ].map((action) => [
    action,
    allCases.filter((item) => auditAction(item) === action).length,
  ]),
);

const report = [
  "# 바로폼 설문 회귀 v1.1 데이터셋 감사",
  "",
  `- 원본: survey-regression-v1-original (100건, Dev 80 / Seen Holdout 20)`,
  `- 감사본: survey-regression-v1.1-audited (100건, Dev 80 / Seen Holdout 20)`,
  `- 감사 기준일: ${auditedAt}`,
  `- 분포: clear ${counts.clear}, noisy_recoverable ${counts.noisy_recoverable}, ambiguous ${counts.ambiguous}, invalid_test_sentence ${counts.invalid_test_sentence}`,
  `- 조치: keep ${actions.keep_as_is}, noisy 유지 ${actions.keep_as_noisy_recoverable}, clear/noisy 분리 ${actions.rewrite_for_clear_split}, clarification 재확인 ${actions.relabel_as_clarification}, 교체 ${actions.invalid_test_sentence_replace}`,
  "",
  "## dev-complex-011",
  "",
  "- 자연스러움: noisy_recoverable",
  "- 우세 해석: 최근 한 달 내 별마루 카페 이용 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사",
  "- 적격 조건: 최근 한 달 내 별마루 카페 이용",
  "- 맥락 장소: 별마루 카페",
  "- 조사 대상: 별마루 카페의 새 메뉴",
  "- 조사 목적: 새 메뉴 만족도",
  "- screeningExpected: true",
  "- 일반적인 카페 이용 경험은 독립 조사 목적이 아니며, 이용 적격성 확인으로 평가함.",
  "",
  "## 전체 사례 판정",
  "",
  "| caseId | inputQuality | action | input |",
  "| --- | --- | --- | --- |",
  ...allCases.map(
    (item) =>
      `| ${item.id} | ${item.inputQuality} | ${auditAction(item)} | ${item.input.replaceAll("|", "\\|")} |`,
  ),
  "",
].join("\n");

await Promise.all([
  ...auditedDatasets.map((dataset) =>
    writeFile(
      join(directory, `${dataset.split}.json`),
      `${JSON.stringify(dataset, null, 2)}\n`,
      "utf8",
    ),
  ),
  writeFile(
    resolve(reportDirectory, "survey-regression-v1-dataset-changelog.json"),
    `${JSON.stringify(changelog, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(reportDirectory, "survey-regression-v1-dataset-audit.md"),
    `${report}\n`,
    "utf8",
  ),
  writeFile(
    resolve(reportDirectory, "survey-regression-v1-original-manifest.json"),
    `${JSON.stringify(
      {
        version: "survey-regression-v1-original",
        files: Object.fromEntries(
          originals.map(({ split, raw }) => [split, { sha256: sha256(raw) }]),
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
]);

process.stdout.write(
  `${JSON.stringify({ total: allCases.length, counts, actions }, null, 2)}\n`,
);
