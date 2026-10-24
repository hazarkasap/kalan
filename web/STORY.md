# Kalan story mode

## Play and record

- Open `/story`. Eight scenes autoplay for 90 seconds, then crossfade into `/`.
- Space: pause/play. Left/right arrows: previous/next scene. R: restart. Click a scene tick to seek. Seeking preserves pause state.
- `?scene=N` uses **1-based** scene numbers (1–8). Invalid values default to scene 1, numeric out-of-range values clamp.
- For screen capture, use a **1920×1080 browser content viewport at 100% zoom**, then click **Record layout (1080p)** in the story controls or open `/story?record=1`. The canvas is exactly 1920×1080, not a responsive approximation. Smaller recording viewports intentionally crop it, so use ordinary mode on phones.
- `/story?record=1&scene=5` starts at the auction for a pickup. Keyboard controls remain usable while controls and cursor are hidden. Story mode never mounts wallet UI. The dashboard handoff preserves `record=1` and hides its wallet/admin controls too.
- Backgrounding the tab freezes the visual clock rather than skipping scenes. Keep the tab foregrounded during recording.

## Files and retiming

- `src/story/scenes.ts`: the single scene-duration and caption configuration. Durations: 7, 10, 10, 12, 19, 10, 14, 8 seconds.
- `src/story/Story.tsx`: route presentation, playback clock, caption layer, and controls.
- `src/story/visuals.tsx`: persistent transform-based collateral bar, money counters, health meter, premium chart, and two timelines.
- `src/components/premiumGeometry.ts`: shared dashboard/story step geometry. The dashboard now starts the auction line at the flag and stops it at the winner, too.
- `src/story/storyData.ts`: one frozen, validated data model derived from captured on-chain evidence. Dollar amounts use integer cents and the displayed bonus is the rounding residual, so every displayed split reconciles.
- `src/story/evidence.json`: decoded logs, historical positions, block timestamps and verified receipts.

After changing captions or timing, run `npm run test:story`. Node 22.18+ or 24 is required for the dependency-free TypeScript scripts/tests. No animation/router/audio packages were added.

## Evidence and refresh

The story is deliberately pinned to the completed run captured from `src/lastRun.json` into `evidence.run`, not mixed with later bot runs, current mutable oracle prices or positions. The RPC capture verified all five bot receipts and read both historical positions at reset block **73816568**. Reset price: $3,000. Crash price: $2,300 at block **73816616**. Each comparison position: 1 WETH, $2,000 debt.

| Event | Block | Transaction |
| --- | --- | --- |
| Reset | 73816568 | `0x937867a3b5b179992e08af6f4c92024d070a9d570c3667cb1d6530ce0a28100c` |
| Crash | 73816616 | `0x3987e17386dab8fb777c14c198b096bf821a51db0999de65153f34daf9839284` |
| Fixed liquidation | 73816619 | `0x43d84f2ea2f19506ebd7f3d323beb5a5f7034f00cfe7dcd9d73335ce3177a83a` |
| Flag | 73816622 | `0x6204bf818328e3d5bb839ccb123cc8e1c90c8a18866345000755b8e41c58f63e` |
| Bot A wins | 73816625 | `0x1ab24d5c762e571ad5a64bb2f744024b22d53e8a092118a5388de48b43e34112` |
| Bot B reverts | 73816628 | `0x6d9c9391913cffb15a90edc73f0e14eb47b178f1d9d2a260dda03ef90c4f3a91` |
| Bot C reverts | 73816630 | `0xa43472b045ee8511ac028e9106559e614e2a5c761700919384406324843296ec` |

To refresh after deliberately changing the pinned run, run `npm run story:capture` (optional `RPC_URL` override), inspect the JSON, and rerun tests. This is read-only and uses the existing deployment addresses/ABIs. It requires historical state support. Failed receipt verification does not write a replacement. Tests intentionally pin this acceptance run's expected numbers so a different run requires reviewing the story, not silently changing a recording.

## Data limitations / honest deviations

1. **0.9 seconds is not an exact observed duration.** Blocks 73816622 and 73816623 have timestamp 1792845782. Blocks 73816624 and winning block 73816625 have timestamp 1792845783. The story shows **1 s in recorded timestamps**, explicitly with whole-second precision. The dashboard's `blockMs=310` hint would imply an estimate, not millisecond-resolution event timing.
2. **Ethereum is a counterfactual model**, not a second on-chain run: three steps × 12 seconds = 36 seconds, assuming no missed slots. Both timelines share the same time scale. Monad tick positions use actual timestamp differences, including overlapping timestamps. The timestamp list makes those overlaps explicit. Slot reference: `https://ethereum.org/developers/docs/consensus-mechanisms/pos/`.
3. **The falling price illustration is not measured price data.** This run uses an admin-controlled mock oracle with a recorded step from $3,000 to $2,300, not a real market feed. The illustration is explicitly labeled.
4. **“Usually 10%” was not established by this run.** The hook says “Here, 10%,” referring to the verified fixed-mode event. The fast-block caption avoids claiming the mechanism is impossible on every slower chain.
5. **No mass-liquidation scene.** There is no verified hundreds-of-positions run. “Alice” is a teaching persona for the two identically funded FIXED/FAIR demo positions; the actual collateral token is WETH.

## Validation

Run `npm run test:story`, `npm run build`, and `npm run lint`. Tests cover exact allocations, historical positions, receipt consistency, flag-based premium, timestamp precision, scene/cue boundaries, query parsing, and chart endpoints. Manual browser acceptance should also check autoplay, keyboard/tick seeking, recording canvas, mobile overflow, reduced motion, late bot markers, and dashboard crossfade. This is a testnet hackathon demonstration, not an audited lending product.
