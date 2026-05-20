<script setup lang="ts">
import { RouterView } from "vue-router";
import AppHeader from "@/components/layout/AppHeader.vue";
import AppFooter from "@/components/layout/AppFooter.vue";
import NetworkBanner from "@/components/layout/NetworkBanner.vue";
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <NetworkBanner />
    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <RouterView v-slot="{ Component }">
          <Suspense>
            <component :is="Component" />
            <template #fallback>
              <p class="text-[var(--text-secondary)]">Loading…</p>
            </template>
          </Suspense>
        </RouterView>
      </div>
    </main>
    <AppFooter />
  </div>
</template>
