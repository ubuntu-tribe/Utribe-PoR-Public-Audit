<script setup lang="ts">
interface Props {
  title: string;
  message?: string | null;
  icon?: "info" | "wait" | "warn" | "error";
  /** Optional anchor button to Polygonscan or docs. */
  href?: string | null;
  hrefLabel?: string | null;
}
withDefaults(defineProps<Props>(), {
  message: null,
  icon: "info",
  href: null,
  hrefLabel: "View on Polygonscan",
});
</script>

<template>
  <div class="glass p-6 flex flex-col items-start gap-3" role="status">
    <div class="flex items-center gap-2">
      <span
        class="size-8 rounded-full flex items-center justify-center text-base"
        :class="{
          'bg-[rgba(94,220,231,0.10)] text-[var(--brand-secondary-400)]': icon === 'info',
          'bg-[rgba(245,207,89,0.10)] text-[var(--gold-500)]': icon === 'wait',
          'bg-[rgba(232,114,26,0.12)] text-[var(--warning)]': icon === 'warn',
          'bg-[rgba(255,94,106,0.10)] text-[var(--danger)]': icon === 'error',
        }"
        aria-hidden="true"
      >
        <span v-if="icon === 'info'">i</span>
        <span v-else-if="icon === 'wait'">⌛</span>
        <span v-else-if="icon === 'warn'">!</span>
        <span v-else>×</span>
      </span>
      <h3 class="t-h3">{{ title }}</h3>
    </div>
    <p v-if="message" class="text-sm text-[var(--text-secondary)] leading-relaxed">{{ message }}</p>
    <a
      v-if="href"
      :href="href"
      target="_blank"
      rel="noreferrer noopener"
      class="btn btn-secondary"
    >{{ hrefLabel }}</a>
    <slot />
  </div>
</template>
