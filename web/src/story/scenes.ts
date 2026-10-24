import { money, percent, storyData as d } from './storyData.ts'

export type SceneId = 'hook' | 'loan' | 'crash' | 'fixed' | 'auction' | 'result' | 'monad' | 'outro'
export type Cue = { at: number; caption: string; voiceover: string }
export type Scene = { id: SceneId; title: string; duration: number; cues: Cue[] }
// Seconds, relative to each scene. This is the sole timing source for playback and narration.
export const scenes: Scene[] = [
  { id: 'hook', title: 'The cut', duration: 7, cues: [
    { at: 0, caption: `When a crypto loan is liquidated, someone takes a cut. Here, ${percent(d.fixed.premiumBps)}.`, voiceover: 'When a crypto loan is liquidated, someone takes a cut. Kalan asks: how much is enough?' },
  ] },
  { id: 'loan', title: 'The loan', duration: 10, cues: [
    { at: 0, caption: `Alice deposits ${d.collateralEth} ETH (${money(d.initialTotal)}) and borrows ${money(d.debt)}.`, voiceover: `Meet Alice. She deposits ${d.collateralEth} Ether, worth ${money(d.initialTotal)}, to borrow ${money(d.debt)}. Her crypto backs the loan. For now, there is enough.` },
  ] },
  { id: 'crash', title: 'The crash', duration: 10, cues: [
    { at: 0, caption: `ETH falls to ${money(d.priceAfter)}. Her loan is now unsafe.`, voiceover: `Then Ether falls to ${money(d.priceAfter)}. Alice's loan is now unsafe. A liquidator must repay her debt, taking some collateral as a reward.` },
  ] },
  { id: 'fixed', title: 'The fixed cut', duration: 12, cues: [
    { at: 0, caption: `Repay ${money(d.debt)}. Take a fixed ${percent(d.fixed.premiumBps)} bonus: ${money(d.fixed.bonus)}.`, voiceover: `With a fixed ${percent(d.fixed.premiumBps)} bonus, the liquidator repays ${money(d.debt)} and takes another ${money(d.fixed.bonus)}. Alice keeps just ${money(d.fixed.keep)}. But what if someone would do it for less?` },
  ] },
  { id: 'auction', title: 'Let bots compete', duration: 19, cues: [
    { at: 0, caption: 'Kalan starts the bonus at 0% and raises it every block.', voiceover: 'Kalan starts the bonus at zero and raises it with each new block.' },
    { at: 6, caption: 'Bots compete. The first one to accept wins.', voiceover: 'Bots compete to repay the loan. The first one to accept the reward wins.' },
    { at: 12, caption: `Bot ${d.winner} takes it at ${percent(d.fair.premiumBps)}. The others arrive too late.`, voiceover: `Bot ${d.winner} accepts at ${percent(d.fair.premiumBps)}. The other bots arrive too late. Their transactions revert.` },
  ] },
  { id: 'result', title: 'The difference', duration: 10, cues: [
    { at: 0, caption: `Same loan, same crash. Alice keeps ${money(d.fair.keep)} instead of ${money(d.fixed.keep)}.`, voiceover: `Same loan, same crash. Alice keeps ${money(d.fair.keep)} instead of ${money(d.fixed.keep)}. That's ${(d.fair.keep / d.fixed.keep).toFixed(1)} times as much. The liquidator still earns ${money(d.fair.bonus)}.` },
  ] },
  { id: 'monad', title: 'Why Monad', duration: 14, cues: [
    { at: 0, caption: 'Fast blocks let bots compete before the price moves again.', voiceover: 'Fast blocks make this practical. This Monad run took three blocks.' },
    { at: 5, caption: `Monad: ${d.elapsedSeconds} s in recorded timestamps. Ethereum model: ${d.blocks * d.ethereumStepSeconds} s.`, voiceover: `Recorded timestamps differ by ${d.elapsedSeconds} second. At twelve seconds per step, an Ethereum model takes ${d.blocks * d.ethereumStepSeconds} seconds. Meanwhile, market prices can keep falling.` },
  ] },
  { id: 'outro', title: 'Give back', duration: 8, cues: [
    { at: 0, caption: 'Kalan. Liquidations that give back.', voiceover: 'A smaller cut. More left for the borrower. Kalan. Liquidations that give back. Now, watch it live.' },
  ] },
]
export const duration = scenes.reduce((sum, s) => sum + s.duration, 0)
export const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((sum, s) => sum + s.duration, 0))
export function sceneAt(seconds: number) {
  let index = starts.findLastIndex(start => start <= seconds)
  index = Math.max(0, index)
  const scene = scenes[index]
  const local = Math.max(0, seconds - starts[index])
  const cueIndex = Math.max(0, scene.cues.findLastIndex(cue => cue.at <= local))
  return { index, scene, local, cueIndex, cue: scene.cues[cueIndex] }
}
export function initialTime(search: string) {
  const requested = Number(new URLSearchParams(search).get('scene') ?? 1)
  const index = Number.isFinite(requested) ? Math.min(scenes.length, Math.max(1, Math.trunc(requested))) - 1 : 0
  return starts[index]
}
