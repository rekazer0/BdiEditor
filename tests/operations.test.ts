import assert from "node:assert/strict"
import test from "node:test"
import { operationError } from "../src/operations.ts"

test("file operation errors include the action and useful detail", () => {
  assert.equal(operationError("打开", new Error("文件已损坏")), "打开失败：文件已损坏")
  assert.equal(operationError("保存", "没有写入权限"), "保存失败：没有写入权限")
  assert.equal(operationError("新建", null), "新建失败：未知错误")
})
