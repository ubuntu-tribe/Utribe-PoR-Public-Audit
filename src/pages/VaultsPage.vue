<script setup lang="ts">
import { computed } from "vue";
import VaultMap from "@/components/vaults/VaultMap.vue";
import VaultTable from "@/components/vaults/VaultTable.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ErrorCard from "@/components/ui/ErrorCard.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { useAllVaults } from "@/composables/usePor";
import { ADDRESSES } from "@/config/chain";
import { POLYGONSCAN } from "@/config/env";

const vaults = useAllVaults();

const isEmpty = computed(() => {
  return vaults.data.value !== undefined && vaults.data.value.length === 0;
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="t-h1">Physical vaults</h1>
      <p class="text-[var(--text-secondary)] mt-2 max-w-2xl">
        Every physical custody unit registered on-chain, with its fine-metal weight, purity, and current status. Markers are placed by geocoding the vault's <code class="t-mono">location</code> string via OpenStreetMap Nominatim — coordinates are cached locally so the map loads instantly on revisit.
      </p>
    </header>

    <div v-if="vaults.isPending.value" class="glass p-6">
      <Skeleton height="2rem" width="14rem" />
      <Skeleton class="mt-3" height="22rem" />
    </div>

    <ErrorCard v-else-if="vaults.isError.value" :error="vaults.error.value" title="Couldn't load the vault list" />

    <EmptyState
      v-else-if="isEmpty"
      title="No vaults registered yet on the V2 PoR contract"
      message="Once the timelock window completes and the first vault is created via VaultCreated(...), the marker will appear on the map and the table will populate. Until then, every read here is correct: zero physical vaults."
      :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}#events`"
      hrefLabel="Watch VaultCreated events"
      icon="wait"
    />

    <template v-else-if="vaults.data.value">
      <VaultMap :vaults="vaults.data.value" />
      <VaultTable :vaults="vaults.data.value" />
    </template>
  </div>
</template>
