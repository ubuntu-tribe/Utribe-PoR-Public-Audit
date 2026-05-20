<script setup lang="ts">
import { RouterLink } from "vue-router";

const links: readonly { to: string; label: string }[] = [
  { to: "/", label: "Overview" },
  { to: "/vaults", label: "Vaults" },
  { to: "/events", label: "Events" },
  { to: "/auditor", label: "Auditor" },
  { to: "/docs", label: "Docs" },
] as const;
</script>

<template>
  <nav class="flex gap-1 overflow-x-auto" aria-label="Primary">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="nav-link"
      active-class="nav-link-active"
      :class="link.to === '/' ? 'exact' : ''"
    >{{ link.label }}</RouterLink>
  </nav>
</template>

<style scoped>
.nav-link {
  padding: 0.5rem 0.85rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  border: 1px solid transparent;
  transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
  white-space: nowrap;
}
.nav-link:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }
.nav-link-active {
  color: #fff;
  background: rgba(137,92,254,0.14);
  border-color: rgba(137,92,254,0.42);
}
</style>
