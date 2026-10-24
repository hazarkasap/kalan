type BigNumberProps = {
  children: string
  accent?: boolean
}

export function BigNumber({ children, accent = false }: BigNumberProps) {
  return <p className={accent ? 'big-number accent' : 'big-number'}>{children}</p>
}
