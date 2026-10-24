# H0 — Kurulum (12:30–12:45) · elle

```sh
cd ~/agent-workspace/projects/kalan
forge init --template monad-developers/foundry-monad contracts --no-git   # Foundry v1.8+
cd contracts && forge build
cast wallet import deployer --interactive        # admin/deployer keystore
cast wallet new; cast wallet new; cast wallet new  # bot A/B/C -> ../.env (BOT_A_PK...)
cast wallet new; cast wallet new                   # borrowerFixed, borrowerFair (yalnız adres gerekir)
```

- Deployer + 3 bot: faucet.monad.xyz ile fonla. Botlarda EIP-7702 delegasyon yok.
- `.env` kökte, gitignore'da. `git status` ile kontrol et.
- 12:45: SPEC "ABI ayrıntısı" Naol ile teyit → sabit.
- Commit: `contracts: foundry-monad scaffold`
