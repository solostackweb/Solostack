#!/usr/bin/env node

/**
 * Guardrail for the design system (see design-system/MASTER.md).
 *
 * A standard without enforcement decays. Before this project had one, the
 * codebase had accumulated 1,201 raw palette classes, 774 arbitrary font
 * sizes and seven competing corner radii — none of it deliberate, all of it
 * added one reasonable-looking line at a time.
 *
 * This script fails on *new* drift. It is not a linter for taste; it checks
 * four rules that are objectively decidable:
 *
 *   1. No raw Tailwind palette colours   (use semantic tokens)
 *   2. No arbitrary font sizes            (use the type scale)
 *   3. No retired corner radii            (sm / lg / 2xl / full only)
 *   4. No hex literals in components      (use tokens, or config/brand-colors)
 *
 * Every exception is listed explicitly below with a reason. If you need a new
 * one, add it here rather than working around the check — the list is the
 * audit trail.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const BASELINE_PATH = join(process.cwd(), "scripts/design-tokens-baseline.json");
const UPDATING = process.argv.includes("--update-baseline");

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * Files exempt from the colour rules, each for a stated reason. These are
 * genuine cases where a CSS token cannot reach, not places we gave up.
 */
const EXEMPT = new Map([
  // Public client-facing documents deliberately force a light palette so an
  // invoice looks identical regardless of the freelancer's theme.
  ["src/app/w/[token]/page.tsx", "forced light document palette"],
  ["src/features/meetings/components/meeting-confirm-view.tsx", "forced light document palette"],
  ["src/features/questionnaires/components/questionnaire-fill-view.tsx", "forced light document palette"],
  // Renders when the app (and its stylesheet) has failed; must be inline.
  ["src/app/global-error.tsx", "root error boundary, no stylesheet available"],
  // ImageResponse renders at the edge with inline styles and no CSS.
  ["src/app/opengraph-image.tsx", "edge ImageResponse"],
  ["src/app/twitter-image.tsx", "edge ImageResponse"],
  ["src/app/api/pwa-icon/[size]/route.ts", "edge ImageResponse"],
  // Must byte-match background_color in the web manifest.
  ["src/components/loading/pwa-splash.tsx", "must match manifest background_color"],
  // The single home for literal brand values.
  ["src/config/brand-colors.ts", "the brand colour constants themselves"],
  // Colour picker swatch data, and PDF/email themes which cannot use CSS vars.
  ["src/app/(dashboard)/dashboard/settings/branding/page.tsx", "colour picker swatch data"],
  ["src/features/documents/pdf/theme.ts", "PDF renderer, no CSS variables"],
  ["src/features/email/templates.ts", "email HTML, no CSS variables"],
]);

/** Third-party brand marks that must not be recoloured. */
const BRAND_LITERALS = /#(25D366|128C7E|1ebe5d|1EBE5D)/i;

const RULES = [
  {
    id: "raw-palette",
    // Tailwind palette colours bypass the semantic tokens, so dark mode and
    // any future restyle silently skip them.
    // Gradient utilities (from-/via-/to-) are deliberately excluded. A brand
    // gradient is decorative expression, not a semantic role, and there is no
    // honest token for "the middle stop of the hero wash".
    re: /\b(?:text|bg|border|ring)-(?:slate|gray|zinc|neutral|stone|emerald|green|amber|yellow|red|rose|blue|sky|indigo|violet|purple|teal|cyan)-\d{2,3}\b/g,
    message: "raw palette colour — use a semantic token (bg-card, text-muted-foreground, bg-success-subtle …)",
    colourRule: true,
  },
  {
    id: "arbitrary-font-size",
    re: /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
    message: "arbitrary font size — use the type scale (text-micro … text-6xl)",
  },
  {
    id: "retired-radius",
    re: /\brounded(?:-[tblr]{1,2})?-(?:md|xl|3xl)\b/g,
    message: "retired radius — use rounded-sm, rounded-lg, rounded-2xl or rounded-full",
  },
  {
    id: "hex-literal",
    re: /#[0-9a-fA-F]{6}\b/g,
    message: "hex literal — use a token, or import from @/config/brand-colors",
    colourRule: true,
  },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) files.push(full);
  }
  return files;
}

const violations = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split("\\").join("/");
  const exemptReason = EXEMPT.get(rel);
  // Strip comments before scanning. Documentation that *names* a banned class
  // ("use bg-success-subtle instead of bg-emerald-500/10") is guidance, not
  // drift — flagging it would punish explaining the rule.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  for (const rule of RULES) {
    if (exemptReason && rule.colourRule) continue;
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(source)) !== null) {
      if (rule.id === "hex-literal" && BRAND_LITERALS.test(match[0])) continue;
      const line = source.slice(0, match.index).split("\n").length;
      violations.push({ rel, line, token: match[0], message: rule.message });
    }
  }
}

// Count per file, so the baseline is stable against unrelated edits.
const counts = {};
for (const v of violations) counts[v.rel] = (counts[v.rel] ?? 0) + 1;

if (UPDATING) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + "\n");
  const total = violations.length;
  console.log(`✓ baseline written: ${Object.keys(counts).length} file(s), ${total} known violation(s)`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : {};

const regressions = [];
for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) regressions.push({ file, count, allowed });
}

const total = violations.length;
const knownTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (regressions.length === 0) {
  const delta = knownTotal - total;
  console.log(
    `✓ design tokens: no new drift (${total} known` +
      (delta > 0 ? `, ${delta} fewer than baseline — run --update-baseline to lock it in` : "") +
      ")",
  );
  process.exit(0);
}

console.error(`✗ design tokens: new drift in ${regressions.length} file(s)\n`);
for (const r of regressions) {
  console.error(`  ${r.file}  ${r.allowed} → ${r.count}`);
  for (const v of violations.filter((v) => v.rel === r.file).slice(0, 5)) {
    console.error(`      line ${v.line}: ${v.token}`);
    console.error(`      ${v.message}`);
  }
}
console.error("\nSee design-system/MASTER.md. If a case is genuinely unavoidable,");
console.error("add it to EXEMPT in scripts/verify-design-tokens.mjs with a reason.");
process.exit(1);
