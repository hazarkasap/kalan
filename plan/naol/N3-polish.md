# N3 — Polish + admin (14:00–15:15) · Cursor

**Goal:** the screen that goes into the video. Big readable numbers, clear winner, admin-only controls.

## Prompt A — admin controls

```text
Add wallet connection with wagmi (injected connector only, chain monadTestnet).
Read admin() from FairLend. Show "Market crash" and "Reset demo" buttons ONLY when the connected
address equals admin(). Market crash -> oracle.setPrice(2300n * 10n**18n). Reset -> fairLend.resetDemo().
Wait for the receipt and show the tx link. Non-admin visitors see a read-only "Last run" view.
Never embed a private key anywhere in web/.
```

## Prompt B — visual polish

```text
Polish App for a 1080p screen recording:
- "Borrower keeps $270" vs "$100" are the largest elements on screen (≥ 96px), right one in the accent colour.
- Animate the right-panel premium counter per block (0.0% → 0.5% → 1.0% → 1.5%) with the block number beside it.
- Winner card: "Bot A won at 1.5% in block N" ; show B and C as "reverted" if they attempted.
- A small strip under the panels: "Settled in 3 blocks ≈ T s" using the measured block time
  (constant BLOCK_MS in one place; Hazar will give the number).
- No layout jump when values change (fixed widths, tabular numbers).
```

## Done when

- [ ] Admin buttons appear only for the admin wallet
- [ ] A non-admin incognito visit shows the last run
- [ ] Commit + push `web: polish + admin controls` (Vercel auto-deploys)
- [ ] 15:15 — code freeze, bug fixes only
