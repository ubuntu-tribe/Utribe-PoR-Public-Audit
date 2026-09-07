<script setup lang="ts">
/**
 * Lazy-loaded Google map of the physical vaults. `useVaultMap` fetches the Maps
 * JS API on first mount, so the library never lands in the initial bundle and
 * SSR / build paths don't choke on `window`.
 *
 * Marker detail cards are built as DOM (Advanced Marker content) rather than
 * HTML strings, so on-chain strings like `location` can't inject markup.
 */
import { onMounted, ref, watch } from "vue";
import { geocode } from "@/composables/useGeocode";
import { useVaultMap, type VaultMarker } from "@/composables/useVaultMap";
import { VAULT_STATUS, type VaultStatusName } from "@/config/chain";
import type { PorVault } from "@/composables/usePor";
import { metalIdToSymbol } from "@/lib/format";

interface Props { vaults: readonly PorVault[] }
const props = defineProps<Props>();

const { mapContainer, isUnavailable, initMap, setMarkers, openMarker } = useVaultMap({
  logLabel: "[vault-map]",
});

const openKey = ref<string | null>(null);
// Geocoding is throttled to ~1 req/sec, so a vaults update can land mid-run.
// Only the newest run is allowed to publish markers.
let placeRequest = 0;

function statusName(status: number): VaultStatusName {
  return VAULT_STATUS[status] ?? "Active";
}
function statusColor(status: number): string {
  switch (statusName(status)) {
    case "Active": return "#2DD98F";
    case "Sealed": return "#5EDCE7";
    case "Suspended": return "#FF5E6A";
    default: return "#9896A4";
  }
}
function formatNum(n: bigint): string {
  return new Intl.NumberFormat("en-US").format(Number(n));
}
function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function line(className: string, text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

function buildMarkerContent(v: PorVault): HTMLElement {
  const color = statusColor(v.status);

  const root = document.createElement("div");
  root.className = "vault-marker";
  root.dataset.open = "false";

  const pulse = document.createElement("div");
  pulse.className = "vault-marker__pulse";
  pulse.style.background = color;

  const dot = document.createElement("div");
  dot.className = "vault-marker__dot";
  dot.style.background = color;
  dot.style.boxShadow = `0 0 8px ${color}`;

  const card = document.createElement("div");
  card.className = "vault-marker__card";
  card.append(
    line("vault-marker__title", `${metalIdToSymbol(v.metalId)} · Vault #${v.id.toString()}`),
    line("vault-marker__place", v.location),
  );

  const status = line("vault-marker__status", statusName(v.status));
  status.style.color = color;
  const swatch = document.createElement("span");
  swatch.className = "vault-marker__swatch";
  swatch.style.background = color;
  status.prepend(swatch);
  card.append(status);

  const facts = document.createElement("p");
  facts.className = "vault-marker__facts";
  facts.textContent = [
    `Fine: ${formatNum(v.fineMetalMg)} mg`,
    `Gross: ${formatNum(v.grossWeightMg)} mg`,
    `Purity: ${v.purityBps} bps`,
    `Custodian: ${shortAddr(v.custodian)}`,
  ].join("\n");
  card.append(facts);

  root.append(pulse, dot, card);
  return root;
}

function toggleMarker(marker: VaultMarker): void {
  openKey.value = openKey.value === marker.key ? null : marker.key;
  openMarker(openKey.value);
}

async function placeMarkers(): Promise<void> {
  const requestId = ++placeRequest;
  const markers: VaultMarker[] = [];

  for (const v of props.vaults) {
    const coords = await geocode(v.location);
    if (requestId !== placeRequest) return;
    if (!coords) continue;
    markers.push({
      key: v.id.toString(),
      lat: coords.lat,
      lng: coords.lng,
      title: v.location,
      content: buildMarkerContent(v),
      onClick: toggleMarker,
    });
  }

  if (requestId !== placeRequest) return;
  setMarkers(markers);
  openMarker(openKey.value);
}

onMounted(async () => {
  await initMap();
  await placeMarkers();
});

watch(() => props.vaults, async () => {
  // initMap() no-ops once the map exists, so this only covers a late first load.
  await initMap();
  await placeMarkers();
});
</script>

<template>
  <div class="glass overflow-hidden" :style="{ height: 'min(60vh, 480px)' }">
    <div ref="mapContainer" class="w-full h-full" aria-label="World map of physical vaults">
      <p v-if="isUnavailable" class="map-fallback">
        Interactive map unavailable. Vault details are listed in the table below.
      </p>
    </div>
  </div>
</template>

<style>
/* Global, not scoped: Advanced Marker content renders outside Vue's tree. */
.vault-marker {
  position: relative;
  width: 20px;
  height: 20px;
  /* Advanced markers anchor content bottom-centre; shift down so the dot sits
     on the coordinate. */
  transform: translateY(50%);
}
.vault-marker__pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.35;
  animation: vault-pulse 2s ease-out infinite;
}
.vault-marker__dot {
  position: absolute;
  left: 6px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #0a0a0c;
  cursor: pointer;
}
.vault-marker__card {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  min-width: 200px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #18181e;
  border: 1px solid rgba(137, 92, 254, 0.32);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  color: #f0eee8;
  text-align: left;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-50%) translateY(6px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.vault-marker[data-open="true"] .vault-marker__card {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.vault-marker__title {
  margin: 0 0 4px;
  font-family: "Syne", sans-serif;
  font-weight: 700;
  font-size: 14px;
}
.vault-marker__place {
  margin: 0 0 6px;
  font-size: 12px;
  color: #9896a4;
}
.vault-marker__status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 12px;
}
.vault-marker__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.vault-marker__facts {
  margin: 0;
  font-family: "DM Mono", monospace;
  font-size: 11px;
  color: #9896a4;
  line-height: 1.5;
  white-space: pre-line;
}
.map-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: #9896a4;
}
@keyframes vault-pulse {
  0%   { transform: scale(0.6); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
</style>
