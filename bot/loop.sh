#!/usr/bin/env bash
# Sunum modu: run.ts her yarıştan sonra çıkar; bu döngü onu hemen yeniden başlatır.
# Böylece Reset demo → Crash price arasında botu elle başlatmak gerekmez. Durdurmak: Ctrl+C.
cd "$(dirname "$0")"
trap 'exit 0' INT TERM
while true; do
  node node_modules/.bin/tsx run.ts
  sleep 1
done
