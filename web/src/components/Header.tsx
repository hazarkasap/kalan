type HeaderProps = {
  price: number
}

export function Header({ price }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <h1>Kalan</h1>
        <p className="subtitle">Liquidations that give back</p>
      </div>
      <p className="eth-price">
        <span className="eth-price-label">ETH</span>
        <span className="eth-price-value">${price.toLocaleString('en-US')}</span>
      </p>
    </header>
  )
}
