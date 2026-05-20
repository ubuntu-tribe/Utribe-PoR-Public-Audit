# Ubuntu Tribe — Proof of Reserve (Public Audit)

A public, read-only application for **independently verifying** Ubuntu Tribe's
gold- (and silver-) backed token reserves directly on Polygon mainnet.

- **Users** can verify the live reserve ↔ supply ratio without trusting any
  off-chain service.
- **Auditors** with the on-chain `AUDITOR_ROLE` can submit and verify
  attestations from their wallet.

The web app is a thin client: every figure shown is derived from a public
`eth_call` against the deployed contracts. No backend is required for
verification.

## Status

🚧 **Bootstrap.** The audit app is being built. The on-chain contracts are
deployed and operational on Polygon mainnet (see [docs/on-chain-reference.md](docs/on-chain-reference.md)).

## Quick verification (no app required)

```bash
# 1. GIFT total supply (18 decimals)
cast call 0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea \
  "totalSupply()(uint256)" \
  --rpc-url https://polygon-rpc.com

# 2. Vault count on the V2 PoR proxy
cast call 0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e \
  "vaultCount()(uint256)" \
  --rpc-url https://polygon-rpc.com

# 3. List supported metals (returns bytes32[]: keccak256 of each symbol)
cast call 0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e \
  "supportedMetals()(bytes32[])" \
  --rpc-url https://polygon-rpc.com
```

For the full set of read functions, addresses, events, and end-to-end
verification recipes, see **[`docs/on-chain-reference.md`](docs/on-chain-reference.md)**.

## Contracts

| Contract                  | Address (Polygon)                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------|
| GIFT Token                | [`0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea`](https://polygonscan.com/address/0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea) |
| TaaSMultiMetalPoR (proxy) | [`0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e`](https://polygonscan.com/address/0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e) |
| VGIFT1155MintController   | [`0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9`](https://polygonscan.com/address/0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9) |

## License

TBD.
