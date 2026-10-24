# N4 — README, video, submission (15:15–16:30) · ChatGPT + Cursor

## Prompt A — ChatGPT: 90-second voiceover

```text
Write a 90-second voiceover (about 220 words, English) for a hackathon demo video. Product: "Kalan —
liquidations that give back", built on Monad testnet. Structure:
0–12s: Alice has 1 ETH collateral and a $2,000 loan; on liquidation she loses a fixed 10% bonus to the liquidator.
12–25s: a fair auction takes ~36 s on Ethereum (12 s blocks) but ~1 s on Monad.
25–65s: "Market crash" → two panels: fixed bonus leaves her $100, Kalan's per-block rising premium leaves her $270; bot A wins at 1.5%.
65–75s: explorer: every step is a real Monad testnet transaction, settled in 3 blocks.
75–90s: honest limits: "We trigger the price crash with our own oracle and the liquidators are our own bots.
In production this would use a real oracle and partial liquidations."
Plain, confident tone, short sentences.
```

Use Hazar's measured block time instead of "~1 s" if different.

## Prompt B — Cursor: README

```text
Rewrite README.md (keep Hazar's "Technical" section untouched if present). Sections:
What it is (2 lines + the $100 vs $270 table) · Why Monad · Live demo (Vercel URL) · How it works
(flag → per-block premium → liquidate) · Contracts (addresses + explorer links from web/src/deployments.json)
· Demo transactions (Hazar's backup hashes) · What is simulated (oracle + bots are ours) · Run locally
(cd web && npm i && npm run dev) · Team (Hazar — contracts & bots, Naol — UI & video).
```

## Prompt C — ChatGPT: judge Q&A rehearsal

```text
Act as a hackathon judge. Ask me 6 hard questions about a liquidation design where the premium starts
at 0% and rises 0.5% per block to a 10% cap (e.g. "isn't this just Maker's Dutch auction?",
"what if no liquidator shows up?", "what if the price keeps falling during the auction?",
"why Monad and not a cheap L2?"). After each answer, give a one-line better answer.
```

## Submission checklist

- [ ] Contracts verified, addresses in README
- [ ] Public repo, commit history after 12:00
- [ ] Vercel link opens without admin and shows the last run
- [ ] Measured block time matches the number in the video
- [ ] Video says "the oracle and bots are ours"
- [ ] No `.env` in repo
- [ ] Submitted at blitz.devnads.com before 16:30
