<script setup lang="ts">
/**
 * Lazy-loaded Leaflet map. We import `leaflet` + its CSS inside onMounted
 * so the library never lives in the initial bundle and so SSR / build paths
 * don't choke on `window`.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { geocode } from "@/composables/useGeocode";
import { VAULT_STATUS, type VaultStatusName } from "@/config/chain";
import type { PorVault } from "@/composables/usePor";
import { metalIdToSymbol } from "@/lib/format";

interface Props { vaults: readonly PorVault[] }
const props = defineProps<Props>();

const mapEl = ref<HTMLDivElement | null>(null);

// We hold these as `any` to avoid bringing the leaflet types into the
// component public API; we only call documented methods on them. Confined
// to this single file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leaflet: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mapInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let markerGroup: any = null;

async function ensureLeaflet(): Promise<void> {
  if (leaflet) return;
  const mod = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  leaflet = mod.default ?? mod;
}

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

function popupHtml(v: PorVault): string {
  const sym = metalIdToSymbol(v.metalId);
  const color = statusColor(v.status);
  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif;min-width:200px;color:#F0EEE8;">
      <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;margin-bottom:4px;">${sym} · Vault #${v.id.toString()}</div>
      <div style="font-size:12px;color:#9896A4;margin-bottom:6px;">${escapeHtml(v.location)}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
        <span style="font-size:12px;color:${color};">${statusName(v.status)}</span>
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:#9896A4;line-height:1.5;">
        Fine: ${formatNum(v.fineMetalMg)} mg<br/>
        Gross: ${formatNum(v.grossWeightMg)} mg<br/>
        Purity: ${v.purityBps} bps<br/>
        Custodian: ${shortAddr(v.custodian)}
      </div>
    </div>`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
function formatNum(n: bigint): string {
  return new Intl.NumberFormat("en-US").format(Number(n));
}
function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function buildMap(): Promise<void> {
  if (!mapEl.value) return;
  await ensureLeaflet();
  if (mapInstance) return;
  mapInstance = leaflet.map(mapEl.value, {
    center: [30, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 8,
    zoomControl: false,
    worldCopyJump: true,
    scrollWheelZoom: false,
  });
  leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png", {
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(mapInstance);
  leaflet.control.zoom({ position: "topright" }).addTo(mapInstance);
  leaflet.control.attribution({ position: "bottomright", prefix: false })
    .addAttribution("&copy; <a href=\"https://carto.com/\">CARTO</a> · <a href=\"https://www.openstreetmap.org/copyright\">OSM</a>")
    .addTo(mapInstance);
  markerGroup = leaflet.layerGroup().addTo(mapInstance);
}

async function placeMarkers(): Promise<void> {
  if (!mapInstance || !markerGroup) return;
  markerGroup.clearLayers();
  if (props.vaults.length === 0) return;

  for (const v of props.vaults) {
    const coords = await geocode(v.location);
    if (!coords) continue;
    const color = statusColor(v.status);
    const icon = leaflet.divIcon({
      className: "vault-marker-icon",
      html: `<div style="position:relative;width:20px;height:20px;"><div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.35;animation:vp 2s ease-out infinite;"></div><div style="position:absolute;left:6px;top:6px;width:8px;height:8px;border-radius:50%;background:${color};border:2px solid #0A0A0C;box-shadow:0 0 8px ${color};"></div></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    leaflet.marker([coords.lat, coords.lng], { icon })
      .bindPopup(popupHtml(v))
      .addTo(markerGroup);
  }
}

onMounted(async () => {
  await buildMap();
  await placeMarkers();
});

watch(() => props.vaults, async () => {
  if (!mapInstance) await buildMap();
  await placeMarkers();
});

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markerGroup = null;
  }
});
</script>

<template>
  <div class="glass overflow-hidden" :style="{ height: 'min(60vh, 480px)' }">
    <div ref="mapEl" class="w-full h-full" aria-label="World map of physical vaults"></div>
  </div>
</template>

<style>
/* Global, scoped at the map root via classes; Leaflet popups render outside Vue's tree */
.leaflet-popup-content-wrapper {
  background: #18181E;
  color: #F0EEE8;
  border-radius: 12px;
  border: 1px solid rgba(137,92,254,0.32);
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.leaflet-popup-tip {
  background: #18181E;
  border: 1px solid rgba(137,92,254,0.32);
}
.leaflet-control-zoom a {
  background: rgba(20,20,26,0.85) !important;
  color: #F0EEE8 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
}
.leaflet-control-attribution {
  background: rgba(10,10,12,0.6) !important;
  color: #9896A4 !important;
}
@keyframes vp {
  0%   { transform: scale(0.6); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
</style>
