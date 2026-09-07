/**
 * Shared Google Maps JS API bootstrap.
 *
 * The Maps script may only be injected once per page, so anything needing
 * Google Maps goes through this module and then pulls the specific library it
 * needs via `importGoogleMapsLibrary`.
 *
 * We type the returned libraries as `unknown`-ish (`any`) rather than pulling in
 * `@types/google.maps`: only `useVaultMap` touches them, and it calls documented
 * methods only.
 */

import { ENV } from "@/config/env";

/* eslint-disable @typescript-eslint/no-explicit-any */

let bootstrapPromise: Promise<any> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return !!ENV.googleMapsKey;
}

export function getGoogleMapId(): string {
  return ENV.googleMapsMapId;
}

function bootstrapGoogleMaps(): Promise<any> {
  const key = ENV.googleMapsKey;
  if (!key) return Promise.reject(new Error("VITE_GOOGLE_MAPS is not set"));
  if (bootstrapPromise) return bootstrapPromise;

  const promise = new Promise<any>((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps?.importLibrary) {
      resolve(w.google.maps);
      return;
    }

    const callbackName = "__initGoogleMapsApi";
    w[callbackName] = () => {
      delete w[callbackName];
      resolve(w.google.maps);
    };

    // No `libraries=` param: callers pull what they need through importLibrary.
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      // Remove the failed tag so a retry doesn't accumulate dead <script>s.
      script.remove();
      delete w[callbackName];
      reject(new Error("Failed to load the Google Maps JS API"));
    };
    document.head.appendChild(script);
  });

  // Don't cache a rejection — a transient load failure would otherwise disable
  // the map for the whole session. Clear the cache so the next call retries.
  promise.catch(() => {
    if (bootstrapPromise === promise) bootstrapPromise = null;
  });
  bootstrapPromise = promise;
  return promise;
}

/**
 * Load one Maps JS library ('core', 'maps', 'marker', …), bootstrapping the API
 * on first use.
 */
export async function importGoogleMapsLibrary(name: string): Promise<any> {
  const maps = await bootstrapGoogleMaps();
  return maps.importLibrary(name);
}
