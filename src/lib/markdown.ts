/**
 * markdown.ts — single source of truth for in-app docs rendering.
 *
 * We import the project-root `docs/on-chain-reference.md` as a raw string
 * via Vite's `?raw` query so the in-app Docs tab stays byte-for-byte in
 * sync with the doc file we publish on GitHub. Editing the .md file is the
 * only place doc content lives.
 */

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import ts from "highlight.js/lib/languages/typescript";
import js from "highlight.js/lib/languages/javascript";
import sol from "highlight.js/lib/languages/scilab"; // closest stock language; Solidity not in core
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("typescript", ts);
hljs.registerLanguage("ts", ts);
hljs.registerLanguage("javascript", js);
hljs.registerLanguage("js", js);
hljs.registerLanguage("json", json);
// Solidity isn't in highlight.js core — register a thin alias so ```solidity blocks
// still render (just without keyword colouring). They keep the mono font + box.
hljs.registerLanguage("solidity", sol);

export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface RenderedDoc {
  html: string;
  headings: Heading[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Render the canonical reference markdown into safe HTML plus a heading list
 * suitable for a table-of-contents sidebar.
 */
export function renderReferenceDoc(source: string): RenderedDoc {
  const md = new MarkdownIt({
    html: false,        // raw HTML disabled — we own the source so this is just defense-in-depth
    linkify: true,      // auto-link bare URLs
    breaks: false,
    typographer: false,
    highlight(code: string, lang: string): string {
      const language = (lang || "").toLowerCase();
      try {
        if (language && hljs.getLanguage(language)) {
          return `<pre class="hljs"><code class="hljs language-${language}">${
            hljs.highlight(code, { language, ignoreIllegals: true }).value
          }</code></pre>`;
        }
      } catch {
        /* fall through to plain */
      }
      return `<pre class="hljs"><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`;
    },
  });

  // Open external links in a new tab.
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx]?.attrGet("href") ?? "";
    if (/^https?:\/\//.test(href)) {
      tokens[idx]?.attrSet("target", "_blank");
      tokens[idx]?.attrSet("rel", "noreferrer noopener");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  const headings: Heading[] = [];
  md.use(anchor, {
    level: [2, 3],
    permalink: anchor.permalink.linkInsideHeader({
      symbol: "#",
      placement: "before",
      ariaHidden: true,
    }),
    slugify,
    callback: (token, info) => {
      headings.push({
        id: info.slug,
        text: info.title,
        level: token.markup.length, // # count
      });
    },
  });

  const html = md.render(source);
  return { html, headings };
}
