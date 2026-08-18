import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  surveyRegressionDatasetSchema,
  type SurveyRegressionCase,
  type SurveyRegressionDataset,
} from "./schema";

export type DatasetQualityReport = {
  errors: string[];
  warnings: string[];
  counts: {
    total: number;
    dev: number;
    holdout: number;
    standard: number;
    research: number;
    clarification: number;
    negation: number;
    timeframe: number;
    virtualEntity: number;
    nonUniversity: number;
    multipleTargets: number;
    singleTargetMultiPurpose: number;
    complexOrder: number;
    noisyInput: number;
  };
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  byStratum: Record<string, number>;
  highSimilarityPairs: Array<{ left: string; right: string; similarity: number }>;
};

export function normalizeDatasetInput(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function characterTrigrams(value: string) {
  const normalized = normalizeDatasetInput(value);
  if (normalized.length <= 3) return new Set([normalized]);
  return new Set(
    Array.from({ length: normalized.length - 2 }, (_, index) =>
      normalized.slice(index, index + 3),
    ),
  );
}

export function trigramSimilarity(left: string, right: string) {
  const a = characterTrigrams(left);
  const b = characterTrigrams(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function tagCount(cases: SurveyRegressionCase[], tag: SurveyRegressionCase["tags"][number]) {
  return cases.filter((item) => item.tags.includes(tag)).length;
}

const requiredStrata: Record<string, number> = {
  "dev:past_error_variant": 20,
  "dev:general_domain": 32,
  "dev:complex_relation": 16,
  "dev:incomplete_user_input": 6,
  "dev:clarification": 6,
  "holdout:past_error_variant": 4,
  "holdout:general_domain": 8,
  "holdout:complex_relation": 4,
  "holdout:incomplete_user_input": 2,
  "holdout:clarification": 2,
};

export function validateDatasetQuality(
  cases: SurveyRegressionCase[],
): DatasetQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const byStratum: Record<string, number> = {};
  const ids = new Set<string>();
  const inputs = new Set<string>();
  const normalizedInputs = new Map<string, string>();

  for (const item of cases) {
    increment(byCategory, item.category);
    increment(byDifficulty, item.difficulty);
    increment(byStratum, `${item.split}:${item.stratum}`);
    if (ids.has(item.id)) errors.push(`duplicate-id:${item.id}`);
    ids.add(item.id);
    if (inputs.has(item.input)) errors.push(`duplicate-input:${item.id}`);
    inputs.add(item.input);
    const normalized = normalizeDatasetInput(item.input);
    const previous = normalizedInputs.get(normalized);
    if (previous) errors.push(`duplicate-normalized-input:${previous}:${item.id}`);
    normalizedInputs.set(normalized, item.id);
    for (const term of item.mustPreserveTerms) {
      if (!normalizeDatasetInput(item.input).includes(normalizeDatasetInput(term))) {
        errors.push(`missing-preserved-term:${item.id}:${term}`);
      }
    }
    if (
      item.mustPreserveNegation &&
      !/(?:않|안(?:\s|시|함|씀|감|가|쓰|하|먹|보)|못|없|비이용|미구매|불참|미가입|비방문|비시청|비주문)/.test(
        item.input,
      )
    ) {
      errors.push(`negation-label-without-negation:${item.id}`);
    }
    if (item.clarificationExpected !== (item.expectedOutcome === "clarification")) {
      errors.push(`clarification-outcome-mismatch:${item.id}`);
    }
    if (
      item.tags.includes("multiple_targets") !==
      (item.expectedTargetCardinality === "multiple")
    ) {
      errors.push(`multiple-target-label-mismatch:${item.id}`);
    }
  }

  for (const [key, expected] of Object.entries(requiredStrata)) {
    const actual = byStratum[key] ?? 0;
    if (actual !== expected) errors.push(`stratum-count:${key}:${actual}:${expected}`);
  }

  const pairs: DatasetQualityReport["highSimilarityPairs"] = [];
  for (let left = 0; left < cases.length; left += 1) {
    for (let right = left + 1; right < cases.length; right += 1) {
      const similarity = trigramSimilarity(cases[left].input, cases[right].input);
      if (similarity >= 0.88) {
        pairs.push({
          left: cases[left].id,
          right: cases[right].id,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }
  }
  if (pairs.length > 0) {
    errors.push(...pairs.map((pair) =>
      `high-similarity:${pair.left}:${pair.right}:${pair.similarity}`,
    ));
  }

  const counts = {
    total: cases.length,
    dev: cases.filter((item) => item.split === "dev").length,
    holdout: cases.filter((item) => item.split === "holdout").length,
    standard: cases.filter((item) => item.surveyMode === "standard").length,
    research: cases.filter((item) => item.surveyMode === "research").length,
    clarification: tagCount(cases, "clarification"),
    negation: tagCount(cases, "negation"),
    timeframe: tagCount(cases, "timeframe"),
    virtualEntity: tagCount(cases, "virtual_entity"),
    nonUniversity: tagCount(cases, "non_university"),
    multipleTargets: tagCount(cases, "multiple_targets"),
    singleTargetMultiPurpose: tagCount(cases, "single_target_multi_purpose"),
    complexOrder: tagCount(cases, "complex_order"),
    noisyInput: tagCount(cases, "noisy_input"),
  };

  const exactCounts: Array<[keyof typeof counts, number]> = [
    ["total", 100],
    ["dev", 80],
    ["holdout", 20],
    ["research", 15],
    ["standard", 85],
    ["clarification", 8],
  ];
  for (const [name, expected] of exactCounts) {
    if (counts[name] !== expected) errors.push(`count:${name}:${counts[name]}:${expected}`);
  }
  const minimumCounts: Array<[keyof typeof counts, number]> = [
    ["negation", 20],
    ["timeframe", 15],
    ["virtualEntity", 20],
    ["nonUniversity", 20],
    ["multipleTargets", 10],
    ["singleTargetMultiPurpose", 15],
    ["complexOrder", 10],
    ["noisyInput", 10],
  ];
  for (const [name, minimum] of minimumCounts) {
    if (counts[name] < minimum) errors.push(`minimum:${name}:${counts[name]}:${minimum}`);
  }

  return { errors, warnings, counts, byCategory, byDifficulty, byStratum, highSimilarityPairs: pairs };
}

export function seededOrder<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((left, right) => {
    const l = createHash("sha256").update(`${seed}:${left.id}`).digest("hex");
    const r = createHash("sha256").update(`${seed}:${right.id}`).digest("hex");
    return l.localeCompare(r);
  });
}

export async function readRegressionDataset(path: string) {
  return surveyRegressionDatasetSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
}

export function mergeDatasets(...datasets: SurveyRegressionDataset[]) {
  return datasets.flatMap((dataset) => dataset.cases);
}
