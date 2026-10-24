import test from 'node:test'
import assert from 'node:assert/strict'
import { money, percent, ratio, storyData as d } from '../src/story/storyData.ts'
import { duration, initialTime, sceneAt, scenes, starts } from '../src/story/scenes.ts'
import { premiumStepPath } from '../src/components/premiumGeometry.ts'
import evidence from '../src/story/evidence.json' with { type: 'json' }
const lastRun = evidence.run

test('each displayed allocation adds up in exact cents', () => {
  for (const side of [d.fixed, d.fair]) {
    assert.equal(d.debt + side.bonus + side.keep, d.total)
    assert.ok(side.keep > 0 && side.bonus > 0)
    assert.equal(side.bonus, d.debt * side.premiumBps / 10000)
  }
  assert.equal(money(d.fixed.keep), '$100')
  assert.equal(money(d.fair.keep), '$270')
  assert.equal(ratio, '2.7')
})
test('collateral/debt originate in historical matching positions', () => {
  assert.deepEqual(evidence.positions.fixed.slice(0, 2), evidence.positions.fair.slice(0, 2))
  const collateral = BigInt(evidence.positions.fair[0])
  for (const e of evidence.events.filter(e => e.event === 'Liquidated')) {
    assert.equal(BigInt(e.args.toLiquidator!) + BigInt(e.args.toBorrower!), collateral)
  }
  assert.equal(d.initialTotal, 300000)
  assert.equal(d.total, 230000)
  assert.equal(d.debt, 200000)
})
test('every bot receipt is from the same dashboard run', () => {
  assert.equal(d.attempts.length, 3)
  for (const a of d.attempts) {
    assert.ok(lastRun.transactions.some(t => t.tx === a.hash && Number(t.block) === a.block && t.status === a.status))
    assert.ok(evidence.receipts.some(r => r.hash === a.hash && Number(r.block) === a.block && r.status === a.status))
  }
  assert.equal(d.attempts.filter(a => a.won).length, 1)
  assert.ok(d.attempts.filter(a => !a.won).every(a => a.status === 'reverted' && a.block > d.winBlock))
})
test('auction premium is based on flag, not crash', () => {
  assert.equal(d.fair.premiumBps, d.blocks * d.stepBps)
  assert.equal(percent(d.fair.premiumBps), '1.5%')
  assert.equal(d.blocks, 3)
})
test('timestamp precision is not invented or interpolated', () => {
  assert.equal(d.elapsedSeconds, d.blockTimes.at(-1)!.timestamp - d.blockTimes[0].timestamp)
  assert.equal(d.elapsedSeconds, 1)
  assert.deepEqual(d.blockTimes.map(b => b.timestamp - d.blockTimes[0].timestamp), [0, 0, 1, 1])
  assert.equal(d.blocks * d.ethereumStepSeconds, 36)
})
test('eight scenes total 90 seconds with continuous boundaries', () => {
  assert.equal(duration, 90)
  assert.equal(scenes.length, 8)
  assert.deepEqual(starts, [0, 7, 17, 27, 39, 58, 68, 82])
  starts.forEach((start, i) => {
    assert.equal(sceneAt(start).index, i)
    if (i) assert.equal(sceneAt(start - .001).index, i - 1)
  })
  assert.equal(sceneAt(90).scene.id, 'outro')
})
test('scene query handles invalid, fractional and out-of-range values', () => {
  for (const [query, expected] of [['', 0], ['?scene=6', 58], ['?scene=99', 82], ['?scene=-3', 0], ['?scene=NaN', 0], ['?scene=Infinity', 0], ['?scene=2.5', 7]] as const) assert.equal(initialTime(query), expected)
})
test('captions remain short and cues fit their configured scenes', () => {
  for (const scene of scenes) {
    assert.equal(scene.cues[0].at, 0)
    for (const cue of scene.cues) {
      assert.ok(cue.at < scene.duration)
      assert.ok(cue.caption.split(/\s+/).length <= 14, cue.caption)
    }
  }
})
test('chart geometry starts exactly at flag and stops exactly at winner', () => {
  const path = premiumStepPath(d.flagBlock, d.winBlock, b => b - d.flagBlock, b => (b - d.flagBlock) * d.stepBps)
  assert.equal(path, 'M0,0H1V50H2V100H3V150')
  assert.equal(premiumStepPath(10, 9, n => n, n => n), '')
})
