<script setup lang="ts">
import { useWallet } from "@/composables/useWallet";
import MonoAddress from "@/components/ui/MonoAddress.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

const wallet = useWallet();
</script>

<template>
  <div class="glass p-5 flex flex-col md:flex-row gap-3 md:items-center justify-between">
    <div>
      <h2 class="t-h3 mb-1">Wallet</h2>
      <p v-if="!wallet.isInstalled.value" class="text-sm text-[var(--text-secondary)]">
        No injected wallet detected. Install MetaMask, Rabby, Brave Wallet, or any EIP-1193 browser wallet.
      </p>
      <p v-else-if="!wallet.account.value" class="text-sm text-[var(--text-secondary)]">
        Connect a browser wallet to read your roles and (if authorized) submit attestations.
      </p>
      <div v-else class="text-sm flex flex-wrap items-center gap-2">
        <span class="text-[var(--text-secondary)]">Connected as</span>
        <MonoAddress :value="wallet.account.value" link="address" />
        <StatusPill
          :tone="wallet.isCorrectChain.value ? 'success' : 'warning'"
          :label="wallet.isCorrectChain.value ? 'Polygon · OK' : 'Wrong chain'"
        />
      </div>
      <p v-if="wallet.connectError.value" class="text-sm text-[var(--danger)] mt-1">{{ wallet.connectError.value }}</p>
    </div>
    <div class="flex gap-2">
      <button
        v-if="!wallet.account.value"
        class="btn btn-primary"
        type="button"
        :disabled="wallet.connecting.value || !wallet.isInstalled.value"
        @click="wallet.connect()"
      >{{ wallet.connecting.value ? "Connecting…" : "Connect wallet" }}</button>
      <button
        v-else-if="!wallet.isCorrectChain.value"
        class="btn btn-secondary"
        type="button"
        @click="wallet.switchToPolygon()"
      >Switch to Polygon</button>
      <button
        v-else
        class="btn btn-ghost"
        type="button"
        @click="wallet.disconnect()"
      >Disconnect</button>
    </div>
  </div>
</template>
