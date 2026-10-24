import { money, percent, storyData as d } from './storyData.ts'

export type SceneId = 'hook' | 'loan' | 'crash' | 'fixed' | 'auction' | 'result' | 'monad' | 'outro'
export type Cue = { at: number; caption: string }
export type Scene = { id: SceneId; title: string; duration: number; cues: Cue[] }
// Seconds, relative to each scene. This is the sole timing source for playback.
export const scenes: Scene[] = [
  { id: 'hook', title: 'The cut', duration: 7, cues: [
    { at: 0, caption: `When a crypto loan is liquidated, someone takes a cut. Here, ${percent(d.fixed.premiumBps)}.` },
  ] },
  { id: 'loan', title: 'The loan', duration: 10, cues: [
    { at: 0, caption: `Alice deposits ${d.collateralEth} ETH (${money(d.initialTotal)}) and borrows ${money(d.debt)}.` },
  ] },
  { id: 'crash', title: 'The crash', duration: 10, cues: [
    { at: 0, caption: `ETH falls to ${money(d.priceAfter)}. Her loan is now unsafe.` },
  ] },
  { id: 'fixed', title: 'The fixed cut', duration: 12, cues: [
    { at: 0, caption: `Repay ${money(d.debt)}. Take a fixed ${percent(d.fixed.premiumBps)} bonus: ${money(d.fixed.bonus)}.` },
  ] },
  { id: 'auction', title: 'Let bots compete', duration: 19, cues: [
    { at: 0, caption: 'Kalan starts the bonus at 0% and raises it every block.' },
    { at: 6, caption: 'Bots compete. The first one to accept wins.' },
    { at: 12, caption: `Bot ${d.winner} takes it at ${percent(d.fair.premiumBps)}. The others arrive too late.` },
  ] },
  { id: 'result', title: 'The difference', duration: 10, cues: [
    { at: 0, caption: `Same loan, same crash. Alice keeps ${money(d.fair.keep)} instead of ${money(d.fixed.keep)}.` },
  ] },
  { id: 'monad', title: 'Why Monad', duration: 14, cues: [
    { at: 0, caption: 'Fast blocks let bots compete before the price moves again.' },
    { at: 5, caption: `Monad: ${d.elapsedSeconds} s in recorded timestamps. Ethereum model: ${d.blocks * d.ethereumStepSeconds} s.` },
  ] },
  { id: 'outro', title: 'Give back', duration: 8, cues: [
    { at: 0, caption: 'Kalan. Liquidations that give back.' },
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
