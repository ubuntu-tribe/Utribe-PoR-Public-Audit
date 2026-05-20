# On-Chain Reference — Ubuntu Tribe Proof of Reserve (V2)

> **Audience:** auditors, integrators, and anyone who wants to independently verify
> Ubuntu Tribe's gold-backed token reserves on-chain without trusting any web UI.
>
> **TL;DR:** the **GIFT** token supply lives in one contract, the **TaaSMultiMetalPoR**
> contract owns the per-metal reserves and attestation history, and every value below
> is reproducible with a single `eth_call` against a public Polygon RPC.

---

## 1. Network

| Field           | Value                                                                          |
|-----------------|--------------------------------------------------------------------------------|
| Network         | **Polygon Mainnet**                                                            |
| Chain ID        | `137`                                                                          |
| Public RPC      | `https://polygon-rpc.com` (any Polygon-compatible RPC works)                   |
| Block explorer  | https://polygonscan.com                                                        |
| Deployed at     | 2026-05-12 (PoR V2 deployment)                                                 |

---

## 2. Contract Addresses (Polygon Mainnet)

All PoR V2 contracts are **UUPS upgradeable proxies**. Always interact with the **proxy** address. The implementation slot is verifiable on-chain via [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967) storage read.

| Role                      | Proxy Address                                                                                                              | Implementation                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| **GIFT Token (ERC-20)**   | [`0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea`](https://polygonscan.com/address/0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea) | n/a (non-upgradeable on mainnet)                                                                                            |
| **TaaSMultiMetalPoR**     | [`0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e`](https://polygonscan.com/address/0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e) | [`0xac5b635600da5dbe89e8038cac55c0668c36aed2`](https://polygonscan.com/address/0xac5b635600da5dbe89e8038cac55c0668c36aed2) |
| **VGIFT1155MintController** | [`0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9`](https://polygonscan.com/address/0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9) | [`0x08fc51e0c1f264caed3c210a9e5210115507c6a8`](https://polygonscan.com/address/0x08fc51e0c1f264caed3c210a9e5210115507c6a8) |
| ComplianceRegistry        | [`0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415`](https://polygonscan.com/address/0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415) | [`0xA241cB40384Bbc026dbC439433Fa6FAb6E9c639A`](https://polygonscan.com/address/0xA241cB40384Bbc026dbC439433Fa6FAb6E9c639A) |
| Deployer EOA              | [`0xdB1d772ADA92EfC204689DC08AF41017f4e8E3CF`](https://polygonscan.com/address/0xdB1d772ADA92EfC204689DC08AF41017f4e8E3CF) | n/a                                                                                                                         |
| Factory                   | [`0x0A0df4cC9Fa45b88ea4Fb72cf2bC9A79713f63F9`](https://polygonscan.com/address/0x0A0df4cC9Fa45b88ea4Fb72cf2bC9A79713f63F9) | n/a                                                                                                                         |

**Verifying the implementation slot (EIP-1967)** — anyone can verify the implementation behind a proxy without trusting the table above:

```bash
# Storage slot keccak256("eip1967.proxy.implementation") - 1
cast storage 0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e \
  0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
  --rpc-url https://polygon-rpc.com
# → 0x000000000000000000000000ac5b635600da5dbe89e8038cac55c0668c36aed2
```

---

## 3. Metal Identifiers

V2 PoR is multi-metal. Every reserve / mint / attestation read is scoped by a 32-byte `metalId` (the keccak256 of the metal symbol).

| Symbol | Name   | metalId (`keccak256(symbol)`)                                                      |
|--------|--------|------------------------------------------------------------------------------------|
| `XAU`  | Gold   | `0x7c687a3207cd9c05b4b11d8dd7ac337919c2200102d72989a597ebc5afcf180b`               |
| `XAG`  | Silver | `0x5ccc5c04130d272bf07d6e066f4cae40cfc0313643d815db3e17af00e6ebf601`               |

These values are reproducible — always re-derive locally rather than copy-pasting from any doc:

Quick check:

```js
// ethers.js v6
import { id } from "ethers";
console.log(id("XAU")); // → metalId for Gold
console.log(id("XAG")); // → metalId for Silver
```

```bash
# foundry / cast
cast keccak "XAU"
cast keccak "XAG"
```

The contract also exposes the canonical list of metals it knows about:

```bash
cast call 0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e \
  "supportedMetals()(bytes32[])" \
  --rpc-url https://polygon-rpc.com
```

---

## 4. Supply Reads — GIFT Token

The **GIFT** ERC-20 token is a vanilla OpenZeppelin ERC-20 with `AccessControl` + `Pausable`. Total supply is the canonical figure you compare against the reserve.

### `totalSupply() → uint256` (18 decimals)

| Method      | Command                                                                                                                                       |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `cast`      | `cast call 0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea "totalSupply()(uint256)" --rpc-url https://polygon-rpc.com`                              |
| `ethers.js` | `const total = await new Contract(GIFT, ["function totalSupply() view returns (uint256)"], provider).totalSupply();`                            |
| Polygonscan | https://polygonscan.com/token/0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea (Read Contract → `totalSupply`)                                       |

Convert to whole GIFT: `value / 10^18`.

### Other useful ERC-20 reads (same contract)

| Function                                  | Returns                                  |
|-------------------------------------------|------------------------------------------|
| `name() view returns (string)`            | `"GIFT"`                                 |
| `symbol() view returns (string)`          | `"GIFT"`                                 |
| `decimals() view returns (uint8)`         | `18`                                     |
| `balanceOf(address) view returns (uint256)` | Wallet's balance                       |
| `paused() view returns (bool)`            | Circuit-breaker flag                     |
| `hasRole(bytes32 role, address account) view returns (bool)` | Role check (admin / minter / pauser) |

---

## 5. Reserve Reads — TaaSMultiMetalPoR

All functions live on the proxy `0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e`. Weights are denominated in **milligrams** (`mg`) of **fine metal** (after applying purity).

### 5.1 Aggregate reserve & mint capacity

| Function | Signature | What it returns |
|---|---|---|
| Total reserve (fine metal) | `totalReserveMetalMg(bytes32 metalId) view returns (uint256)` | Sum of fine-metal mg across all active vaults for that metal. **The number you compare to token supply.** |
| Total all grades | `totalMetalAllGrades(bytes32 metalId) view returns (uint256)` | Gross fine-metal mg including non-refined / doré inventory (informational). |
| Token supply (snapshot) | `totalTokenSupplyMg(bytes32 metalId) view returns (uint256)` | Outstanding tokenized mg for that metal — reads from the registered mint controller. |
| Reserve ratio | `reserveRatio(bytes32 metalId) view returns (uint256)` | Basis points (`10000` = 100 %). Computed as `totalReserveMetalMg * 10000 / totalTokenSupplyMg`. |
| Is reserve adequate? | `isReserveAdequate(bytes32 metalId) view returns (bool)` | `true` iff `reserveRatio ≥ reserveRatioBpsMin(metalId)`. |
| Mint capacity (mg) | `mintCapacity(bytes32 metalId) view returns (uint256)` | Headroom: how many additional fine-mg can be minted before tripping the reserve floor. |
| Reserve in USD (6 dp) | `getReserveUSD(bytes32 metalId) view returns (uint256)` | Reserve valued at the latest oracle price (`1e6` = $1.00). Returns 0 if oracle is unset / stale. |

**Quick check (Gold, foundry):**

```bash
METAL_ID=$(cast keccak "XAU")
POR=0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e
RPC=https://polygon-rpc.com

cast call $POR "totalReserveMetalMg(bytes32)(uint256)"  $METAL_ID --rpc-url $RPC
cast call $POR "totalTokenSupplyMg(bytes32)(uint256)"   $METAL_ID --rpc-url $RPC
cast call $POR "reserveRatio(bytes32)(uint256)"         $METAL_ID --rpc-url $RPC
cast call $POR "isReserveAdequate(bytes32)(bool)"       $METAL_ID --rpc-url $RPC
cast call $POR "mintCapacity(bytes32)(uint256)"         $METAL_ID --rpc-url $RPC
cast call $POR "getReserveUSD(bytes32)(uint256)"        $METAL_ID --rpc-url $RPC
```

### 5.2 Vaults

A vault is a physical custody unit (a single safe, location, custodian). Each vault is tagged with one metal.

| Function | Signature | What it returns |
|---|---|---|
| Vault count | `vaultCount() view returns (uint256)` | Total vaults across all metals. |
| Vault ids by metal | `getVaultsByMetal(bytes32 metalId) view returns (uint256[])` | Array of vault ids holding that metal. |
| Single vault | `getVault(uint256 vaultId) view returns (Vault)` | See struct below. |

**`Vault` struct:**

```solidity
struct Vault {
    uint256   id;                // vault id
    bytes32   metalId;           // keccak256("XAU") / keccak256("XAG")
    address[] owners;            // legal owners of the contents
    address   custodian;         // who physically holds it
    string    location;          // human-readable, e.g. "Brinks Zurich V12"
    uint256   grossWeightMg;     // gross weight in milligrams
    uint16    purityBps;         // purity in basis points, e.g. 9999
    uint256   fineMetalMg;       // grossWeightMg * purityBps / 10000
    uint8     status;            // 0=Active, 1=Sealed, 2=Suspended
    uint256   createdAt;         // unix seconds
    uint256   lastAuditAt;       // unix seconds
    uint8     grade;             // 0=Refined, 1=Doré
}
```

**Reading every gold vault in one walk (ethers.js v6):**

```js
import { Contract, JsonRpcProvider, id } from "ethers";

const provider = new JsonRpcProvider("https://polygon-rpc.com");
const POR = "0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e";

const abi = [
  "function getVaultsByMetal(bytes32 metalId) view returns (uint256[])",
  "function getVault(uint256 vaultId) view returns (tuple(uint256 id, bytes32 metalId, address[] owners, address custodian, string location, uint256 grossWeightMg, uint16 purityBps, uint256 fineMetalMg, uint8 status, uint256 createdAt, uint256 lastAuditAt, uint8 grade))",
];

const por = new Contract(POR, abi, provider);
const goldVaultIds = await por.getVaultsByMetal(id("XAU"));
const vaults = await Promise.all(goldVaultIds.map((vid) => por.getVault(vid)));
console.table(vaults.map(v => ({ id: v.id.toString(), location: v.location, fineMg: v.fineMetalMg.toString(), status: ["Active","Sealed","Suspended"][v.status] })));
```

### 5.3 Attestations (audit history)

Auditors periodically submit a Merkle root of the vault set plus an off-chain report URI (typically IPFS). The contract records every submission and an independent auditor verifies it.

| Function | Signature | What it returns |
|---|---|---|
| Latest (any) | `getLatestAttestation(bytes32 metalId) view returns (Attestation)` | Most recent submission for that metal, verified or not. |
| Latest **verified** | `getLatestVerifiedAttestation(bytes32 metalId) view returns (Attestation)` | The freshest auditor-verified attestation. **Use this for "is the reserve audited as of date X?"**. |
| Vault inclusion proof | `verifyVaultInclusion(bytes32 metalId, uint256 attestationId, uint256 vaultId, uint256 fineMetalMg, uint16 purityBps, address custodian, uint8 grade, bytes32[] proof) view returns (bool)` | Returns `true` if the (vaultId, fineMetalMg, purityBps, custodian, grade) tuple is part of the attestation's Merkle root. |
| Leaf hash | `computeVaultLeaf(bytes32 metalId, uint256 vaultId, uint256 fineMetalMg, uint16 purityBps, address custodian, uint8 grade) pure returns (bytes32)` | Pure helper — compute the leaf locally to feed `verifyVaultInclusion`. |

**`Attestation` struct:**

```solidity
struct Attestation {
    uint256 id;
    bytes32 metalId;
    bytes32 merkleRoot;          // root of (vaultId, fineMg, purity, custodian, grade) leaves
    string  ipfsHash;            // off-chain auditor report (ipfs://…)
    uint8   attestationType;     // 0=Monthly, 1=Quarterly, 2=Semi-Annual, 3=Annual, 4=Ad Hoc
    uint256 totalFineMetalMg;    // sum of fine-mg snapshotted at submit time
    uint256 snapshotSupplyMg;    // token supply at submit time
    uint256 reserveRatioBps;     // ratio at submit time
    address custodian;           // submitter
    address auditor;             // verifier (zero until verified)
    bool    verified;
    uint256 timestamp;           // submit time
}
```

### 5.4 Roles (governance)

The contract uses OpenZeppelin's `AccessControlUpgradeable`. Anyone can read role membership.

| Role                  | bytes32 value                                                          | Purpose                                            |
|-----------------------|------------------------------------------------------------------------|----------------------------------------------------|
| `DEFAULT_ADMIN_ROLE`  | `0x0000000000000000000000000000000000000000000000000000000000000000`   | Can grant / revoke other roles. Held by timelock.  |
| `CUSTODIAN_ROLE`      | `0xe28434228950b641dbbc0178de89daa359a87c6ee0d8399aeace52a98fe902b9`   | Submits attestations + adjusts inventory.          |
| `AUDITOR_ROLE`        | `0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5`   | Verifies attestations (independence of duties).    |
| `UPGRADER_ROLE`       | `0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3`   | Authorizes UUPS implementation upgrades.           |

All non-admin roles are `keccak256("ROLE_NAME")`. `DEFAULT_ADMIN_ROLE` is `bytes32(0)` per OpenZeppelin convention (not `keccak("DEFAULT_ADMIN_ROLE")`).

```bash
# Check who can verify attestations
ROLE=$(cast keccak "AUDITOR_ROLE")
cast call 0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e \
  "hasRole(bytes32,address)(bool)" $ROLE 0xYourCandidate \
  --rpc-url https://polygon-rpc.com
```

---

## 6. Independent Verification Recipe

Anyone can verify the reserve↔supply invariant in ~10 seconds with `cast`:

```bash
GIFT=0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea
POR=0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e
RPC=https://polygon-rpc.com
XAU=$(cast keccak "XAU")

echo "GIFT total supply (whole GIFT):"
cast call $GIFT "totalSupply()(uint256)" --rpc-url $RPC | awk '{print $1/1e18}'

echo "Gold reserve (mg fine):"
cast call $POR "totalReserveMetalMg(bytes32)(uint256)" $XAU --rpc-url $RPC

echo "Gold reserve ratio (bps, 10000 = 100%):"
cast call $POR "reserveRatio(bytes32)(uint256)" $XAU --rpc-url $RPC

echo "Is gold reserve adequate?"
cast call $POR "isReserveAdequate(bytes32)(bool)" $XAU --rpc-url $RPC
```

Independent verification of a single vault's inclusion in an attestation:

1. `getLatestVerifiedAttestation(metalId)` → grab `id`, `merkleRoot`, `ipfsHash`.
2. Fetch the auditor's report from IPFS (`ipfs://<hash>`). It includes the full vault list plus Merkle proofs.
3. For each vault: `computeVaultLeaf(metalId, vaultId, fineMg, purityBps, custodian, grade)` → must match the leaf in the report.
4. `verifyVaultInclusion(metalId, attestationId, vaultId, fineMg, purityBps, custodian, grade, proof)` → must return `true`.
5. Sum of every vault's `fineMetalMg` must equal `attestation.totalFineMetalMg`.

If any step fails, the attestation is invalid — full stop.

---

## 7. Events to Index (Vault & Asset Activity)

All of these are emitted by `TaaSMultiMetalPoR` and can be queried with `eth_getLogs` against the proxy address.

| Event | Signature | Meaning |
|---|---|---|
| `VaultCreated` | `(bytes32 indexed metalId, uint256 indexed vaultId, address indexed custodian)` | New physical vault registered. |
| `VaultStatusChanged` | `(uint256 indexed vaultId, uint8 oldStatus, uint8 newStatus)` | Active → Sealed / Suspended transition. |
| `VaultCustodianChanged` | `(uint256 indexed vaultId, address indexed oldCustodian, address indexed newCustodian)` | Custody handover. |
| `VaultGradeSet` | `(uint256 indexed vaultId, uint8 grade)` | Vault tagged Refined or Doré. |
| `VaultPurityUpdated` | `(uint256 indexed vaultId, uint16 oldPurityBps, uint16 newPurityBps, uint256 newFineMetalMg)` | Re-assay updated purity. |
| `MetalAdded` | `(bytes32 indexed metalId, uint256 indexed vaultId, uint256 grossWeightMg, uint256 fineMetalMg, string reason)` | Physical metal deposited into a vault. |
| `MetalRemoved` | `(bytes32 indexed metalId, uint256 indexed vaultId, uint256 grossWeightMg, uint256 fineMetalMg, string reason)` | Physical metal redeemed / removed. |
| `MetalMoved` | `(bytes32 indexed metalId, uint256 indexed fromVaultId, uint256 indexed toVaultId, uint256 grossWeightMg, string reason)` | Metal transferred between vaults. |
| `MetalSupported` | `(bytes32 indexed metalId, string symbol, string displayName)` | New metal type onboarded. |
| `MetalOracleSet` | `(bytes32 indexed metalId, address indexed aggregator)` | Price-feed change. |
| `MetalReserveRatioSet` | `(bytes32 indexed metalId, uint16 reserveRatioBpsMin)` | Minimum reserve floor change. |
| `AttestationSubmitted` | `(bytes32 indexed metalId, uint256 indexed attestationId, address indexed custodian, bytes32 merkleRoot, string ipfsHash)` | Custodian submitted a Merkle root + report. |
| `AttestationVerified` | `(bytes32 indexed metalId, uint256 indexed attestationId, address indexed auditor)` | Independent auditor approved it. |
| `AttestationConfigUpdated` | `(bytes32 indexed metalId, uint8 indexed attestationType, uint256 intervalSeconds, bool enforced)` | Schedule / enforcement change. |
| `ReserveSnapshot` | `(bytes32 indexed metalId, uint256 indexed attestationId, uint256 totalFineMetalMg, uint256 snapshotSupplyMg, uint256 reserveRatioBps, uint256 timestamp)` | Aggregate snapshot at attestation time. |
| `MintAllowanceSet` | `(bytes32 indexed metalId, address indexed minter, uint256 indexed vaultId, uint256 oldAllowance, uint256 newAllowance)` | Minter quota change. |
| `MintExecuted` | `(bytes32 indexed metalId, address indexed minter, uint256 indexed vaultId, uint256 amountMg, uint256 remainingAllowance)` | Mint drew down a vault's allowance. |
| `RoleGranted` / `RoleRevoked` / `RoleAdminChanged` | OZ `AccessControl` standard | Governance changes. |

**Recommended indexing strategy** for a public PoR explorer:

- Subscribe to events from block `87,120,000` onward (deployment ≈ block 87,120,660 on 2026-05-12). Anything older is from V1 contracts and lives at a different address.
- Re-index from genesis if and only if you need pre-V2 history (it isn't on this proxy).
- Use `getLogs` with `address = TaaSMultiMetalPoR proxy` and no topic filter to pull everything.

---

## 8. Polygonscan Quick Links

- GIFT Token (Read Contract): https://polygonscan.com/token/0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea#readContract
- TaaSMultiMetalPoR (Read as Proxy): https://polygonscan.com/address/0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e#readProxyContract
- TaaSMultiMetalPoR (Events): https://polygonscan.com/address/0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e#events
- VGIFT1155MintController (Read as Proxy): https://polygonscan.com/address/0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9#readProxyContract

> If "Read as Proxy" shows blank fields, the implementation isn't verified yet on
> Polygonscan. Use `cast call` from §6 to verify directly — it doesn't depend on
> Polygonscan's source verification.

---

## 9. Live Sanity Snapshot (as of 2026-05-20)

A quick on-chain spot-check at the time this doc was written:

| Value                              | Raw                                                          | Decoded               |
|------------------------------------|--------------------------------------------------------------|-----------------------|
| `GIFT.totalSupply()`               | `0x4407746d561972a3c0000`                                    | **5,140,135 GIFT**    |
| `TaaSMultiMetalPoR.vaultCount()`   | `0x00`                                                       | **0** vaults onboarded |
| `TaaSMultiMetalPoR.supportedMetals()` | empty array                                               | **No metals onboarded yet** |

> **Bootstrap state:** the V2 PoR proxy is deployed and operational, but no
> metals have been registered yet via `MetalSupported(...)` and no vaults have
> been created via `VaultCreated(...)`. Reads scoped by `metalId` (e.g.
> `totalReserveMetalMg(XAU)`) **will revert** with the `MetalNotSupported`
> custom error until the metal is onboarded. Tolerant getters
> (`supportedMetals()`, `getVaultsByMetal()`, `vaultCount()`) return empty
> arrays or `0` instead of reverting and are the right place to start.

**Known custom-error selectors** (the 4-byte prefix of revert `data`):

| Selector     | Likely error                                |
|--------------|---------------------------------------------|
| `0x0ec7f94c` | `MetalNotSupported(bytes32 metalId)`        |
| `0x074c03ac` | `NoVerifiedAttestation(bytes32 metalId)`    |

If a call reverts with one of these, the input itself is well-formed — the contract simply has no state for that metal yet.

---

## 10. Notes & Caveats

- **Units everywhere are milligrams of fine metal.** Convert: `1 g = 1_000 mg`, `1 kg = 1_000_000 mg`, `1 troy oz ≈ 31_103.4768 mg`.
- **`totalReserveMetalMg` excludes** vaults whose `status != Active`. Sealed / Suspended vaults are still in `getVaultsByMetal` but don't count toward backing.
- **`totalTokenSupplyMg`** comes from the registered mint controller (see `MetalMintControllerSet` event). It is **not** the same as ERC-1155 `totalSupply(tokenId)` because the controller tracks fine-mg minted, not token units.
- **`getReserveUSD`** returns `0` if the metal's oracle is unset or the price is older than `MetalMaxPriceAgeSet`. Treat any `0` value as "unavailable", not "reserve is worth nothing".
- **V1 archive**: legacy single-metal `GIFTPoR` lives at a different (implementation-only, no proxy) address. It is **read-only / archived** — do not use it for current reserve checks.

---

## 11. Programmatic Constants (drop-in for your code)

```ts
// TypeScript / ethers v6 — paste & use
import { id } from "ethers";

export const NETWORK = {
  name: "polygon",
  chainId: 137,
  rpcUrl: "https://polygon-rpc.com",
} as const;

export const ADDRESSES = {
  giftToken:                "0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea",
  taasMultiMetalPoR:        "0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e",
  vgift1155MintController:  "0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9",
  complianceRegistry:       "0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415",
  deployer:                 "0xdB1d772ADA92EfC204689DC08AF41017f4e8E3CF",
  factory:                  "0x0A0df4cC9Fa45b88ea4Fb72cf2bC9A79713f63F9",
} as const;

export const METAL_IDS = {
  XAU: id("XAU"), // 0x7c687a3207cd9c05b4b11d8dd7ac337919c2200102d72989a597ebc5afcf180b
  XAG: id("XAG"), // 0x5ccc5c04130d272bf07d6e066f4cae40cfc0313643d815db3e17af00e6ebf601
} as const;

export const ROLES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  CUSTODIAN_ROLE:     "0xe28434228950b641dbbc0178de89daa359a87c6ee0d8399aeace52a98fe902b9",
  AUDITOR_ROLE:       "0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5",
  UPGRADER_ROLE:      "0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3",
} as const;
```

---

_Last updated: 2026-05-20. If you find a discrepancy between this doc and on-chain values, **trust on-chain** and open an issue._
