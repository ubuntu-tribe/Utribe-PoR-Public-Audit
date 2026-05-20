<script setup lang="ts">
import { computed, ref } from "vue";
import EventChip from "@/components/events/EventChip.vue";
import EventTable from "@/components/events/EventTable.vue";
import ErrorCard from "@/components/ui/ErrorCard.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { EVENT_FILTERS, useChainEvents } from "@/composables/useEvents";
import { ENV } from "@/config/env";
import { relativeTime } from "@/lib/format";

const events = useChainEvents();

const activeFilter = ref<string | null>(null);
const lastUpdatedAgo = ref("just now");
setInterval(() => {
  const ts = events.dataUpdatedAt.value;
  if (!ts) return;
  lastUpdatedAgo.value = relativeTime(Math.floor(ts / 1000));
}, 1000);

const filtered = computed(() => {
  const list = events.data.value ?? [];
  if (!activeFilter.value) return list;
  return list.filter((e) => e.name === activeFilter.value);
});

function setFilter(value: string | null): void {
  activeFilter.value = value;
}

function refresh(): void {
  events.refetch();
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-col gap-2">
      <h1 class="t-h1">Event log</h1>
      <p class="text-[var(--text-secondary)] max-w-3xl">
        Live event feed from the TaaSMultiMetalPoR proxy, served by the taas-api indexer
        (<code class="t-mono text-xs">{{ ENV.taasApiUrl }}</code>). Auto-refreshes every 30 seconds.
        Only the events endpoint touches a backend — every reserve figure on the other pages is read directly from Polygon RPC.
      </p>
    </header>

    <div class="flex flex-wrap gap-2 items-center" role="toolbar" aria-label="Filter events">
      <EventChip
        v-for="f in EVENT_FILTERS"
        :key="String(f.value)"
        :label="f.label"
        :active="activeFilter === f.value"
        @click="setFilter(f.value)"
      />
      <span class="text-xs text-[var(--text-muted)] ml-auto flex items-center gap-2">
        <span v-if="events.isFetching.value">Refreshing…</span>
        <span v-else>Updated {{ lastUpdatedAgo }}</span>
        <button class="btn btn-ghost text-xs" type="button" @click="refresh">Refresh</button>
      </span>
    </div>

    <div v-if="events.isPending.value" class="glass p-6 flex flex-col gap-3">
      <Skeleton v-for="i in 6" :key="i" height="1.5rem" />
    </div>

    <ErrorCard
      v-else-if="events.isError.value"
      :error="events.error.value ?? null"
      title="Event indexer unavailable"
    />

    <EventTable v-else :events="filtered" />
  </div>
</template>
