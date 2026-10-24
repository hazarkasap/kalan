# Naol — Agent Task Files

You own `web/`, `README.md` and the video. Hazar owns `contracts/` and `bot/` — never send an agent there.
The only shared surface is the interface contract in `SPEC.md` (sections "ABI ayrıntısı" and "Arayüz sözleşmesi").

## Order

| File | Time | Tool | Output |
| --- | --- | --- | --- |
| [N0-setup.md](N0-setup.md) | 12:30–12:45 | Cursor | Vite app in `web/`, mock data layer |
| [N1-skeleton.md](N1-skeleton.md) | 12:45–13:15 | Cursor | Two panels + button + counter on mock |
| [N2-wire.md](N2-wire.md) | 13:15–14:00 | Codex + Cursor | Real addresses, event reading, explorer links; contract review |
| [N3-polish.md](N3-polish.md) | 14:00–15:15 | Cursor | Big number, winner bot, admin buttons, live deploy |
| [N4-ship.md](N4-ship.md) | 15:15–16:30 | ChatGPT + Cursor | README, video script, submission |

## How to use these files

1. Open a **new** agent session per task file (keeps context small).
2. Paste the **Context block** below first, then the task's prompt.
3. Check the "Done when" list yourself before committing. Commit + push at least every 30 minutes.
4. If the agent proposes anything outside SPEC (partial liquidation, real oracle, multiple assets, a backend/DB, Next.js) — reject it.

## Context block (paste at the start of every session)

```text
You are working in the repo "kalan" (Monad Blitz Ankara hackathon, 4-hour build).
Read AGENTS.md and SPEC.md first (they are in Turkish; translate for yourself). Rules:
- You may ONLY create or edit files inside web/ and README.md. Never touch contracts/, bot/, SPEC.md, AGENTS.md.
- Exception: web/src/deployments.json and web/src/abi/*.json are written by Hazar; read them, never edit them.
- Stack: Vite + React + TypeScript + viem. wagmi only for wallet connection. No Next.js, no backend, no database.
- Chain: Monad testnet, chainId 10143. All numbers come from contract reads and events.
- Do not add features outside SPEC.md. Keep changes small; tell me which files you changed.
Product in one line: on liquidation, the premium starts at 0% and rises 0.5% per block (cap 10%);
first profitable bot takes it and the rest goes back to the borrower: borrower keeps $270 instead of $100.
```
