<script setup lang="ts">
import { useWallet } from "@/composables/useWallet";
import { NETWORK } from "@/config/chain";

const wallet = useWallet();

async function handleSwitch(): Promise<void> {
  try { await wallet.switchToPolygon(); } catch { /* user rejected — ignore */ }
}
</script>

<template>
  <div
    v-if="wallet.account.value && !wallet.isCorrectChain.value"
    class="bg-[rgba(232,114,26,0.12)] border-b border-[rgba(232,114,26,0.32)] text-[var(--warning)]"
    role="alert"
  >
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-2 flex flex-col md:flex-row items-start md:items-center gap-2 justify-between">
      <p class="text-sm">
        Wallet is on the wrong chain. Public audit reads run on Polygon (chain {{ NETWORK.chainId }}).
      </p>
      <button class="btn btn-secondary text-xs" @click="handleSwitch">Switch to Polygon</button>
    </div>
  </div>
</template>
