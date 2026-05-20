<script setup lang="ts">
import { computed } from "vue";
import { POLYGONSCAN } from "@/config/env";
import { shortAddress, shortHash } from "@/lib/format";

interface Props {
  value: string | null | undefined;
  /** Render link to Polygonscan. */
  link?: "address" | "tx" | "none";
  short?: boolean;
}
const props = withDefaults(defineProps<Props>(), { link: "none", short: true });

const display = computed(() => {
  if (!props.value) return "—";
  if (!props.short) return props.value;
  return props.link === "tx" ? shortHash(props.value) : shortAddress(props.value);
});

const href = computed(() => {
  if (!props.value) return null;
  if (props.link === "address") return `${POLYGONSCAN}/address/${props.value}`;
  if (props.link === "tx") return `${POLYGONSCAN}/tx/${props.value}`;
  return null;
});
</script>

<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noreferrer noopener"
    class="t-mono text-sm text-[var(--brand-primary-200)] hover:text-[var(--brand-primary-50)] underline-offset-2 hover:underline"
  >
    {{ display }}
  </a>
  <span v-else class="t-mono text-sm text-[var(--text-secondary)]">{{ display }}</span>
</template>
