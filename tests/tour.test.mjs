import assert from "node:assert/strict"
import test from "node:test"
import { placeTourCard } from "../src/tour.ts"

const card = { width: 320, height: 200 }
const desktop = { width: 1440, height: 900 }
const phone = { width: 390, height: 844 }

test("tour card centres itself when a step has no target", () => {
  assert.deepEqual(placeTourCard(undefined, card, desktop), { x: 560, y: 350 })
})

test("tour card prefers the space below the target, kept inside the window", () => {
  assert.deepEqual(placeTourCard({ x: 1380, y: 10, width: 40, height: 30 }, card, desktop), { x: 1104, y: 52 })
})

test("tour card goes above, then beside the target when there is no room below", () => {
  assert.deepEqual(placeTourCard({ x: 100, y: 600, width: 200, height: 280 }, card, desktop), { x: 40, y: 388 })
  assert.deepEqual(placeTourCard({ x: 248, y: 100, width: 830, height: 780 }, card, desktop), { x: 1090, y: 390 })
  assert.deepEqual(placeTourCard({ x: 1076, y: 50, width: 364, height: 850 }, card, desktop), { x: 744, y: 375 })
})

test("tour card sits at the far end of the screen when the target fills it", () => {
  assert.deepEqual(placeTourCard({ x: 0, y: 50, width: 390, height: 650 }, card, phone), { x: 35, y: 628 })
  assert.deepEqual(placeTourCard({ x: 0, y: 150, width: 390, height: 694 }, card, phone), { x: 35, y: 16 })
})
