<script setup lang="ts">
interface Props {
  label: string;
  active: boolean;
}
defineProps<Props>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="active && 'chip-active'"
    :aria-pressed="active"
    @click="$emit('click')"
  >{{ label }}</button>
</template>

<style scoped>
.chip {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text-secondary);
  transition: all 150ms ease;
  cursor: pointer;
  white-space: nowrap;
}
.chip:hover { color: var(--text-primary); border-color: rgba(255,255,255,0.18); }
.chip-active {
  color: #fff;
  background: rgba(137,92,254,0.16);
  border-color: rgba(137,92,254,0.46);
}
</style>
