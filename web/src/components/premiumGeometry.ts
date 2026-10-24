/** Shared SVG step geometry. Both dashboard and story start at the flag, never the crash. */
export function premiumStepPath(from: number, to: number, x: (block: number) => number, y: (block: number) => number) {
  if (to < from) return ''
  let path = `M${x(from)},${y(from)}`
  for (let block = from + 1; block <= to; block++) path += `H${x(block)}V${y(block)}`
  return path
}
