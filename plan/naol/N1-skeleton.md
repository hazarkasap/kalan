# N1 — Skeleton on mock (12:45–13:15) · Cursor

**Goal:** the demo screen exists end-to-end on mock data and has a public Vercel URL.

## Prompt

```text
Using web/src/data.ts (useRun, triggerMockCrash), build the single demo page in web/src/App.tsx:

Layout (desktop 1920x1080 first, must not break on mobile):
- Header: "Kalan" + subtitle "Liquidations that give back". Current ETH price, large.
- Button "Market crash" -> calls triggerMockCrash() (later: admin setPrice(2300e18)).
- Two side-by-side panels:
  Left  "Fixed bonus (10%)"   — data from run.fixed
  Right "Kalan (fair auction)" — data from run.fair
  Each panel shows: collateral (1 WETH), debt ($2,000), status (Healthy / Liquidatable / Liquidated),
  current premium in % (right panel ticks up block by block), and once liquidated:
  winner bot (A/B/C), premium paid, "Borrower keeps $X" as the BIGGEST text in the panel,
  and a "view tx" link (explorer helper from chain.ts).
- Footer row: "Blocks to settle: N · ~T s" for the right panel.

Style: plain CSS (no UI library), dark background, one accent colour, a monospaced font for numbers.
Keep components small: Header, CrashButton, Panel, BigNumber. No routing.
```

## Deploy

Hazar owns Vercel (project imported from `hazarkasap/kalan`, root `web`). Every push to `main` deploys
automatically — just push. Need an env var changed? Ask Hazar.

## Done when

- [ ] Clicking "Market crash" shows left panel $100, right panel premium ticking then $270
- [ ] Pushed; Vercel auto-deploy succeeded (URL from Hazar)
- [ ] Commit + push: `web: demo layout on mock`
