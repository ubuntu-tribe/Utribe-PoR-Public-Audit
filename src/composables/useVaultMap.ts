/**
 * useVaultMap — Google Maps wrapper for the vault map.
 *
 * Encapsulates the parts that are easy to get wrong: the Maps JS API loads
 * lazily, the container can be detached mid-init, and markers have to be torn
 * down by hand. Markers are Advanced Markers, so their content is real DOM
 * built by the caller — no HTML-string interpolation of chain data.
 */

import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { getGoogleMapId, importGoogleMapsLibrary, isGoogleMapsConfigured } from "@/lib/googleMaps";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VaultMarker {
  key: string;
  lat: number;
  lng: number;
  title?: string;
  content: HTMLElement;
  onClick?: (marker: VaultMarker) => void;
}

export interface VaultMapOptions {
  center?: { lat: number; lng: number };
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  fitMaxZoom?: number;
  focusZoom?: number;
  fitPadding?: number;
  gestureHandling?: "greedy" | "cooperative" | "none" | "auto";
  logLabel?: string;
}

export function useVaultMap(options: VaultMapOptions = {}) {
  const {
    center = { lat: 30, lng: 10 },
    zoom = 2,
    minZoom = 2,
    maxZoom = 8,
    // fitBounds alone would zoom all the way in on a single vault.
    fitMaxZoom = 5,
    focusZoom = 5,
    fitPadding = 50,
    gestureHandling = "cooperative",
    logLabel = "[vault-map]",
  } = options;

  const mapContainer = ref<HTMLDivElement | null>(null);
  const isReady = ref(false);
  // No API key, or the script failed to load — the caller shows a fallback.
  const isUnavailable = ref(!isGoogleMapsConfigured());

  let core: any = null;
  let mapsLib: any = null;
  let markerLib: any = null;
  let map: any = null;
  let entries: Array<{ key: string; marker: any; content: HTMLElement }> = [];
  let isActive = false;
  let initRequest = 0;

  function getContainer(): HTMLDivElement | null {
    const el = mapContainer.value;
    if (!el || typeof document === "undefined") return null;
    // The element can be detached between Vue's ref update and the Map
    // constructor; treat that as a no-op rather than an error.
    return document.body.contains(el) ? el : null;
  }

  function waitForFrame(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }

  async function loadLibraries(): Promise<boolean> {
    if (mapsLib) return true;
    try {
      const [coreLib, maps, marker] = await Promise.all([
        importGoogleMapsLibrary("core"),
        importGoogleMapsLibrary("maps"),
        importGoogleMapsLibrary("marker"),
      ]);
      core = coreLib;
      mapsLib = maps;
      markerLib = marker;
      return true;
    } catch (err) {
      console.warn(`${logLabel} Google Maps unavailable`, err);
      isUnavailable.value = true;
      return false;
    }
  }

  async function initMap(): Promise<void> {
    if (isUnavailable.value || map) return;

    const requestId = ++initRequest;
    await nextTick();
    if (!isActive || map || !getContainer()) return;

    if (!(await loadLibraries())) return;
    await waitForFrame();
    if (!isActive || requestId !== initRequest || map) return;

    const container = getContainer();
    if (!container) return;

    map = new mapsLib.Map(container, {
      center,
      zoom,
      minZoom,
      maxZoom,
      mapId: getGoogleMapId(),
      colorScheme: core.ColorScheme?.DARK ?? "DARK",
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: core.ControlPosition?.RIGHT_TOP },
      gestureHandling,
      clickableIcons: false,
      keyboardShortcuts: false,
    });
    isReady.value = true;
  }

  function clearMarkers(): void {
    entries.forEach((entry) => {
      entry.marker.map = null;
    });
    entries = [];
  }

  /** Replace every marker and frame the result. */
  function setMarkers(items: VaultMarker[] = []): void {
    if (!map || !markerLib) return;
    clearMarkers();

    const bounds = new core.LatLngBounds();
    items.forEach((item) => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const position = { lat: item.lat, lng: item.lng };
      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position,
        title: item.title ?? "",
        content: item.content,
        gmpClickable: !!item.onClick,
      });
      if (item.onClick) marker.addListener("click", () => item.onClick?.(item));
      entries.push({ key: item.key, marker, content: item.content });
      bounds.extend(position);
    });

    if (entries.length) fitToMarkers(bounds);
  }

  function fitToMarkers(bounds: any): void {
    map.fitBounds(bounds, fitPadding);
    // fitBounds has no maxZoom option, so clamp once the camera settles.
    const listener = map.addListener("idle", () => {
      listener.remove();
      if (map.getZoom() > fitMaxZoom) map.setZoom(fitMaxZoom);
    });
  }

  /**
   * Mark one marker as open (`data-open="true"` on its content element) and
   * close the rest. Pass `null` to close everything.
   */
  function openMarker(key: string | null): void {
    entries.forEach((entry) => {
      const isOpen = key !== null && entry.key === key;
      entry.content.dataset.open = String(isOpen);
      // Keep the open marker's card above its neighbours.
      entry.marker.zIndex = isOpen ? 1 : 0;
    });
  }

  /** Centre the map on a coordinate at the focus zoom level. */
  function focus(lat: number, lng: number): void {
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.panTo({ lat, lng });
    map.setZoom(focusZoom);
  }

  function teardownMap(): void {
    clearMarkers();
    if (map && core?.event) core.event.clearInstanceListeners(map);
    map = null;
    isReady.value = false;
  }

  onMounted(() => {
    isActive = true;
  });

  onUnmounted(() => {
    isActive = false;
    initRequest++;
    teardownMap();
  });

  return { mapContainer, isReady, isUnavailable, initMap, setMarkers, openMarker, focus, teardownMap };
}
