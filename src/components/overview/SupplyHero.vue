<script setup lang="ts">
import { computed } from "vue";
import { useGiftTotalSupply } from "@/composables/useGift";
import { formatWei } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton.vue";

const supplyQuery = useGiftTotalSupply();

const display = computed(() => {
  const value = supplyQuery.data.value;
  return value !== undefined ? formatWei(value) : null;
});
</script>

<template>
  <section class="glass p-6 md:p-8 relative overflow-hidden">
    <div class="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(137,92,254,0.25)_0%,transparent_70%)]" aria-hidden="true"></div>
    <div class="relative">
      <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">GIFT total supply (live · Polygon)</p>
      <div v-if="supplyQuery.isPending.value" class="space-y-2">
        <Skeleton height="2.75rem" width="22rem" />
        <Skeleton height="1rem" width="14rem" />
      </div>
      <div v-else-if="supplyQuery.isError.value" class="text-[var(--danger)]">
        Failed to load GIFT supply: {{ supplyQuery.error.value?.message }}
      </div>
      <div v-else>
        <h1 class="t-display text-gradient-gold">{{ display }} <span class="text-[var(--text-primary)] text-xl ml-2">GIFT</span></h1>
        <p class="text-sm text-[var(--text-secondary)] mt-2">
          ERC-20 outstanding tokens on Polygon mainnet. Compare against the per-metal reserve below to verify the backing invariant.
        </p>
      </div>
    </div>
  </section>
</template>
