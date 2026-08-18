import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  datasetGeneratedAt,
  devCases,
  devSeed,
  holdoutCases,
  holdoutSeed,
} from "./dataset-source";
import { seededOrder, validateDatasetQuality } from "./dataset-utils";
import { surveyRegressionDatasetSchema } from "./schema";

const directory = dirname(fileURLToPath(import.meta.url));
const dev = surveyRegressionDatasetSchema.parse({
  version: "v1",
  split: "dev",
  seed: devSeed,
  generatedAt: datasetGeneratedAt,
  cases: seededOrder(devCases, devSeed),
});
const holdout = surveyRegressionDatasetSchema.parse({
  version: "v1",
  split: "holdout",
  seed: holdoutSeed,
  generatedAt: datasetGeneratedAt,
  cases: seededOrder(holdoutCases, holdoutSeed),
});

const report = validateDatasetQuality([...dev.cases, ...holdout.cases]);
if (report.errors.length > 0) {
  throw new Error(`DATASET_QUALITY_INVALID\n${report.errors.join("\n")}`);
}

await Promise.all([
  writeFile(join(directory, "dev.json"), `${JSON.stringify(dev, null, 2)}\n`, "utf8"),
  writeFile(join(directory, "holdout.json"), `${JSON.stringify(holdout, null, 2)}\n`, "utf8"),
]);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
