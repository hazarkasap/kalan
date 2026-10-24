export function usd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function pct(bps: number | null | undefined, digits = 1): string {
  if (bps == null) return '—'
  return `${(bps / 100).toFixed(digits)}%`
}

export function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function seconds(s: number): string {
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`
}
