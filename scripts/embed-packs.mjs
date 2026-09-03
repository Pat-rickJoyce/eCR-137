#!/usr/bin/env node
/**
 * Embeds rules/conditions/*.json into js/reportability-engine/packs-data.js
 * so the no-build app keeps working over file:// (fetch is unreliable there).
 * The JSON packs remain the source of truth; this file is generated.
 * Run: node scripts/embed-packs.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, 'rules', 'conditions');
const outFile = join(root, 'js', 'reportability-engine', 'packs-data.js');

// *.draft.json are auto-generated skeletons awaiting human curation — they
// are NOT embedded (their flat structure would over-trigger). Only curated
// packs run in the app.
const files = readdirSync(packDir).filter(f => f.endsWith('.json') && !f.endsWith('.draft.json')).sort();
const packs = files.map(f => JSON.parse(readFileSync(join(packDir, f), 'utf8')));

const header = `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: rules/conditions/*.json (edit those, then run
 * \`node scripts/embed-packs.mjs\`). Deterministic output: CI verifies
 * freshness by regenerating and diffing.
 * Packs: ${packs.map(p => `${p.mnemonic} (modified ${p.modified})`).join(', ')}
 */
`;

writeFileSync(outFile, header + 'export const RULE_PACKS = ' + JSON.stringify(packs, null, 2) + ';\n');
console.log(`Embedded ${packs.length} pack(s) -> ${outFile}`);
