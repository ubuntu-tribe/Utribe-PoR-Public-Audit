<script setup lang="ts">
interface Props { height?: string; width?: string; rounded?: string; }
withDefaults(defineProps<Props>(), { height: "1rem", width: "100%", rounded: "8px" });
</script>

<template>
  <div
    class="skeleton"
    :style="{ height, width, borderRadius: rounded }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
