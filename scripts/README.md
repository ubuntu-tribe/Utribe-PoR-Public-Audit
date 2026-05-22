# Verification scripts

Pure-Python scripts that reproduce the on-chain verifications described in
[Ubuntu Tribe's $GIFT Proof-of-Reserves Auditor Reference](
https://github.com/mrrfid/cait/blob/main/documents/utribe/audits/$GIFT-PoR/PoR-Auditor-Reference-v2026-05-21.1.pdf
) without any uTribe-side dependency. Every call is read-only `eth_call`.

## `verify_kyc.py`

Read-only KYC verification against the $GIFT `ComplianceRegistry` contract
(`0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415`) on Polygon Mainnet.

For each wallet in an input list, the script records:

- `accounts(address)` → `(whitelisted, kycLevel, frozen, dailySpent,
  monthlySpent, yearlySpent, lastDayReset, lastMonthReset, lastYearReset)`
- `canTransact(address, 0, kycLevel)` → `(allowed, reason)`

and produces a dated JSON evidence fixture.

### Quick start

```bash
# 1. Tell the script which Polygon RPC to use.
echo 'VITE_RPC_URL=https://polygon-bor-rpc.publicnode.com' > .env

# 2. Put the wallet addresses you want to verify into a numbered list.
#    The Appendix A format from the PoR Auditor Reference PDF is parsed as-is.
cat > wallets.md <<'EOF'
1. `0x6dd6F358B48bD6af2BA27D8DbeC7368c301B3884`
2. `0x189bF5956e6fD04914E40E8134c61d881B2bfff0`
...
EOF

# 3. Run.
python3 scripts/verify_kyc.py --wallets wallets.md
```

The optional `--rpc-only` flag does a single sanity probe
(`chainId` + `blockNumber`) and exits — useful for confirming the RPC is
healthy before running against the full wallet list.

### Dependencies

Pure Python standard library. Optionally accelerated by
[`pycryptodome`](https://pycryptodome.readthedocs.io/) (`pip install
pycryptodome`) for faster Keccak-256; falls back to a pure-Python Keccak
implementation when not installed.

### What this is *not*

This script does **not** verify that the off-chain customer database
labelled a wallet as "KYC verified" — that's a separate workstream audited
by HT Digital. It verifies only that the on-chain `ComplianceRegistry` state
for each wallet matches the profile uTribe claims.
