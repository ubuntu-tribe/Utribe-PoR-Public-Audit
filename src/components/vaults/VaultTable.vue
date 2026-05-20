<script setup lang="ts">
import { computed, ref } from "vue";
import type { PorVault } from "@/composables/usePor";
import { VAULT_STATUS, VAULT_GRADE } from "@/config/chain";
import { formatMg, formatTimestamp, mgToGrams, mgToTroyOz, metalIdToSymbol, bpsToPct } from "@/lib/format";
import StatusPill from "@/components/ui/StatusPill.vue";
import MonoAddress from "@/components/ui/MonoAddress.vue";

interface Props { vaults: readonly PorVault[] }
const props = defineProps<Props>();

type SortKey = "id" | "metal" | "fineMg" | "purity" | "status" | "createdAt";
const sortKey = ref<SortKey>("id");
const sortDir = ref<"asc" | "desc">("asc");

function toggleSort(k: SortKey): void {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = k;
    sortDir.value = "asc";
  }
}

function statusTone(status: number): "success" | "info" | "danger" | "muted" {
  switch (VAULT_STATUS[status]) {
    case "Active": return "success";
    case "Sealed": return "info";
    case "Suspended": return "danger";
    default: return "muted";
  }
}

const sorted = computed(() => {
  const arr = [...props.vaults];
  const dir = sortDir.value === "asc" ? 1 : -1;
  arr.sort((a, b) => {
    switch (sortKey.value) {
      case "id": return Number(a.id - b.id) * dir;
      case "metal": return metalIdToSymbol(a.metalId).localeCompare(metalIdToSymbol(b.metalId)) * dir;
      case "fineMg": return Number(a.fineMetalMg - b.fineMetalMg) * dir;
      case "purity": return (a.purityBps - b.purityBps) * dir;
      case "status": return (a.status - b.status) * dir;
      case "createdAt": return Number(a.createdAt - b.createdAt) * dir;
      default: return 0;
    }
  });
  return arr;
});

function arrow(k: SortKey): string {
  if (sortKey.value !== k) return "";
  return sortDir.value === "asc" ? " ↑" : " ↓";
}
</script>

<template>
  <div class="glass overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th><button class="th-btn" @click="toggleSort('id')">Vault id{{ arrow('id') }}</button></th>
          <th><button class="th-btn" @click="toggleSort('metal')">Metal{{ arrow('metal') }}</button></th>
          <th>Location</th>
          <th class="text-right"><button class="th-btn" @click="toggleSort('fineMg')">Fine metal{{ arrow('fineMg') }}</button></th>
          <th class="text-right"><button class="th-btn" @click="toggleSort('purity')">Purity{{ arrow('purity') }}</button></th>
          <th><button class="th-btn" @click="toggleSort('status')">Status{{ arrow('status') }}</button></th>
          <th>Grade</th>
          <th>Custodian</th>
          <th><button class="th-btn" @click="toggleSort('createdAt')">Created{{ arrow('createdAt') }}</button></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in sorted" :key="v.id.toString()">
          <td class="t-mono">#{{ v.id.toString() }}</td>
          <td>{{ metalIdToSymbol(v.metalId) }}</td>
          <td class="text-sm">{{ v.location }}</td>
          <td class="t-mono text-right">
            {{ formatMg(v.fineMetalMg) }}
            <div class="text-xs text-[var(--text-muted)]">{{ mgToGrams(v.fineMetalMg) }} · {{ mgToTroyOz(v.fineMetalMg) }}</div>
          </td>
          <td class="t-mono text-right">
            {{ v.purityBps }}<span class="text-[var(--text-muted)]">bps</span>
            <div class="text-xs text-[var(--text-muted)]">{{ bpsToPct(v.purityBps) }}</div>
          </td>
          <td><StatusPill :tone="statusTone(v.status)" :label="VAULT_STATUS[v.status] ?? `#${v.status}`" /></td>
          <td>{{ VAULT_GRADE[v.grade] ?? `#${v.grade}` }}</td>
          <td><MonoAddress :value="v.custodian" link="address" /></td>
          <td class="text-sm">{{ formatTimestamp(v.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.th-btn { color: inherit; font: inherit; cursor: pointer; background: transparent; border: 0; padding: 0; text-transform: inherit; letter-spacing: inherit; }
.th-btn:hover { color: var(--text-primary); }
</style>
