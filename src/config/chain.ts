/**
 * On-chain constants + ABI fragments for the Ubuntu Tribe Proof-of-Reserve V2
 * contracts on Polygon mainnet. Mirrors the canonical spec in
 * docs/on-chain-reference.md.
 *
 * Standalone copy — no external imports from sibling workspace repos.
 */

import { ENV } from "./env";

export const NETWORK = {
  name: "polygon",
  chainId: ENV.chainId,
  rpcUrl: ENV.rpcUrl,
} as const;

/**
 * Polygon mainnet defaults — overridable via env (see config/env.ts).
 */
export const ADDRESSES = {
  giftToken: ENV.giftToken,
  taasMultiMetalPoR: ENV.porAddress,
  vgift1155MintController: ENV.mintController,
} as const;

/**
 * keccak256(symbol). Pre-computed so we don't run a hash on every render.
 */
export const METAL_IDS = {
  XAU: "0x7c687a3207cd9c05b4b11d8dd7ac337919c2200102d72989a597ebc5afcf180b",
  XAG: "0x5ccc5c04130d272bf07d6e066f4cae40cfc0313643d815db3e17af00e6ebf601",
} as const;

export type MetalSymbol = keyof typeof METAL_IDS;

export interface MetalDescriptor {
  symbol: MetalSymbol;
  name: string;
  metalId: string;
  /** Used for nice colored accents. */
  accent: "gold" | "silver";
}

export const METALS: readonly MetalDescriptor[] = [
  { symbol: "XAU", name: "Gold", metalId: METAL_IDS.XAU, accent: "gold" },
  { symbol: "XAG", name: "Silver", metalId: METAL_IDS.XAG, accent: "silver" },
] as const;

/** Reverse map: metalId → symbol — handy for decoding event args. */
export const METAL_ID_TO_SYMBOL: Readonly<Record<string, MetalSymbol>> = {
  [METAL_IDS.XAU.toLowerCase()]: "XAU",
  [METAL_IDS.XAG.toLowerCase()]: "XAG",
};

export const ROLES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  CUSTODIAN_ROLE: "0xe28434228950b641dbbc0178de89daa359a87c6ee0d8399aeace52a98fe902b9",
  AUDITOR_ROLE: "0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5",
  UPGRADER_ROLE: "0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3",
} as const;

/**
 * Attestation type enum (matches the on-chain `uint8`).
 */
export const ATTESTATION_TYPES = [
  { value: 0, label: "Monthly" },
  { value: 1, label: "Quarterly" },
  { value: 2, label: "Semi-Annual" },
  { value: 3, label: "Annual" },
  { value: 4, label: "Ad Hoc" },
] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number]["value"];

/**
 * Vault status enum (matches the on-chain `uint8`).
 */
export const VAULT_STATUS = ["Active", "Sealed", "Suspended"] as const;
export type VaultStatusName = (typeof VAULT_STATUS)[number];

export const VAULT_GRADE = ["Refined", "Doré"] as const;

/**
 * GIFT ERC-20 ABI fragments we use.
 */
export const GIFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

/**
 * TaaSMultiMetalPoR ABI fragments. Reads only on the read-path; the writes
 * (submitAttestation / verifyAttestation) only run when the connected wallet
 * has AUDITOR_ROLE.
 */
export const TAAS_POR_ABI = [
  // ---- tolerant reads (won't revert on empty state) ----
  "function supportedMetals() view returns (bytes32[])",
  "function vaultCount() view returns (uint256)",
  "function getVaultsByMetal(bytes32 metalId) view returns (uint256[])",
  "function getVault(uint256 vaultId) view returns (tuple(uint256 id, bytes32 metalId, address[] owners, address custodian, string location, uint256 grossWeightMg, uint16 purityBps, uint256 fineMetalMg, uint8 status, uint256 createdAt, uint256 lastAuditAt, uint8 grade))",
  "function hasRole(bytes32 role, address account) view returns (bool)",

  // ---- per-metal reads (revert with MetalNotSupported if metal isn't onboarded yet) ----
  "function totalReserveMetalMg(bytes32 metalId) view returns (uint256)",
  "function totalMetalAllGrades(bytes32 metalId) view returns (uint256)",
  "function totalTokenSupplyMg(bytes32 metalId) view returns (uint256)",
  "function reserveRatio(bytes32 metalId) view returns (uint256)",
  "function isReserveAdequate(bytes32 metalId) view returns (bool)",
  "function mintCapacity(bytes32 metalId) view returns (uint256)",
  "function getReserveUSD(bytes32 metalId) view returns (uint256)",

  // ---- attestations (revert with NoVerifiedAttestation when none verified) ----
  "function getLatestAttestation(bytes32 metalId) view returns (tuple(uint256 id, bytes32 metalId, bytes32 merkleRoot, string ipfsHash, uint8 attestationType, uint256 totalFineMetalMg, uint256 snapshotSupplyMg, uint256 reserveRatioBps, address custodian, address auditor, bool verified, uint256 timestamp))",
  "function getLatestVerifiedAttestation(bytes32 metalId) view returns (tuple(uint256 id, bytes32 metalId, bytes32 merkleRoot, string ipfsHash, uint8 attestationType, uint256 totalFineMetalMg, uint256 snapshotSupplyMg, uint256 reserveRatioBps, address custodian, address auditor, bool verified, uint256 timestamp))",

  // ---- auditor writes ----
  "function submitAttestation(bytes32 metalId, bytes32 merkleRoot, string ipfsHash, uint8 attestationType) returns (uint256)",
  "function verifyAttestation(bytes32 metalId, uint256 attestationId, bytes32 merkleRoot, string ipfsHash)",
] as const;

/**
 * Known custom-error 4-byte selectors. Returned on the revert `data` field by
 * ethers when an `eth_call` reverts with a custom error. We translate these
 * into friendly "not bootstrapped yet" empty states.
 */
export const KNOWN_ERROR_SELECTORS: Readonly<Record<string, { name: string; friendly: string }>> = {
  "0x0ec7f94c": {
    name: "MetalNotSupported",
    friendly: "This metal is not yet onboarded on the V2 PoR contract.",
  },
  "0x074c03ac": {
    name: "NoVerifiedAttestation",
    friendly: "No verified attestation has been recorded yet for this metal.",
  },
};
