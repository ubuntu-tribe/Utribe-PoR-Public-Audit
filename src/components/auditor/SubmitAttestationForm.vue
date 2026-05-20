<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Contract } from "ethers";
import GlassCard from "@/components/ui/GlassCard.vue";
import { ADDRESSES, ATTESTATION_TYPES, METALS, TAAS_POR_ABI } from "@/config/chain";
import { POLYGONSCAN } from "@/config/env";
import { useWallet } from "@/composables/useWallet";
import { bumpPorRefetch } from "@/composables/usePor";

const wallet = useWallet();

interface FormState {
  symbol: "XAU" | "XAG";
  merkleRoot: string;
  ipfsHash: string;
  attestationType: number;
}

const form = reactive<FormState>({
  symbol: "XAU",
  merkleRoot: "",
  ipfsHash: "",
  attestationType: 0,
});

const submitting = ref(false);
const error = ref<string | null>(null);
const txHash = ref<string | null>(null);

const merkleRootError = computed(() => {
  if (!form.merkleRoot) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(form.merkleRoot)) return "Merkle root must be 0x + 64 hex characters.";
  return null;
});

const ipfsError = computed(() => {
  if (!form.ipfsHash) return null;
  // Minimal sanity check: CIDv0 (Qm…) or CIDv1 (bafy/bafkre…)
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[yk][a-z2-7]{50,})/.test(form.ipfsHash)) {
    return "Looks unlike a typical IPFS CID (Qm… or bafy…).";
  }
  return null;
});

const canSubmit = computed(() => {
  return wallet.account.value
    && wallet.isCorrectChain.value
    && form.merkleRoot
    && form.ipfsHash
    && !merkleRootError.value
    && !submitting.value;
});

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  const metal = METALS.find((m) => m.symbol === form.symbol);
  if (!metal) return;
  submitting.value = true;
  error.value = null;
  txHash.value = null;
  try {
    const signer = await wallet.getSigner();
    const por = new Contract(ADDRESSES.taasMultiMetalPoR, TAAS_POR_ABI, signer);
    const tx = await por.submitAttestation(metal.metalId, form.merkleRoot, form.ipfsHash, form.attestationType);
    txHash.value = tx.hash;
    await tx.wait();
    bumpPorRefetch();
    form.merkleRoot = "";
    form.ipfsHash = "";
  } catch (err) {
    error.value = (err as { shortMessage?: string; message?: string }).shortMessage
      ?? (err as { message?: string }).message
      ?? "Transaction failed";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <GlassCard>
    <h2 class="t-h2 mb-1">Submit attestation</h2>
    <p class="text-sm text-[var(--text-secondary)] mb-4">
      Posts a (merkleRoot, ipfsHash) tuple to <code class="t-mono text-xs">submitAttestation</code> on the V2 PoR contract.
      An independent auditor must then call <code class="t-mono text-xs">verifyAttestation</code> for the attestation to count.
    </p>

    <form class="grid grid-cols-1 md:grid-cols-2 gap-4" @submit.prevent="submit">
      <div>
        <label for="metalSelect">Metal</label>
        <select id="metalSelect" v-model="form.symbol" class="input mt-1">
          <option v-for="m in METALS" :key="m.symbol" :value="m.symbol">{{ m.name }} ({{ m.symbol }})</option>
        </select>
      </div>
      <div>
        <label for="attTypeSelect">Attestation type</label>
        <select id="attTypeSelect" v-model.number="form.attestationType" class="input mt-1">
          <option v-for="t in ATTESTATION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div class="md:col-span-2">
        <label for="merkleRoot">Merkle root</label>
        <input
          id="merkleRoot"
          v-model="form.merkleRoot"
          placeholder="0x…"
          class="input mt-1"
          spellcheck="false"
          autocomplete="off"
        />
        <p v-if="merkleRootError" class="text-xs text-[var(--danger)] mt-1">{{ merkleRootError }}</p>
      </div>
      <div class="md:col-span-2">
        <label for="ipfsHash">IPFS hash</label>
        <input
          id="ipfsHash"
          v-model="form.ipfsHash"
          placeholder="bafy… or Qm…"
          class="input mt-1"
          spellcheck="false"
          autocomplete="off"
        />
        <p v-if="ipfsError" class="text-xs text-[var(--warning)] mt-1">{{ ipfsError }}</p>
      </div>
      <div class="md:col-span-2 flex flex-wrap items-center gap-3">
        <button class="btn btn-primary" type="submit" :disabled="!canSubmit">
          {{ submitting ? "Submitting…" : "Submit attestation" }}
        </button>
        <a v-if="txHash"
          :href="`${POLYGONSCAN}/tx/${txHash}`"
          target="_blank"
          rel="noreferrer noopener"
          class="text-sm text-[var(--brand-secondary-400)] hover:underline"
        >View tx on Polygonscan</a>
        <span v-if="error" class="text-sm text-[var(--danger)]">{{ error }}</span>
      </div>
    </form>
  </GlassCard>
</template>
