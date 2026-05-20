<script setup lang="ts">
interface Props {
  /** Optional accent color for the top border glow. */
  accent?: "purple" | "gold" | "cyan" | "none";
  padded?: boolean;
}
withDefaults(defineProps<Props>(), { accent: "purple", padded: true });
</script>

<template>
  <div
    class="glass glass-hover relative"
    :class="[
      padded ? 'p-5 md:p-6' : '',
      accent === 'purple' && 'glass-accent-purple',
      accent === 'gold' && 'glass-accent-gold',
      accent === 'cyan' && 'glass-accent-cyan',
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.glass-accent-purple { border-color: rgba(137,92,254,0.20); }
.glass-accent-gold   { border-color: rgba(245,207,89,0.25); }
.glass-accent-cyan   { border-color: rgba(94,220,231,0.22); }
</style>
