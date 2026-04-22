#!/usr/bin/env node
// Rasterize favicon-template.svg at multiple sizes.
// Usage: node generate.mjs [day] [outDir]
// Defaults: day = today (local), outDir = ../png
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const day = Number(process.argv[2] ?? new Date().getDate());
const outDir = process.argv[3] ?? join(ROOT, 'png');

if (!Number.isInteger(day) || day < 1 || day > 31) {
  console.error(`Invalid day: ${day}. Expected 1..31.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const tpl = readFileSync(join(ROOT, 'svg', 'favicon-template.svg'), 'utf-8');
const svg = tpl.replace('{{DAY}}', String(day));

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

for (const size of sizes) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' },
    background: 'rgba(0,0,0,0)',
  });
  const png = r.render().asPng();
  const path = join(outDir, `favicon-${size}.png`);
  writeFileSync(path, png);
  console.log(`  ${path}  (${png.length} bytes)`);
}

// Also bake a canonical SVG with the day embedded (for static fallback).
writeFileSync(join(ROOT, 'svg', 'favicon.svg'), svg);
console.log(`  ${join(ROOT, 'svg', 'favicon.svg')}  (day=${day})`);
