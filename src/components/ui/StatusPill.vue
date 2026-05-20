<script setup lang="ts">
interface Props {
  tone: "success" | "danger" | "warning" | "info" | "muted";
  label: string;
}
defineProps<Props>();
</script>

<template>
  <span
    :class="[
      'pill',
      tone === 'success' && 'pill-success',
      tone === 'danger' && 'pill-danger',
      tone === 'warning' && 'pill-warning',
      tone === 'info' && 'pill-info',
      tone === 'muted' && 'pill-muted',
    ]"
  >
    <span class="size-1.5 rounded-full" :class="dotClass(tone)" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>

<script lang="ts">
function dotClass(tone: string): string {
  switch (tone) {
    case "success": return "bg-[var(--success)]";
    case "danger": return "bg-[var(--danger)]";
    case "warning": return "bg-[var(--warning)]";
    case "info": return "bg-[var(--brand-secondary-400)]";
    default: return "bg-[var(--text-muted)]";
  }
}
</script>
