/**
 * Runs the benchmark suite in headless Chromium.
 *
 * The suite used to run against a DOM emulator, which measured the emulator far
 * more than it measured any of these libraries — a vdom library's whole job is
 * talking to a real DOM, and an emulator's `insertBefore` has nothing to do with
 * a browser's. Everything here is bundled and handed to a real browser instead.
 *
 *   bun run bench            # timings
 *   bun run bench --memory   # timings and allocation per update
 */

import {existsSync, readdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import {chromium} from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const withMemory = process.argv.includes('--memory');
const withOps = process.argv.includes('--ops');
const rounds = Number(process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 12);

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const binary = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(binary)) return binary;
  }
  return undefined;
}

// React reads NODE_ENV, and its development build carries warnings and checks
// that nobody ships. Measuring it would be measuring the wrong build.
const bundle = await esbuild.build({
  entryPoints: [join(here, 'src/suite.js')],
  bundle: true,
  format: 'iife',
  globalName: 'BENCH',
  minify: false,
  define: {'process.env.NODE_ENV': '"production"'},
  target: 'chrome110',
  write: false,
});

const dir = mkdtempSync(join(tmpdir(), 'dodo-bench-'));
const page = join(dir, 'bench.html');
writeFileSync(
  page,
  `<!doctype html><meta charset="utf-8"><title>dodo bench</title><body>
<script>${bundle.outputFiles[0].text}</script>`,
);

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: [
    // Allocation measurement needs both: one to collect on demand, the other to
    // stop usedJSHeapSize being quantised into uselessness.
    '--js-flags=--expose-gc',
    '--enable-precise-memory-info',
  ],
});

const tab = await browser.newPage();
tab.on('console', message => {
  if (message.type() === 'error') console.error('  page error:', message.text());
});
tab.on('pageerror', error => console.error('  page error:', error.message));
await tab.goto(`file://${page}`);

const version = await tab.evaluate(() => navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]);
console.log(`\n${version} — ${rounds} rounds, first 2 discarded, median reported\n`);

const results = await tab.evaluate(r => BENCH.runSuite({rounds: r}), rounds);

const memory = withMemory
  ? await tab.evaluate(() =>
      Object.fromEntries(BENCH.LIBS.map(lib => [lib.name, BENCH.measureAllocation(lib)])),
    )
  : null;

const domOps = withOps
  ? await tab.evaluate(() =>
      Object.fromEntries(BENCH.LIBS.map(lib => [lib.name, BENCH.countDomOps(lib)])),
    )
  : null;

const opNames = await tab.evaluate(() => BENCH.OP_NAMES);
await browser.close();

// --- Reporting ------------------------------------------------------------

const libs = Object.keys(results);
const rows = [...opNames, 'total'];
const labelWidth = Math.max(...rows.map(r => r.length), 'kB / update'.length);
const columnWidth = Math.max(...libs.map(l => l.length)) + 3;
const label = row => String(row).padEnd(labelWidth);
const cell = text => String(text).padStart(columnWidth);
const rule = list => '-'.repeat(labelWidth + 2 + list.length * columnWidth);

const fastestPerRow = new Map(
  rows.map(row => [row, Math.min(...libs.map(lib => results[lib][row].median))]),
);

console.log(`${label('')}  ${libs.map(l => cell(l)).join('')}`);
console.log(rule(libs));
for (const row of rows) {
  const cells = libs.map(lib => {
    const value = results[lib][row].median;
    const text = value < 1 ? value.toFixed(2) : value.toFixed(1);
    return cell(value === fastestPerRow.get(row) ? `${text}*` : text);
  });
  console.log(`${label(row)}  ${cells.join('')}`);
}
console.log('\nmilliseconds, lower is better, * marks the fastest in the row.');
console.log("Each figure includes a forced layout, so the browser's share of the");
console.log('work counts against whichever operation caused it.');

if (memory) {
  const known = libs.filter(lib => memory[lib] != null);
  if (known.length === 0) {
    console.log('\nAllocation unavailable: no --expose-gc or no performance.memory.');
  } else {
    console.log('\nGarbage per update of 200 rows:\n');
    console.log(`${label('')}  ${known.map(l => cell(l)).join('')}`);
    console.log(rule(known));
    console.log(
      `${label('kB / update')}  ${known.map(l => cell((memory[l] / 1024).toFixed(1))).join('')}`,
    );
    console.log('\nHeap growth across a run with no collection in it, so this is');
    console.log('garbage produced rather than memory retained.');
  }
}

if (domOps) {
  console.log('\nDOM mutations performed (insert, move, remove, replace):\n');
  console.log(`${label('')}  ${libs.map(l => cell(l)).join('')}`);
  console.log(rule(libs));
  for (const row of opNames) {
    console.log(`${label(row)}  ${libs.map(l => cell(domOps[l][row])).join('')}`);
  }
  console.log('\nDeterministic, unlike the timings: this is what each library asked');
  console.log('the DOM to do, and it does not move with the machine.');
}

console.log('\nNote: `re-render unchanged` hands every library the identical row objects it');
console.log('already rendered. React and preact could opt out of that work with memo;');
console.log('none of the others expose an equivalent, and none is used here.\n');
