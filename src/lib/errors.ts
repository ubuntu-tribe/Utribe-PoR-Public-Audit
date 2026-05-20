/**
 * Translate raw ethers errors into a small typed enum so the UI can render
 * friendly empty-state panels for the common "not bootstrapped yet" reverts.
 */

import { KNOWN_ERROR_SELECTORS } from "@/config/chain";

export type RpcErrorKind = "MetalNotSupported" | "NoVerifiedAttestation" | "NetworkError" | "Other";

export interface ClassifiedError {
  kind: RpcErrorKind;
  /** Human-readable message safe to show users. */
  message: string;
  /** Raw 4-byte selector when known (`0x…`). */
  selector?: string;
  /** Raw revert data for debugging — already a hex string. */
  raw?: string;
}

interface MaybeEthersError {
  message?: string;
  code?: string;
  shortMessage?: string;
  data?: string;
  info?: { error?: { data?: string } };
  error?: { data?: string };
}

/** Best-effort extraction of revert data from ethers v6 error shapes. */
function extractRevertData(err: MaybeEthersError): string | undefined {
  if (typeof err.data === "string" && err.data.startsWith("0x")) return err.data;
  const a = err.info?.error?.data;
  if (typeof a === "string" && a.startsWith("0x")) return a;
  const b = err.error?.data;
  if (typeof b === "string" && b.startsWith("0x")) return b;
  return undefined;
}

export function classifyError(err: unknown): ClassifiedError {
  const e = (err ?? {}) as MaybeEthersError;
  const raw = extractRevertData(e);
  if (raw && raw.length >= 10) {
    const selector = raw.slice(0, 10).toLowerCase();
    const hit = KNOWN_ERROR_SELECTORS[selector];
    if (hit) {
      const kind = hit.name === "MetalNotSupported" ? "MetalNotSupported" : "NoVerifiedAttestation";
      return { kind, message: hit.friendly, selector, raw };
    }
    return {
      kind: "Other",
      message: e.shortMessage ?? e.message ?? "Contract reverted",
      selector,
      raw,
    };
  }
  if (e.code === "NETWORK_ERROR" || /network/i.test(e.message ?? "")) {
    return { kind: "NetworkError", message: "Could not reach the Polygon RPC. Retry shortly." };
  }
  return { kind: "Other", message: e.shortMessage ?? e.message ?? "Unknown error" };
}

/** Is this error one of the "graceful empty state" cases? */
export function isBenignEmptyState(err: ClassifiedError): boolean {
  return err.kind === "MetalNotSupported" || err.kind === "NoVerifiedAttestation";
}
