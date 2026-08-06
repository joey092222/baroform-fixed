import assert from "node:assert/strict";
import test from "node:test";
import {
  canApproveWorkspace,
  canManageWorkspace,
  isWorkspaceProjectStatus,
  isWorkspaceRole,
  isWorkspaceType,
  normalizeWorkspaceText,
  workspaceRoleLabel,
  workspaceStatusLabel,
  workspaceTypeLabel,
} from "../app/workspace";

test("협업 워크스페이스 유형과 역할을 제한된 값으로 구분한다", () => {
  assert.equal(isWorkspaceType("team"), true);
  assert.equal(isWorkspaceType("course"), true);
  assert.equal(isWorkspaceType("personal"), false);
  assert.equal(isWorkspaceRole("reviewer"), true);
  assert.equal(isWorkspaceRole("admin"), false);
  assert.equal(isWorkspaceProjectStatus("approved"), true);
  assert.equal(isWorkspaceProjectStatus("published"), false);
});

test("편집자와 검토자의 협업 권한을 서로 분리한다", () => {
  assert.equal(canManageWorkspace("owner"), true);
  assert.equal(canManageWorkspace("editor"), true);
  assert.equal(canManageWorkspace("reviewer"), false);
  assert.equal(canApproveWorkspace("owner"), true);
  assert.equal(canApproveWorkspace("reviewer"), true);
  assert.equal(canApproveWorkspace("editor"), false);
});

test("협업 화면의 유형·역할·진행 상태 라벨을 쉽게 읽히게 표시한다", () => {
  assert.equal(workspaceTypeLabel("course"), "수업 폴더");
  assert.equal(workspaceRoleLabel("reviewer"), "검토자");
  assert.equal(workspaceStatusLabel("review"), "검토 중");
  assert.equal(workspaceStatusLabel("approved"), "승인 완료");
  assert.equal(normalizeWorkspaceText("  소비자행동론   3조  ", 60), "소비자행동론 3조");
});
