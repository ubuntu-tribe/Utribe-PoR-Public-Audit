<script setup lang="ts">
import { ADDRESSES } from "@/config/chain";
import { POLYGONSCAN } from "@/config/env";
</script>

<template>
  <footer class="border-t border-[rgba(255,255,255,0.06)] mt-16">
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between text-sm text-[var(--text-secondary)]">
      <div class="flex flex-col gap-1">
        <span>Every figure is derived from a public <code class="t-mono">eth_call</code> on Polygon mainnet — no backend required for verification.</span>
        <span class="t-mono text-xs text-[var(--text-muted)]">PoR proxy: {{ ADDRESSES.taasMultiMetalPoR }}</span>
      </div>
      <div class="flex gap-4">
        <a class="hover:text-[var(--text-primary)]" :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}`" target="_blank" rel="noreferrer noopener">Polygonscan</a>
        <a class="hover:text-[var(--text-primary)]" href="https://github.com/ubuntu-tribe/Utribe-PoR-Public-Audit" target="_blank" rel="noreferrer noopener">Source</a>
      </div>
    </div>
  </footer>
</template>
