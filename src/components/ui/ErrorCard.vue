<script setup lang="ts">
import type { ClassifiedError } from "@/lib/errors";

interface Props {
  error: ClassifiedError | Error | null | undefined;
  title?: string;
}
withDefaults(defineProps<Props>(), { title: "Couldn't load this section" });

function isClassified(e: unknown): e is ClassifiedError {
  return Boolean(e && typeof e === "object" && "kind" in (e as Record<string, unknown>));
}
</script>

<template>
  <div class="glass p-5 border-[rgba(255,94,106,0.25)]" role="alert">
    <h3 class="t-h3 text-[var(--danger)] mb-2">{{ title }}</h3>
    <p class="text-sm text-[var(--text-secondary)] mb-2">
      <template v-if="error">{{ error.message }}</template>
      <template v-else>An unknown error occurred.</template>
    </p>
    <p v-if="error && isClassified(error) && error.selector" class="t-mono text-xs text-[var(--text-muted)]">
      selector: {{ error.selector }}
    </p>
    <p v-if="error && isClassified(error) && error.raw && error.raw !== error.selector" class="t-mono text-xs text-[var(--text-muted)] break-all">
      data: {{ error.raw.slice(0, 80) }}{{ error.raw.length > 80 ? '…' : '' }}
    </p>
  </div>
</template>
