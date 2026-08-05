import assert from "node:assert/strict"
import test from "node:test"
import { sourceFolderDescription } from "../src/source-tree.ts"

test("describes common skin source folders", () => {
  assert.equal(sourceFolderDescription("light"), "浅色主题")
  assert.equal(sourceFolderDescription("dark/skin/port"), "竖屏布局与组件")
  assert.equal(sourceFolderDescription("light/skin/res"), "共享图片、图集与样式")
  assert.equal(sourceFolderDescription("light/skin/res/logo"), "输入法工具栏资源")
})
