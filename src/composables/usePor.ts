/**
 * On-chain reads against TaaSMultiMetalPoR via ethers v6 + TanStack Query.
 *
 * Every read is tolerant of the "not bootstrapped" state — the query
 * resolves with `null` (or an empty array) and surfaces a `ClassifiedError`
 * via the parallel `errors` map so the UI can render an EmptyState card.
 */

import { useQuery, type UseQueryReturnType } from "@tanstack/vue-query";
import { Contract, JsonRpcProvider } from "ethers";
import { computed, ref, type Ref } from "vue";
import { ADDRESSES, METAL_IDS, NETWORK, TAAS_POR_ABI, type MetalSymbol } from "@/config/chain";
import { classifyError, isBenignEmptyState, type ClassifiedError } from "@/lib/errors";

const provider = new JsonRpcProvider(NETWORK.rpcUrl);
const por = new Contract(ADDRESSES.taasMultiMetalPoR, TAAS_POR_ABI, provider);

/** Tuple decoded from getVault(). */
export interface PorVault {
  id: bigint;
  metalId: string;
  owners: readonly string[];
  custodian: string;
  location: string;
  grossWeightMg: bigint;
  purityBps: number;
  fineMetalMg: bigint;
  status: number;
  createdAt: bigint;
  lastAuditAt: bigint;
  grade: number;
}

export interface PorAttestation {
  id: bigint;
  metalId: string;
  merkleRoot: string;
  ipfsHash: string;
  attestationType: number;
  totalFineMetalMg: bigint;
  snapshotSupplyMg: bigint;
  reserveRatioBps: bigint;
  custodian: string;
  auditor: string;
  verified: boolean;
  timestamp: bigint;
}

export interface MetalOverview {
  metalId: string;
  totalReserveMetalMg: bigint;
  totalTokenSupplyMg: bigint;
  reserveRatioBps: bigint;
  isReserveAdequate: boolean;
  mintCapacityMg: bigint;
  reserveUsd6: bigint;
}

// -------- Helpers --------

function unwrapVault(raw: unknown): PorVault {
  // ethers v6 returns a `Result` (array-like with named getters)
  const v = raw as {
    id: bigint;
    metalId: string;
    owners: string[];
    custodian: string;
    location: string;
    grossWeightMg: bigint;
    purityBps: bigint | number;
    fineMetalMg: bigint;
    status: bigint | number;
    createdAt: bigint;
    lastAuditAt: bigint;
    grade: bigint | number;
  };
  return {
    id: BigInt(v.id),
    metalId: v.metalId,
    owners: [...v.owners],
    custodian: v.custodian,
    location: v.location,
    grossWeightMg: BigInt(v.grossWeightMg),
    purityBps: Number(v.purityBps),
    fineMetalMg: BigInt(v.fineMetalMg),
    status: Number(v.status),
    createdAt: BigInt(v.createdAt),
    lastAuditAt: BigInt(v.lastAuditAt),
    grade: Number(v.grade),
  };
}

function unwrapAttestation(raw: unknown): PorAttestation {
  const a = raw as {
    id: bigint;
    metalId: string;
    merkleRoot: string;
    ipfsHash: string;
    attestationType: bigint | number;
    totalFineMetalMg: bigint;
    snapshotSupplyMg: bigint;
    reserveRatioBps: bigint;
    custodian: string;
    auditor: string;
    verified: boolean;
    timestamp: bigint;
  };
  return {
    id: BigInt(a.id),
    metalId: a.metalId,
    merkleRoot: a.merkleRoot,
    ipfsHash: a.ipfsHash,
    attestationType: Number(a.attestationType),
    totalFineMetalMg: BigInt(a.totalFineMetalMg),
    snapshotSupplyMg: BigInt(a.snapshotSupplyMg),
    reserveRatioBps: BigInt(a.reserveRatioBps),
    custodian: a.custodian,
    auditor: a.auditor,
    verified: Boolean(a.verified),
    timestamp: BigInt(a.timestamp),
  };
}

export function getPorReader(): Contract {
  return por;
}

// -------- Composables (TanStack Query) --------

export function useSupportedMetals(): UseQueryReturnType<string[], ClassifiedError> {
  return useQuery<string[], ClassifiedError>({
    queryKey: ["por", "supportedMetals"],
    queryFn: async () => {
      try {
        const out = (await por.supportedMetals()) as readonly string[];
        return [...out];
      } catch (err) {
        throw classifyError(err);
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}

export function useVaultCount(): UseQueryReturnType<bigint, ClassifiedError> {
  return useQuery<bigint, ClassifiedError>({
    queryKey: ["por", "vaultCount"],
    queryFn: async () => {
      try {
        return BigInt((await por.vaultCount()) as bigint);
      } catch (err) {
        throw classifyError(err);
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}

/** Per-metal overview. Resolves with null on a benign empty-state revert. */
export function useMetalOverview(symbol: MetalSymbol): UseQueryReturnType<MetalOverview | null, ClassifiedError> {
  return useQuery<MetalOverview | null, ClassifiedError>({
    queryKey: ["por", "metalOverview", symbol],
    queryFn: async () => {
      const metalId = METAL_IDS[symbol];
      try {
        const [reserve, supply, ratio, adequate, capacity, usd6] = await Promise.all([
          por.totalReserveMetalMg(metalId),
          por.totalTokenSupplyMg(metalId),
          por.reserveRatio(metalId),
          por.isReserveAdequate(metalId),
          por.mintCapacity(metalId),
          por.getReserveUSD(metalId),
        ]);
        return {
          metalId,
          totalReserveMetalMg: BigInt(reserve as bigint),
          totalTokenSupplyMg: BigInt(supply as bigint),
          reserveRatioBps: BigInt(ratio as bigint),
          isReserveAdequate: Boolean(adequate),
          mintCapacityMg: BigInt(capacity as bigint),
          reserveUsd6: BigInt(usd6 as bigint),
        };
      } catch (err) {
        const c = classifyError(err);
        if (isBenignEmptyState(c)) return null;
        throw c;
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}

export function useLatestVerifiedAttestation(symbol: MetalSymbol): UseQueryReturnType<PorAttestation | null, ClassifiedError> {
  return useQuery<PorAttestation | null, ClassifiedError>({
    queryKey: ["por", "latestVerifiedAttestation", symbol],
    queryFn: async () => {
      const metalId = METAL_IDS[symbol];
      try {
        const raw = await por.getLatestVerifiedAttestation(metalId);
        return unwrapAttestation(raw);
      } catch (err) {
        const c = classifyError(err);
        if (isBenignEmptyState(c)) return null;
        throw c;
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}

export function useLatestAttestation(symbol: MetalSymbol): UseQueryReturnType<PorAttestation | null, ClassifiedError> {
  return useQuery<PorAttestation | null, ClassifiedError>({
    queryKey: ["por", "latestAttestation", symbol],
    queryFn: async () => {
      const metalId = METAL_IDS[symbol];
      try {
        const raw = await por.getLatestAttestation(metalId);
        return unwrapAttestation(raw);
      } catch (err) {
        const c = classifyError(err);
        if (isBenignEmptyState(c)) return null;
        throw c;
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}

/**
 * Fetch every vault across both metals (gold + silver), resilient to either
 * metal being unsupported. Returns a single flat array sorted by id.
 */
export function useAllVaults(): UseQueryReturnType<PorVault[], ClassifiedError> {
  return useQuery<PorVault[], ClassifiedError>({
    queryKey: ["por", "allVaults"],
    queryFn: async () => {
      const idsPerMetal = await Promise.all(
        (Object.values(METAL_IDS) as readonly string[]).map(async (metalId) => {
          try {
            const ids = (await por.getVaultsByMetal(metalId)) as readonly bigint[];
            return [...ids];
          } catch {
            // Tolerant: empty for unsupported metals.
            return [] as bigint[];
          }
        }),
      );
      const allIds = idsPerMetal.flat();
      if (allIds.length === 0) return [];
      const vaults = await Promise.all(allIds.map(async (id) => unwrapVault(await por.getVault(id))));
      return vaults.sort((a, b) => Number(a.id - b.id));
    },
    retry: 1,
    staleTime: 30_000,
  });
}

/**
 * Live wallet "hasRole" check. Re-runs whenever the account ref changes.
 * Pass `null` when no wallet is connected.
 */
export function useHasRole(role: string, account: Ref<string | null>) {
  const enabled = computed(() => Boolean(account.value));
  return useQuery<boolean, ClassifiedError>({
    queryKey: ["por", "hasRole", role, account],
    enabled,
    queryFn: async () => {
      if (!account.value) return false;
      try {
        return Boolean(await por.hasRole(role, account.value));
      } catch (err) {
        throw classifyError(err);
      }
    },
    retry: 1,
    staleTime: 10_000,
  });
}

/** Force a refetch (used after a successful wallet write). */
export const porRefetchTrigger = ref(0);
export function bumpPorRefetch() {
  porRefetchTrigger.value += 1;
}
