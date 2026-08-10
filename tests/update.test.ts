import assert from "node:assert/strict"
import test from "node:test"
import { checkForUpdate, compareVersions } from "../src/update.ts"

test("compares GitHub release versions numerically", () => {
  assert.equal(compareVersions("v0.5.10", "0.5.9"), 1)
  assert.equal(compareVersions("0.5.5", "v0.5.5"), 0)
  assert.equal(compareVersions("0.5.4", "0.5.5"), -1)
})

test("reports a newer GitHub release with its download page", async () => {
  const result = await checkForUpdate("0.5.10", async () => new Response(
    '<a href="/rekazer0/BdiEditor/releases/tag/v0.5.4">v0.5.4</a>' +
    '<a href="/rekazer0/BdiEditor/releases/tag/v0.5.11">v0.5.11</a>',
    { status: 200 },
  ))

  assert.deepEqual(result, {
    status: "available",
    currentVersion: "0.5.10",
    latestVersion: "0.5.11",
    url: "https://github.com/rekazer0/BdiEditor/releases/tag/v0.5.11",
  })
})

test("reports the installed release as current", async () => {
  const result = await checkForUpdate("0.5.10", async () => new Response(
    '<a href="/rekazer0/BdiEditor/releases/tag/v0.5.10">v0.5.10</a>',
    { status: 200 },
  ))

  assert.equal(result.status, "latest")
})
