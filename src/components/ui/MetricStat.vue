<script setup lang="ts">
interface Props {
  label: string;
  value: string;
  /** Smaller secondary line. */
  sub?: string | null;
  /** "gold" tints the value text gold; "gradient" uses brand gradient. */
  tone?: "default" | "gold" | "gradient";
  mono?: boolean;
  large?: boolean;
}
withDefaults(defineProps<Props>(), { sub: null, tone: "default", mono: false, large: false });
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="text-xs uppercase tracking-wider text-[var(--text-muted)]">{{ label }}</span>
    <span
      :class="[
        large ? 't-h1' : 't-h2',
        tone === 'gradient' && 'text-gradient',
        tone === 'gold' && 'text-gradient-gold',
        mono && 't-mono font-medium',
      ]"
    >
      {{ value }}
    </span>
    <span v-if="sub" class="text-sm text-[var(--text-secondary)]">{{ sub }}</span>
  </div>
</template>
