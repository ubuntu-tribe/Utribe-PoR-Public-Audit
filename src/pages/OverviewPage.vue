<script setup lang="ts">
import { computed } from "vue";
import SupplyHero from "@/components/overview/SupplyHero.vue";
import MetalCard from "@/components/overview/MetalCard.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import GlassCard from "@/components/ui/GlassCard.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { useSupportedMetals, useVaultCount } from "@/composables/usePor";
import { ADDRESSES, METALS } from "@/config/chain";
import { POLYGONSCAN } from "@/config/env";

const supportedMetals = useSupportedMetals();
const vaultCount = useVaultCount();

const isEmpty = computed(() => {
  return supportedMetals.data.value !== undefined && supportedMetals.data.value.length === 0;
});
</script>

<template>
  <div class="flex flex-col gap-8">
    <SupplyHero />

    <!-- Bootstrap-empty state -->
    <EmptyState
      v-if="isEmpty"
      title="Contract deployed, no metals onboarded yet"
      message="The TaaSMultiMetalPoR proxy is live on Polygon mainnet, but no metals (XAU, XAG) have been registered via MetalSupported yet. The contract enters its operational state once the timelock window completes and the first vault is registered. Per-metal reserve reads will revert with MetalNotSupported until then."
      :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}#events`"
      hrefLabel="View contract events on Polygonscan"
      icon="wait"
    />

    <!-- Per-metal cards -->
    <section v-else class="grid gap-5 md:grid-cols-2">
      <MetalCard v-for="m in METALS" :key="m.symbol" :metal="m" />
    </section>

    <!-- Quick stats footer -->
    <GlassCard accent="none">
      <h3 class="t-h3 mb-3">Contract status</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">Supported metals</p>
          <Skeleton v-if="supportedMetals.isPending.value" height="1.5rem" width="6rem" class="mt-1" />
          <p v-else class="t-mono">{{ supportedMetals.data.value?.length ?? 0 }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">Total vaults</p>
          <Skeleton v-if="vaultCount.isPending.value" height="1.5rem" width="6rem" class="mt-1" />
          <p v-else class="t-mono">{{ vaultCount.data.value?.toString() ?? '0' }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">PoR V2 proxy</p>
          <a
            class="t-mono text-sm text-[var(--brand-primary-200)] hover:underline break-all"
            :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}`"
            target="_blank"
            rel="noreferrer noopener"
          >{{ ADDRESSES.taasMultiMetalPoR }}</a>
        </div>
      </div>
    </GlassCard>
  </div>
</template>
