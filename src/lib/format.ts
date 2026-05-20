/**
 * Pure formatting helpers. Keep these free of side effects so they're safe
 * to call from any composable or render path.
 */

import { METAL_ID_TO_SYMBOL, type MetalSymbol } from "@/config/chain";

const MG_PER_GRAM = 1_000n;
const MG_PER_TROY_OZ = 31_103.4768; // approximate; mg/oz precision OK for display

const numberFormatter0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const numberFormatter2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormatter4 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

/** Format a bigint count of milligrams as `1,234,567 mg`. */
export function formatMg(mg: bigint | number): string {
  const n = typeof mg === "bigint" ? Number(mg) : mg;
  return `${numberFormatter0.format(n)} mg`;
}

/** Convert mg → grams with thousands separators, e.g. `12,345.6789 g`. */
export function mgToGrams(mg: bigint): string {
  if (mg === 0n) return "0 g";
  // bigint division loses precision, so split into grams + remainder mg.
  const grams = mg / MG_PER_GRAM;
  const remainder = mg % MG_PER_GRAM; // 0..999
  const decimal = Number(remainder) / 1000;
  const total = Number(grams) + decimal;
  return `${numberFormatter4.format(total)} g`;
}

/** Convert mg → troy ounces. */
export function mgToTroyOz(mg: bigint): string {
  if (mg === 0n) return "0 oz";
  const oz = Number(mg) / MG_PER_TROY_OZ;
  return `${numberFormatter4.format(oz)} oz t`;
}

/** Format basis points as a percentage, e.g. `10000` → `100.00%`. */
export function bpsToPct(bps: bigint | number): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${numberFormatter2.format(n / 100)}%`;
}

/** Format `1e6 = $1` USD value as a dollar string. */
export function formatUsd6(usd6: bigint): string {
  if (usd6 === 0n) return "—";
  const dollars = Number(usd6) / 1_000_000;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(dollars);
}

/** Format a wei value (18 decimals) as whole tokens with thousand separators. */
export function formatWei(wei: bigint, decimals = 18): string {
  if (wei === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = wei / divisor;
  return numberFormatter0.format(Number(whole));
}

/** Shorten an EVM address to `0x1234…abcd`. */
export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Shorten a tx hash to `0x123456…abcdef`. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/** Decode an on-chain `metalId` (`bytes32`) to a human symbol when known. */
export function metalIdToSymbol(metalId: string | null | undefined): MetalSymbol | "?" {
  if (!metalId) return "?";
  return METAL_ID_TO_SYMBOL[metalId.toLowerCase()] ?? "?";
}

/** Format a unix-second timestamp (bigint or number) as a local date-time string. */
export function formatTimestamp(ts: bigint | number | null | undefined): string {
  if (ts === null || ts === undefined) return "—";
  const n = typeof ts === "bigint" ? Number(ts) : ts;
  if (n === 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

/** Relative time string like "3h ago". */
export function relativeTime(tsSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - tsSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 30) return `${Math.floor(diff / 86_400)}d ago`;
  return new Date(tsSeconds * 1000).toLocaleDateString();
}
