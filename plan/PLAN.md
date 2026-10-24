# Kalan — Parallel Work Plan (Oct 24, 2026)

Two tracks run in parallel and meet only at the **interface contract** (`SPEC.md` → "ABI ayrıntısı"
and "Arayüz sözleşmesi"). Naol never waits for Hazar: the UI is built against a mock until 13:15.

| | Hazar — Chain | Naol — Screen & pitch |
| --- | --- | --- |
| Owns | `contracts/`, `bot/` | `web/`, `README.md`, video |
| Agents | Claude Code (contracts, debugging), OpenCode (scripts, bot, README tech) | Cursor (UI), Codex (big UI pieces + contract review), ChatGPT (script, README text, Q&A) |
| Task files | `plan/hazar/` | `plan/naol/` |

## Timeline

| Time | Hazar | Naol | Sync / handoff |
| --- | --- | --- | --- |
| 12:30–12:45 | H0: Foundry init, wallets funded | N0: Vite app in `web/`, mock data | **12:45 ABI frozen** (SPEC) |
| 12:45–13:15 | H1: contracts + 3 tests → deploy → verify | N1: two-panel skeleton on mock, Vercel empty deploy | **13:15** `web/src/deployments.json` + `web/src/abi/*.json` pushed by Hazar |
| 13:15–14:00 | H2: `bot/run.ts` (3 bots, local premium) | N2: wire real addresses, read events, explorer links · Codex reviews `FairLend.sol` | **14:00** first end-to-end liquidation visible on screen |
| 14:00–15:15 | H3: `resetDemo` flow, rehearsal, 100-block timing | N3: polish (big number, winner bot), admin buttons, live deploy | **15:15 code freeze** |
| 15:15–16:30 | H4: backup tx hashes, README tech section | N4: README, video edit + voiceover, submission form | **16:30 submit** |

At every sync point: 5-minute stand-up, then apply the cut rules below.

## Handoff artifacts

| From → To | File | When |
| --- | --- | --- |
| Hazar → Naol | `web/src/deployments.json`, `web/src/abi/{FairLend,AdminOracle}.json` | 13:15 (only files Hazar touches in `web/`) |
| Hazar → Naol | Measured block time (ms), backup tx hashes | 15:00 |
| Naol → Hazar | Vercel URL | 13:15 |
| Naol → Hazar | `FairLend.sol` review findings from Codex | 13:45 |

## Cut rules

| Check | If not done | Decision |
| --- | --- | --- |
| 13:15 | Contracts not on testnet | Skip verification for now; re-run deploy script for each take instead of `resetDemo` |
| 14:00 | Bot race not working | Single bot (A); B and C mentioned in video only |
| 14:30 | UI can't read events | Video = explorer tab + terminal output; UI shows numbers only |
| 15:15 | Anything | Freeze; bug fixes only |

## Git rules

- One repo, one `main`. Pull before push (`git pull --rebase`). Commit at least every 30 minutes.
- Stay in your own folders. `.env` never committed.
