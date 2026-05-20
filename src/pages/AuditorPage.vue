<script setup lang="ts">
import { computed } from "vue";
import ConnectWallet from "@/components/auditor/ConnectWallet.vue";
import PendingAttestations from "@/components/auditor/PendingAttestations.vue";
import SubmitAttestationForm from "@/components/auditor/SubmitAttestationForm.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import { useAccountRef, useWallet } from "@/composables/useWallet";
import { useHasRole } from "@/composables/usePor";
import { ROLES } from "@/config/chain";

const wallet = useWallet();
const account = useAccountRef();

const hasAuditorRole = useHasRole(ROLES.AUDITOR_ROLE, account);

const showConsole = computed(() =>
  Boolean(wallet.account.value && wallet.isCorrectChain.value && hasAuditorRole.data.value)
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="t-h1">Auditor console</h1>
      <p class="text-[var(--text-secondary)] mt-2 max-w-3xl">
        Privileged console for wallets that hold the on-chain <code class="t-mono">AUDITOR_ROLE</code>.
        Submit a new attestation, or verify a pending one. All actions are signed by your wallet and broadcast directly to Polygon.
      </p>
    </header>

    <ConnectWallet />

    <div v-if="wallet.account.value" class="glass p-4 flex flex-wrap items-center gap-3">
      <span class="text-sm text-[var(--text-secondary)]">Role check (<code class="t-mono text-xs">hasRole(AUDITOR_ROLE, you)</code>):</span>
      <StatusPill
        v-if="hasAuditorRole.isPending.value"
        tone="muted"
        label="Checking…"
      />
      <StatusPill
        v-else-if="hasAuditorRole.data.value"
        tone="success"
        label="Auditor"
      />
      <StatusPill v-else tone="muted" label="View-only — no AUDITOR_ROLE on this wallet" />
    </div>

    <div
      class="glass p-4 border-[rgba(232,114,26,0.30)]"
      role="note"
    >
      <h3 class="t-h3 text-[var(--warning)] mb-1">Phase 2 note</h3>
      <p class="text-sm text-[var(--text-secondary)]">
        Reporting tooling (generating the Merkle root + IPFS report from a vault snapshot) is Phase 2 of the public audit stack.
        This console covers the on-chain <code class="t-mono">submitAttestation</code> /
        <code class="t-mono">verifyAttestation</code> calls only — you must supply a pre-computed merkle root and IPFS hash.
      </p>
    </div>

    <template v-if="showConsole">
      <PendingAttestations />
      <SubmitAttestationForm />
    </template>
    <template v-else-if="wallet.account.value && !wallet.isCorrectChain.value">
      <p class="text-sm text-[var(--text-secondary)]">Switch to Polygon to use the auditor console.</p>
    </template>
    <template v-else-if="wallet.account.value && hasAuditorRole.data.value === false">
      <p class="text-sm text-[var(--text-secondary)]">
        Your wallet does not have <code class="t-mono">AUDITOR_ROLE</code> — you can still browse the public Overview / Vaults / Events pages.
      </p>
    </template>
  </div>
</template>
