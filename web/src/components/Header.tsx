type HeaderProps = {
  price: number
  connecting?: boolean
}

export function Header({ price, connecting = false }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <h1>Kalan</h1>
        <p className="subtitle">Liquidations that give back</p>
      </div>
      <p className="eth-price">
        <span className="eth-price-label">ETH</span>
        <span className="eth-price-value">
          {connecting || price === 0 ? '—' : `$${price.toLocaleString('en-US')}`}
        </span>
      </p>
    </header>
  )
}
