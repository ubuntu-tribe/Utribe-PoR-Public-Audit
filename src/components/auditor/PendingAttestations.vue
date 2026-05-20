<script setup lang="ts">
import { computed, ref } from "vue";
import { Contract } from "ethers";
import GlassCard from "@/components/ui/GlassCard.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import MonoAddress from "@/components/ui/MonoAddress.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useLatestAttestation, bumpPorRefetch } from "@/composables/usePor";
import { useWallet } from "@/composables/useWallet";
import { ADDRESSES, METALS, TAAS_POR_ABI, ATTESTATION_TYPES } from "@/config/chain";
import { IPFS_GATEWAY, POLYGONSCAN } from "@/config/env";
import { formatTimestamp } from "@/lib/format";

const wallet = useWallet();

const attXAU = useLatestAttestation("XAU");
const attXAG = useLatestAttestation("XAG");

const submitting = ref<string | null>(null);
const submitError = ref<string | null>(null);
const submitTx = ref<string | null>(null);

const pendingAttestations = computed(() => {
  const out: { symbol: "XAU" | "XAG"; att: NonNullable<typeof attXAU.data.value> }[] = [];
  if (attXAU.data.value && !attXAU.data.value.verified) out.push({ symbol: "XAU", att: attXAU.data.value });
  if (attXAG.data.value && !attXAG.data.value.verified) out.push({ symbol: "XAG", att: attXAG.data.value });
  return out;
});

async function verify(symbol: "XAU" | "XAG"): Promise<void> {
  const metal = METALS.find((m) => m.symbol === symbol);
  const list = symbol === "XAU" ? attXAU.data.value : attXAG.data.value;
  if (!metal || !list) return;
  submitting.value = symbol;
  submitError.value = null;
  submitTx.value = null;
  try {
    const signer = await wallet.getSigner();
    const por = new Contract(ADDRESSES.taasMultiMetalPoR, TAAS_POR_ABI, signer);
    const tx = await por.verifyAttestation(metal.metalId, list.id, list.merkleRoot, list.ipfsHash);
    submitTx.value = tx.hash;
    await tx.wait();
    bumpPorRefetch();
    // Refetch the two relevant queries
    await Promise.all([attXAU.refetch(), attXAG.refetch()]);
  } catch (err) {
    submitError.value = (err as { shortMessage?: string; message?: string }).shortMessage
      ?? (err as { message?: string }).message
      ?? "Transaction failed";
  } finally {
    submitting.value = null;
  }
}

function attestationTypeLabel(t: number): string {
  return ATTESTATION_TYPES.find((x) => x.value === t)?.label ?? `#${t}`;
}
</script>

<template>
  <section>
    <h2 class="t-h2 mb-3">Pending attestations</h2>

    <EmptyState
      v-if="pendingAttestations.length === 0 && !attXAU.isPending.value && !attXAG.isPending.value"
      title="No pending attestations"
      message="All submitted attestations are verified, or none have been submitted yet."
      icon="info"
    />

    <div v-else class="flex flex-col gap-4">
      <GlassCard v-for="row in pendingAttestations" :key="row.symbol">
        <header class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-3">
            <h3 class="t-h3">{{ row.symbol }} · Attestation #{{ row.att.id.toString() }}</h3>
            <StatusPill tone="warning" label="Pending verification" />
          </div>
          <span class="text-xs text-[var(--text-secondary)]">Submitted {{ formatTimestamp(row.att.timestamp) }}</span>
        </header>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
          <div>
            <dt class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Custodian</dt>
            <dd><MonoAddress :value="row.att.custodian" link="address" /></dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Type</dt>
            <dd>{{ attestationTypeLabel(row.att.attestationType) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Merkle root</dt>
            <dd class="t-mono text-xs break-all">{{ row.att.merkleRoot }}</dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--text-muted)] uppercase tracking-wider">IPFS report</dt>
            <dd>
              <a
                class="t-mono text-xs text-[var(--brand-primary-200)] hover:underline break-all"
                :href="`${IPFS_GATEWAY}/${row.att.ipfsHash}`"
                target="_blank"
                rel="noreferrer noopener"
              >{{ row.att.ipfsHash }}</a>
            </dd>
          </div>
        </dl>
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="btn btn-primary"
            type="button"
            :disabled="submitting !== null"
            @click="verify(row.symbol)"
          >{{ submitting === row.symbol ? "Verifying…" : "Verify attestation" }}</button>
          <a v-if="submitTx"
            :href="`${POLYGONSCAN}/tx/${submitTx}`"
            target="_blank"
            rel="noreferrer noopener"
            class="text-sm text-[var(--brand-secondary-400)] hover:underline"
          >View tx on Polygonscan</a>
          <span v-if="submitError" class="text-sm text-[var(--danger)]">{{ submitError }}</span>
        </div>
      </GlassCard>
    </div>
  </section>
</template>
