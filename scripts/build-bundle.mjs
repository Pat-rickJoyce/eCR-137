#!/usr/bin/env node
/**
 * Rebuilds js/reportability-engine/bundle.js — the classic-script IIFE
 * loaded by index.html (kept so the app stays no-build and file://-safe).
 * Replaces the old external build_bundle.py: same concat approach,
 * now in-repo and deterministic. Run after changing any engine source:
 *   node scripts/embed-packs.mjs && node scripts/build-bundle.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const eng = (f) => join(root, 'js', 'reportability-engine', f);

// Dependency order: data first, then modules bottom-up, main last.
const FILES = [
    'rules-data.js',
    'code-oid-lookup.js',
    'packs-data.js',
    'models.js',
    'rules-loader.js',
    'form-scraper.js',
    'evaluator.js',
    'v2/predicates.js',
    'v2/logic-evaluator.js',
    'v2/pack-evaluator.js',
    'v2/evidence-adapter.js',
    'v2/legacy-bridge.js',
    'ui-controller.js',
    'main.js'
];

const parts = FILES.map(f => {
    const src = readFileSync(eng(f), 'utf8')
        .split('\n')
        // drop single-line ES imports (all engine imports are single-line)
        .filter(line => !/^\s*import\s.*from\s/.test(line))
        // strip export keywords, keep declarations
        .map(line => line.replace(/^export\s+(?=(async\s+)?(const|let|var|function|class)\b)/, ''))
        .join('\n');
    if (/^\s*(import|export)\b/m.test(src)) {
        throw new Error(`${f}: unhandled import/export syntax survived stripping`);
    }
    return `/* source: js/reportability-engine/${f} */\n${src}`;
});

const bundle = `/** Reportability Engine Bundle */\n(function() {\n${parts.join('\n')}\n})();\n`;
writeFileSync(eng('bundle.js'), bundle);
console.log(`Wrote bundle.js (${bundle.split('\n').length} lines) from ${FILES.length} sources.`);
