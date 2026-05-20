<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppNav from "./AppNav.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import { NETWORK } from "@/config/chain";
</script>

<template>
  <header class="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,12,0.55)] backdrop-blur sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div class="flex items-center gap-3">
        <RouterLink to="/" class="flex items-center gap-2 group">
          <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#5EDCE7"/>
                <stop offset="100%" stop-color="#895CFE"/>
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="60" height="60" rx="14" fill="#0A0A0C" stroke="url(#logo-grad)" stroke-width="2"/>
            <circle cx="32" cy="32" r="14" fill="none" stroke="#F5CF59" stroke-width="3"/>
            <circle cx="32" cy="32" r="4" fill="#F5CF59"/>
          </svg>
          <div class="flex flex-col leading-tight">
            <span class="t-display text-lg">Ubuntu Tribe</span>
            <span class="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Proof of Reserve · Public Audit</span>
          </div>
        </RouterLink>
        <StatusPill class="hidden md:inline-flex" tone="info" :label="`Polygon · chain ${NETWORK.chainId}`" />
      </div>
      <AppNav />
    </div>
  </header>
</template>
