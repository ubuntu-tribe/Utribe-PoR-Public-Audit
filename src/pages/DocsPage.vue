<script setup lang="ts">
/**
 * Docs tab — renders docs/on-chain-reference.md inline plus a live RPC
 * playground so anyone landing here can verify and integrate without leaving.
 *
 * Content source: ../docs/on-chain-reference.md (Vite ?raw import). Editing
 * the .md file is the only place doc content lives.
 */

import { computed, ref, onMounted } from "vue";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite ?raw import returns a string; types unavailable for this glob.
import referenceMd from "../../docs/on-chain-reference.md?raw";

import GlassCard from "@/components/ui/GlassCard.vue";
import MonoAddress from "@/components/ui/MonoAddress.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import ErrorCard from "@/components/ui/ErrorCard.vue";

import { renderReferenceDoc } from "@/lib/markdown";
import { useGiftTotalSupply } from "@/composables/useGift";
import { useSupportedMetals, useVaultCount } from "@/composables/usePor";
import { formatWei } from "@/lib/format";
import { ADDRESSES, NETWORK } from "@/config/chain";
import { POLYGONSCAN } from "@/config/env";

// ── 1. Render the canonical reference doc ──────────────────────────────────
const rendered = computed(() => renderReferenceDoc(referenceMd as string));

// ── 2. Build a table-of-contents from rendered headings ────────────────────
interface TocEntry {
  id: string;
  text: string;
  level: number;
}
const toc = computed<TocEntry[]>(() =>
  rendered.value.headings.filter((h) => h.level === 2 || h.level === 3),
);
const activeId = ref<string>("");

onMounted(() => {
  if (typeof IntersectionObserver === "undefined") return;
  // Defer until rendered DOM exists.
  requestAnimationFrame(() => {
    const root = document.getElementById("docs-content");
    if (!root) return;
    const headings = Array.from(root.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
    if (headings.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the topmost-intersecting heading as active.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) activeId.value = visible.target.id;
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: [0, 1] },
    );
    for (const h of headings) obs.observe(h);
  });
});

function scrollToId(id: string, e?: Event) {
  e?.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  activeId.value = id;
}

// ── 3. Live RPC playground state ───────────────────────────────────────────
const giftQuery = useGiftTotalSupply();
const metalsQuery = useSupportedMetals();
const vaultsQuery = useVaultCount();

const reloadingGift = ref(false);
const reloadingMetals = ref(false);
const reloadingVaults = ref(false);

async function reloadGift() {
  reloadingGift.value = true;
  try { await giftQuery.refetch(); } finally { reloadingGift.value = false; }
}
async function reloadMetals() {
  reloadingMetals.value = true;
  try { await metalsQuery.refetch(); } finally { reloadingMetals.value = false; }
}
async function reloadVaults() {
  reloadingVaults.value = true;
  try { await vaultsQuery.refetch(); } finally { reloadingVaults.value = false; }
}

const giftSupplyFormatted = computed(() => {
  const v = giftQuery.data.value;
  if (v === undefined) return null;
  return { wei: v.toString(), tokens: formatWei(v) };
});

const supportedMetalsList = computed(() => metalsQuery.data.value ?? []);
const vaultCountValue = computed(() => vaultsQuery.data.value);
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
    <!-- ────────────────────  Main column  ──────────────────── -->
    <div class="min-w-0 flex flex-col gap-8">
      <!-- Intro -->
      <header class="flex flex-col gap-3">
        <p class="text-xs uppercase tracking-[0.18em] text-[var(--brand-primary-200)]">
          Documentation
        </p>
        <h1 class="t-display text-4xl md:text-5xl leading-tight">
          Verify the reserve yourself.
        </h1>
        <p class="text-[var(--text-secondary)] max-w-2xl">
          Every number this app shows is derived from public <code class="t-mono">eth_call</code>
          requests against the contracts below. No backend, no trust, no API keys.
          Reproduce any value with the snippets on this page.
        </p>
      </header>

      <!-- ──── Live playground (3 cards) ──── -->
      <section class="grid gap-4 md:grid-cols-3">
        <!-- GIFT total supply -->
        <GlassCard accent="gold">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              GIFT.totalSupply()
            </p>
            <button
              class="docs-reload-btn"
              :disabled="reloadingGift || giftQuery.isPending.value"
              @click="reloadGift"
              aria-label="Refresh GIFT total supply"
            >↻</button>
          </div>
          <Skeleton v-if="giftQuery.isPending.value" height="2.5rem" />
          <ErrorCard
            v-else-if="giftQuery.error.value"
            :error="giftQuery.error.value"
          />
          <div v-else-if="giftSupplyFormatted">
            <p class="t-mono text-2xl md:text-3xl font-semibold leading-snug">
              {{ giftSupplyFormatted.tokens }}
              <span class="text-base text-[var(--gold)]">GIFT</span>
            </p>
            <p class="t-mono text-xs text-[var(--text-muted)] mt-1 break-all">
              {{ giftSupplyFormatted.wei }} wei (18 dp)
            </p>
          </div>
        </GlassCard>

        <!-- supportedMetals -->
        <GlassCard accent="purple">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              PoR.supportedMetals()
            </p>
            <button
              class="docs-reload-btn"
              :disabled="reloadingMetals || metalsQuery.isPending.value"
              @click="reloadMetals"
              aria-label="Refresh supported metals"
            >↻</button>
          </div>
          <Skeleton v-if="metalsQuery.isPending.value" height="2.5rem" />
          <ErrorCard
            v-else-if="metalsQuery.error.value"
            :error="metalsQuery.error.value"
          />
          <div v-else>
            <p
              v-if="supportedMetalsList.length === 0"
              class="t-mono text-base text-[var(--text-secondary)] italic"
            >[] — none onboarded yet</p>
            <ul v-else class="t-mono text-sm flex flex-col gap-1">
              <li
                v-for="m in supportedMetalsList"
                :key="m"
                class="break-all text-[var(--brand-primary-200)]"
              >{{ m }}</li>
            </ul>
          </div>
        </GlassCard>

        <!-- vaultCount -->
        <GlassCard accent="cyan">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              PoR.vaultCount()
            </p>
            <button
              class="docs-reload-btn"
              :disabled="reloadingVaults || vaultsQuery.isPending.value"
              @click="reloadVaults"
              aria-label="Refresh vault count"
            >↻</button>
          </div>
          <Skeleton v-if="vaultsQuery.isPending.value" height="2.5rem" />
          <ErrorCard
            v-else-if="vaultsQuery.error.value"
            :error="vaultsQuery.error.value"
          />
          <p v-else class="t-mono text-3xl font-semibold">
            {{ vaultCountValue?.toString() ?? '0' }}
          </p>
        </GlassCard>
      </section>

      <!-- Contracts quick-card -->
      <GlassCard accent="purple">
        <h2 class="t-h3 mb-4">Contracts (Polygon mainnet, chain {{ NETWORK.chainId }})</h2>
        <dl class="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wider text-[var(--text-muted)]">GIFT Token</dt>
            <dd class="mt-1"><MonoAddress :value="ADDRESSES.giftToken" link="address" :short="false" /></dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-[var(--text-muted)]">TaaSMultiMetalPoR (proxy)</dt>
            <dd class="mt-1"><MonoAddress :value="ADDRESSES.taasMultiMetalPoR" link="address" :short="false" /></dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-[var(--text-muted)]">VGIFT1155MintController</dt>
            <dd class="mt-1"><MonoAddress :value="ADDRESSES.vgift1155MintController" link="address" :short="false" /></dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-[var(--text-muted)]">Public RPC</dt>
            <dd class="mt-1 t-mono break-all text-[var(--text-secondary)]">{{ NETWORK.rpcUrl }}</dd>
          </div>
        </dl>
        <p class="text-xs text-[var(--text-muted)] mt-4">
          Source-of-truth file:
          <a
            href="https://github.com/ubuntu-tribe/Utribe-PoR-Public-Audit/blob/main/docs/on-chain-reference.md"
            target="_blank"
            rel="noreferrer noopener"
            class="text-[var(--brand-primary-200)] hover:underline"
          >docs/on-chain-reference.md</a>
          on GitHub. If this page disagrees with the file, the file wins.
        </p>
      </GlassCard>

      <!-- ──── Rendered markdown ──── -->
      <article
        id="docs-content"
        class="docs-prose"
        v-html="rendered.html"
      />
    </div>

    <!-- ────────────────────  TOC sidebar  ──────────────────── -->
    <aside class="hidden lg:block">
      <nav
        class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
        aria-label="Table of contents"
      >
        <p class="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
          On this page
        </p>
        <ul class="flex flex-col gap-1 text-sm">
          <li
            v-for="entry in toc"
            :key="entry.id"
            :style="{ paddingLeft: entry.level === 3 ? '0.85rem' : '0' }"
          >
            <a
              :href="`#${entry.id}`"
              class="toc-link"
              :class="entry.id === activeId ? 'toc-link-active' : ''"
              @click="scrollToId(entry.id, $event)"
            >{{ entry.text }}</a>
          </li>
        </ul>
        <p class="text-xs text-[var(--text-muted)] mt-5">
          Open
          <a
            :href="`${POLYGONSCAN}/address/${ADDRESSES.taasMultiMetalPoR}#readProxyContract`"
            target="_blank"
            rel="noreferrer noopener"
            class="text-[var(--brand-primary-200)] hover:underline"
          >PoR on Polygonscan</a>
          for an interactive contract UI.
        </p>
      </nav>
    </aside>
  </div>
</template>

<style scoped>
.docs-reload-btn {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  transition: all 150ms ease;
}
.docs-reload-btn:hover:not(:disabled) {
  border-color: rgba(137,92,254,0.45);
  background: rgba(137,92,254,0.10);
  color: var(--text-primary);
}
.docs-reload-btn:disabled { opacity: 0.4; cursor: wait; }

.toc-link {
  display: block;
  padding: 0.30rem 0.55rem;
  border-radius: 8px;
  color: var(--text-secondary);
  border-left: 2px solid transparent;
  line-height: 1.35;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
}
.toc-link:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}
.toc-link-active {
  color: var(--text-primary);
  background: rgba(137,92,254,0.10);
  border-left-color: var(--brand-primary-500, #895CFE);
}
</style>

<!-- Unscoped — needed because markdown HTML is rendered via v-html -->
<style>
/* ───────── docs prose ───────── */
.docs-prose {
  color: var(--text-primary);
  font-size: 0.96rem;
  line-height: 1.62;
  max-width: 78ch;
}
.docs-prose h2 {
  margin-top: 2.5rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.45rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.55rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  scroll-margin-top: 5rem;
}
.docs-prose h3 {
  margin-top: 1.9rem;
  margin-bottom: 0.6rem;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.18rem;
  scroll-margin-top: 5rem;
}
.docs-prose h1 { display: none; } /* page already shows its own title */
.docs-prose p,
.docs-prose li {
  color: var(--text-primary);
}
.docs-prose p { margin: 0.7rem 0; }
.docs-prose strong { color: var(--text-primary); }
.docs-prose em { color: var(--text-secondary); }
.docs-prose blockquote {
  border-left: 3px solid rgba(94,220,231,0.6);
  background: rgba(94,220,231,0.05);
  padding: 0.65rem 1rem;
  margin: 1.1rem 0;
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}
.docs-prose blockquote p { margin: 0.3rem 0; }
.docs-prose a {
  color: var(--brand-primary-200, #CFB9FF);
  text-decoration: none;
  border-bottom: 1px solid rgba(207,185,255,0.25);
  transition: border-color 150ms ease;
}
.docs-prose a:hover { border-bottom-color: rgba(207,185,255,0.65); }
.docs-prose ul,
.docs-prose ol {
  padding-left: 1.4rem;
  margin: 0.7rem 0;
}
.docs-prose ul { list-style: disc; }
.docs-prose ol { list-style: decimal; }
.docs-prose li { margin: 0.2rem 0; }

/* Inline code */
.docs-prose code:not(.hljs) {
  font-family: var(--font-mono);
  font-size: 0.86em;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0.08em 0.4em;
  border-radius: 5px;
  color: var(--brand-secondary-300, #75F7FF);
  word-break: break-word;
}

/* Tables */
.docs-prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.1rem 0;
  font-size: 0.88rem;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  overflow: hidden;
  display: block;
  max-width: 100%;
  overflow-x: auto;
}
.docs-prose thead { background: rgba(137,92,254,0.10); }
.docs-prose th,
.docs-prose td {
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  text-align: left;
  vertical-align: top;
}
.docs-prose th {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}
.docs-prose tbody tr:last-child td { border-bottom: 0; }
.docs-prose tbody tr:hover { background: rgba(255,255,255,0.02); }
.docs-prose table code:not(.hljs) {
  font-size: 0.78rem;
}

/* Anchor permalinks */
.docs-prose .header-anchor {
  margin-right: 0.45rem;
  color: var(--text-muted);
  opacity: 0;
  text-decoration: none;
  border-bottom: 0 !important;
  transition: opacity 150ms ease;
  font-weight: 400;
}
.docs-prose h2:hover .header-anchor,
.docs-prose h3:hover .header-anchor { opacity: 0.85; }
.docs-prose .header-anchor:hover { color: var(--brand-primary-300); }

/* Horizontal rules */
.docs-prose hr {
  border: 0;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 2rem 0;
}

/* Code blocks (highlight.js minimal dark theme) */
.docs-prose pre.hljs,
.docs-prose pre {
  background: var(--surface-2, #18181E);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 0.95rem 1.05rem;
  margin: 1rem 0;
  overflow-x: auto;
  font-size: 0.84rem;
  line-height: 1.55;
}
.docs-prose pre code,
.docs-prose pre.hljs code {
  font-family: var(--font-mono);
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--text-primary);
  font-size: 0.84rem;
}

/* highlight.js tokens — minimal palette tuned for dark surfaces */
.docs-prose .hljs-comment,
.docs-prose .hljs-quote { color: #6B6878; font-style: italic; }
.docs-prose .hljs-keyword,
.docs-prose .hljs-selector-tag,
.docs-prose .hljs-built_in { color: #B797FF; }
.docs-prose .hljs-string,
.docs-prose .hljs-attr,
.docs-prose .hljs-meta-string { color: #2DD98F; }
.docs-prose .hljs-number,
.docs-prose .hljs-literal,
.docs-prose .hljs-symbol { color: #F5CF59; }
.docs-prose .hljs-title,
.docs-prose .hljs-class .hljs-title,
.docs-prose .hljs-name,
.docs-prose .hljs-section { color: #5EDCE7; }
.docs-prose .hljs-variable,
.docs-prose .hljs-template-variable,
.docs-prose .hljs-params { color: #E9D8FD; }
.docs-prose .hljs-type,
.docs-prose .hljs-meta { color: #75F7FF; }
.docs-prose .hljs-regexp,
.docs-prose .hljs-deletion { color: #FF5E6A; }
.docs-prose .hljs-addition { color: #2DD98F; }
.docs-prose .hljs-emphasis { font-style: italic; }
.docs-prose .hljs-strong { font-weight: bold; }
</style>
