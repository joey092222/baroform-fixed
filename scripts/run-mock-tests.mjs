import { spawnSync } from "node:child_process";

const patterns = process.argv.slice(2);
const testPatterns = patterns.length > 0 ? patterns : ["tests/*.test.ts"];
const osUserInfoShim =
  "data:text/javascript,import os from 'node:os';try{os.userInfo()}catch{os.userInfo=()=>({username:'codex'})}";
const result = spawnSync(
  process.execPath,
  ["--import", osUserInfoShim, "--import", "tsx", "--test", ...testPatterns],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      NODE_ENV: "test",
      AI_MOCK_MODE: process.env.AI_MOCK_MODE ?? "false",
      RUN_REAL_AI_TESTS: "false",
      BAROFORM_ALLOW_LIVE_AI_TESTS: "false",
      ALLOW_REAL_OPENAI_IN_NON_PRODUCTION: "false",
    },
  },
);

process.exit(result.status ?? 1);
