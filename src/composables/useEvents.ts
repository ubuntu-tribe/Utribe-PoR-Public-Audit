/**
 * Off-chain event feed for the PoR V2 proxy. This is the only call in the
 * whole app that goes through a backend — it lets us paginate event history
 * without doing 100,000-block `eth_getLogs` walks in the browser.
 */

import { useQuery, type UseQueryReturnType } from "@tanstack/vue-query";
import { ENV } from "@/config/env";

export interface ChainEvent {
  /** Event name as emitted (e.g. `AttestationSubmitted`). */
  name: string;
  /** Transaction hash. */
  txHash: string;
  /** Block number. */
  blockNumber: number;
  /** Unix-seconds timestamp. */
  timestamp: number;
  /** Log index within the block. */
  logIndex: number;
  /** Decoded args as a name→value map. Values are stringified on the wire. */
  args: Readonly<Record<string, string | number | boolean | string[]>>;
}

interface ChainEventsResponse {
  events?: ChainEvent[];
  data?: ChainEvent[];
  result?: ChainEvent[];
}

/**
 * Normalize the taas-api payload (which has shifted shape historically) into
 * a flat ChainEvent[].
 */
function normalize(raw: ChainEventsResponse | ChainEvent[]): ChainEvent[] {
  if (Array.isArray(raw)) return raw;
  if (raw.events && Array.isArray(raw.events)) return raw.events;
  if (raw.data && Array.isArray(raw.data)) return raw.data;
  if (raw.result && Array.isArray(raw.result)) return raw.result;
  return [];
}

export function useChainEvents(): UseQueryReturnType<ChainEvent[], Error> {
  return useQuery<ChainEvent[], Error>({
    queryKey: ["events", "onchain", "por_v2"],
    queryFn: async () => {
      const url = `${ENV.taasApiUrl}/events/onchain?network=polygon&contract=por_v2&limit=100`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        // Surface a clear error message — the events feed is best-effort.
        throw new Error(`Event feed unavailable (${res.status})`);
      }
      const raw = (await res.json()) as ChainEventsResponse | ChainEvent[];
      return normalize(raw);
    },
    retry: 1,
    staleTime: 25_000,
    // Auto-refresh every 30s.
    refetchInterval: 30_000,
  });
}

export const EVENT_FILTERS: readonly { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "AttestationSubmitted", value: "AttestationSubmitted" },
  { label: "AttestationVerified", value: "AttestationVerified" },
  { label: "ReserveSnapshot", value: "ReserveSnapshot" },
  { label: "VaultCreated", value: "VaultCreated" },
  { label: "VaultStatusChanged", value: "VaultStatusChanged" },
  { label: "MetalAdded", value: "MetalAdded" },
  { label: "MetalRemoved", value: "MetalRemoved" },
  { label: "MetalMoved", value: "MetalMoved" },
  { label: "MetalSupported", value: "MetalSupported" },
  { label: "MintExecuted", value: "MintExecuted" },
  { label: "RoleGranted", value: "RoleGranted" },
] as const;
