import assert from "node:assert/strict"
import test from "node:test"
import { IniDocument } from "../src/ini.ts"

test("maps each compound foreground property to the section that actually provides it", async () => {
  const module = await import("../src/style-properties.ts").catch(() => ({})) as {
    resolveStylePropertySources?: (
      document: IniDocument,
      foregrounds: string[],
      property: string,
    ) => Array<{ section: string; value: string }> | undefined
  }
  assert.equal(typeof module.resolveStylePropertySources, "function")

  const styles = IniDocument.parse(`
[STYLE703]
NM_COLOR=ff102030

[STYLE7]
FONT_NAME=.SFUIDisplay-Regular
FONT_SIZE=36

[STYLE704]
FONT_WEIGHT=550

[STYLE705]
FONT_WEIGHT=650
`)

  assert.deepEqual(
    module.resolveStylePropertySources?.(styles, ["703,704"], "FONT_NAME"),
    [{ section: "STYLE7", value: ".SFUIDisplay-Regular" }],
  )
  assert.deepEqual(
    module.resolveStylePropertySources?.(styles, ["703,704"], "FONT_WEIGHT"),
    [{ section: "STYLE704", value: "550" }],
  )
  assert.deepEqual(
    module.resolveStylePropertySources?.(styles, ["703,704"], "NM_COLOR"),
    [{ section: "STYLE703", value: "ff102030" }],
  )
  assert.deepEqual(
    module.resolveStylePropertySources?.(styles, ["703,704", "703,705"], "FONT_WEIGHT"),
    [
      { section: "STYLE704", value: "550" },
      { section: "STYLE705", value: "650" },
    ],
  )
})
