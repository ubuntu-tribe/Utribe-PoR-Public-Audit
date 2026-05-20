<script setup lang="ts">
import type { ChainEvent } from "@/composables/useEvents";
import MonoAddress from "@/components/ui/MonoAddress.vue";
import { formatTimestamp, metalIdToSymbol } from "@/lib/format";

interface Props { events: readonly ChainEvent[] }
defineProps<Props>();

function eventToneClass(name: string): string {
  if (name.startsWith("Attestation")) return "text-[var(--brand-secondary-400)]";
  if (name.startsWith("Vault")) return "text-[var(--gold-500)]";
  if (name.startsWith("Metal")) return "text-[var(--brand-primary-soft)]";
  if (name.startsWith("Reserve")) return "text-[var(--success)]";
  if (name.startsWith("Mint")) return "text-[var(--warning)]";
  if (name.startsWith("Role")) return "text-[var(--text-secondary)]";
  return "text-[var(--text-primary)]";
}

function summarizeArgs(e: ChainEvent): string {
  const a = e.args;
  const parts: string[] = [];
  if (a.metalId) parts.push(`metal=${metalIdToSymbol(String(a.metalId))}`);
  if (a.vaultId !== undefined) parts.push(`vault=#${a.vaultId}`);
  if (a.attestationId !== undefined) parts.push(`att=#${a.attestationId}`);
  if (a.grossWeightMg !== undefined) parts.push(`gross=${a.grossWeightMg} mg`);
  if (a.fineMetalMg !== undefined) parts.push(`fine=${a.fineMetalMg} mg`);
  if (a.amountMg !== undefined) parts.push(`amount=${a.amountMg} mg`);
  if (a.oldStatus !== undefined && a.newStatus !== undefined) parts.push(`${a.oldStatus} → ${a.newStatus}`);
  if (a.symbol) parts.push(`symbol=${a.symbol}`);
  if (a.role) parts.push(`role=${String(a.role).slice(0, 10)}…`);
  return parts.length ? parts.join(" · ") : "—";
}
</script>

<template>
  <div class="glass overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Event</th>
          <th>Args</th>
          <th>Tx</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="events.length === 0">
          <td colspan="4" class="text-center py-8 text-[var(--text-secondary)]">No events to show.</td>
        </tr>
        <tr v-for="e in events" :key="`${e.txHash}-${e.logIndex}`">
          <td class="text-sm text-[var(--text-secondary)]">{{ formatTimestamp(e.timestamp) }}</td>
          <td class="t-mono text-sm font-medium" :class="eventToneClass(e.name)">{{ e.name }}</td>
          <td class="t-mono text-xs text-[var(--text-secondary)] break-all max-w-md">{{ summarizeArgs(e) }}</td>
          <td><MonoAddress :value="e.txHash" link="tx" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
