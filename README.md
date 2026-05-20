# Ubuntu Tribe — Proof of Reserve (Public Audit)

A public, read-only application for **independently verifying** Ubuntu Tribe's
gold- (and silver-) backed token reserves directly on Polygon mainnet.

- **Users** can verify the live reserve ↔ supply ratio without trusting any
  off-chain service.
- **Auditors** with the on-chain `AUDITOR_ROLE` can submit and verify
  attestations from their wallet.

The web app is a thin client: every figure shown is derived from a public
`eth_call` against the deployed contracts. No backend is required for
verification (the optional `/events` page fetches a decoded log feed from
`taas-api` for convenience only).

## Status

🚧 **Bootstrap.** The audit app is built and runs against the live Polygon
mainnet contracts. The contracts themselves are deployed but **not yet
operational** — no metals (XAU, XAG) have been onboarded yet and no vaults
exist. The UI handles this gracefully: every page renders a "not yet
bootstrapped" empty state and waits for the timelock window to complete.

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

## Pages

| Route | What it shows |
|-------|---------------|
| `/`         | GIFT total supply hero + per-metal cards (XAU, XAG) with reserve, ratio, mint capacity, USD value, latest verified attestation. |
| `/vaults`   | World map (Leaflet + dark CARTO tiles) of every physical vault, plus a sortable data table. Markers are placed via Nominatim geocoding, cached locally. |
| `/events`   | Live event feed for the V2 PoR proxy (auto-refreshes every 30s) with filter chips. |
| `/auditor`  | Wallet-gated console: hasRole(AUDITOR_ROLE) check, list pending attestations, submit & verify on-chain. |

## Stack

- **Vite 5** + **Vue 3** + **TypeScript** (strict) + Composition API + `<script setup>`
- **TanStack Query v5** for Vue (`@tanstack/vue-query`)
- **Vue Router 4** (lazy-loaded routes)
- **Tailwind CSS v4** via `@tailwindcss/postcss`, with brand tokens copied
  from `gift-design-system`
- **ethers v6** for all on-chain reads + signer calls
- Raw `window.ethereum` + ethers `BrowserProvider` for wallet connect — chosen
  over `wagmi`, `@rainbow-me/rainbowkit-vue` (unstable), and `@web3-onboard/core`
  to keep this a minimum-dependency public-audit app. EIP-1193 / EIP-3085 are
  supported by every major browser-extension wallet.
- **Leaflet** (lazy-imported) for the vault map

## Getting started

```bash
# Install
npm install

# Local dev (port 5180, strict)
npm run dev

# Type-check (strict)
npm run typecheck

# Production build
npm run build

# Preview the built bundle
npm run preview
```

The dev server runs on **port 5180** to avoid conflicting with other
workspace apps.

## Environment variables

All defaults are Polygon mainnet — you should not need an `.env` file unless
you're pointing at a testnet build. See [`.env.example`](.env.example) for the
full list.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_RPC_URL`                 | `https://polygon-rpc.com`                      | Public Polygon RPC for read-only `eth_call`. |
| `VITE_CHAIN_ID`                | `137`                                          | Expected chain id for the wallet check. |
| `VITE_GIFT_TOKEN_ADDRESS`      | `0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea`   | GIFT ERC-20. |
| `VITE_POR_ADDRESS`             | `0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e`   | TaaSMultiMetalPoR proxy. |
| `VITE_MINT_CONTROLLER_ADDRESS` | `0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9`   | VGIFT1155MintController proxy. |
| `VITE_TAAS_API_URL`            | `https://api-stage1.utribe.app`                | Off-chain event indexer (only used by `/events`). Production URL TBD. |

## Deploy

**No deployment configured yet.** The build output is a fully static SPA in
`dist/` and will be served behind PM2 (`serve` or similar) once the contract
goes operational. Don't deploy via PM2 from this scaffold yet — wait for the
timelock window to complete and Oliver's go-ahead.

## Contracts

| Contract                  | Address (Polygon)                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------|
| GIFT Token                | [`0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea`](https://polygonscan.com/address/0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea) |
| TaaSMultiMetalPoR (proxy) | [`0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e`](https://polygonscan.com/address/0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e) |
| VGIFT1155MintController   | [`0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9`](https://polygonscan.com/address/0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9) |

## License

TBD.
