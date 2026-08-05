import assert from "node:assert/strict"
import test from "node:test"
import { loadBuiltInProjectTemplate, operationError } from "../src/operations.ts"

test("file operation errors include the action and useful detail", () => {
  assert.equal(operationError("打开", new Error("文件已损坏")), "打开失败：文件已损坏")
  assert.equal(operationError("保存", "没有写入权限"), "保存失败：没有写入权限")
  assert.equal(operationError("新建", null), "新建失败：未知错误")
})

test("loads only the selected built-in project template", async () => {
  const requested: string[] = []
  const bytes = await loadBuiltInProjectTemplate("default-ios", async (path) => {
    requested.push(path)
    return {
      ok: true,
      async arrayBuffer() {
        return Uint8Array.from([1, 2, 3]).buffer
      },
    }
  })

  assert.deepEqual(requested, ["/default-template.bdi"])
  assert.deepEqual(bytes, Uint8Array.from([1, 2, 3]))
  await assert.rejects(
    () =>
      loadBuiltInProjectTemplate("default-ios", async () => ({
        ok: false,
        async arrayBuffer() {
          return new ArrayBuffer(0)
        },
      })),
    /无法加载内置默认皮肤模板/,
  )
  await assert.rejects(
    () => loadBuiltInProjectTemplate("missing"),
    /未知的内置项目模板/,
  )
})
