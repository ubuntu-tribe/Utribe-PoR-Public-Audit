<script setup lang="ts">
import { computed } from "vue";
import GlassCard from "@/components/ui/GlassCard.vue";
import MetricStat from "@/components/ui/MetricStat.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ErrorCard from "@/components/ui/ErrorCard.vue";
import MonoAddress from "@/components/ui/MonoAddress.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { useMetalOverview, useLatestVerifiedAttestation } from "@/composables/usePor";
import { ADDRESSES, type MetalDescriptor } from "@/config/chain";
import { IPFS_GATEWAY, POLYGONSCAN } from "@/config/env";
import { bpsToPct, formatMg, formatTimestamp, formatUsd6, mgToGrams, mgToTroyOz } from "@/lib/format";

interface Props { metal: MetalDescriptor }
const props = defineProps<Props>();

const overview = useMetalOverview(props.metal.symbol);
const att = useLatestVerifiedAttestation(props.metal.symbol);

const isNotBootstrapped = computed(() => {
  if (overview.isPending.value) return false;
  return overview.data.value === null;
});
</script>

<template>
  <GlassCard :accent="metal.accent === 'gold' ? 'gold' : 'cyan'">
    <header class="flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <span
          class="size-9 rounded-full flex items-center justify-center font-bold t-mono"
          :class="metal.accent === 'gold' ? 'bg-[rgba(245,207,89,0.10)] text-[var(--gold-500)]' : 'bg-[rgba(94,220,231,0.10)] text-[var(--brand-secondary-400)]'"
          aria-hidden="true"
        >{{ metal.symbol === 'XAU' ? 'Au' : 'Ag' }}</span>
        <div>
          <h2 class="t-h2">{{ metal.name }}</h2>
          <p class="t-mono text-xs text-[var(--text-muted)]">{{ metal.symbol }} · metalId {{ metal.metalId.slice(0, 10) }}…</p>
        </div>
      </div>
      <StatusPill
        v-if="overview.data.value"
        :tone="overview.data.value.isReserveAdequate ? 'success' : 'danger'"
        :label="overview.data.value.isReserveAdequate ? 'Reserve adequate' : 'Reserve insufficient'"
      />
    </header>

    <!-- Loading -->
    <div v-if="overview.isPending.value" class="grid grid-cols-2 gap-4">
      <Skeleton v-for="i in 6" :key="i" height="3.5rem" />
    </div>

    <!-- Empty state: metal not onboarded -->
    <EmptyState
      v-else-if="isNotBootstrapped"
      title="Not yet bootstrapped"
      :message="`The ${metal.name} (${metal.symbol}) reserve is not yet active on the V2 PoR contract. The contract is deployed, but no metal vaults have been registered yet. Reserve reads scoped by metalId will revert with MetalNotSupported until onboarding completes.`"
      :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}#readProxyContract`"
      icon="wait"
    />

    <!-- Error -->
    <ErrorCard v-else-if="overview.isError.value" :error="overview.error.value" />

    <!-- Data -->
    <div v-else-if="overview.data.value" class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-5">
      <MetricStat
        label="Reserve (fine metal)"
        :value="formatMg(overview.data.value.totalReserveMetalMg)"
        :sub="`${mgToGrams(overview.data.value.totalReserveMetalMg)} · ${mgToTroyOz(overview.data.value.totalReserveMetalMg)}`"
        :tone="metal.accent === 'gold' ? 'gold' : 'default'"
      />
      <MetricStat
        label="Token supply (mg)"
        :value="formatMg(overview.data.value.totalTokenSupplyMg)"
        :sub="overview.data.value.totalTokenSupplyMg > 0n ? mgToGrams(overview.data.value.totalTokenSupplyMg) : 'No tokens minted'"
      />
      <MetricStat
        label="Reserve ratio"
        :value="bpsToPct(overview.data.value.reserveRatioBps)"
        :sub="`${overview.data.value.reserveRatioBps.toString()} bps`"
      />
      <MetricStat
        label="Mint capacity"
        :value="formatMg(overview.data.value.mintCapacityMg)"
        :sub="overview.data.value.mintCapacityMg > 0n ? mgToGrams(overview.data.value.mintCapacityMg) : null"
      />
      <MetricStat
        label="Reserve USD"
        :value="formatUsd6(overview.data.value.reserveUsd6)"
        :sub="overview.data.value.reserveUsd6 === 0n ? 'Oracle unset or stale' : null"
      />
    </div>

    <!-- Latest verified attestation -->
    <section class="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)]">
      <p class="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Latest verified attestation</p>
      <div v-if="att.isPending.value">
        <Skeleton height="3rem" />
      </div>
      <p v-else-if="att.data.value === null" class="text-sm text-[var(--text-secondary)]">
        No verified attestation recorded yet for {{ metal.symbol }}.
      </p>
      <ErrorCard v-else-if="att.isError.value" :error="att.error.value" />
      <div v-else-if="att.data.value" class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="t-mono text-[var(--text-secondary)]">#{{ att.data.value.id.toString() }}</span>
          <span class="text-[var(--text-secondary)]">{{ formatTimestamp(att.data.value.timestamp) }}</span>
          <StatusPill tone="success" label="Verified" />
        </div>
        <div class="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-3">
          <span>Auditor:</span>
          <MonoAddress :value="att.data.value.auditor" link="address" />
          <span>Custodian:</span>
          <MonoAddress :value="att.data.value.custodian" link="address" />
          <a
            class="text-[var(--brand-primary-200)] hover:text-[var(--brand-primary-50)] underline-offset-2 hover:underline"
            :href="`${IPFS_GATEWAY}/${att.data.value.ipfsHash}`"
            target="_blank"
            rel="noreferrer noopener"
          >Report (IPFS)</a>
        </div>
      </div>
    </section>
  </GlassCard>
</template>
