import {dataSource} from './data.js';
import dodo from './libs/dodo.js';
import dodoInline from './libs/dodo-inline.js';
import react from './libs/react.jsx';
import preact from './libs/preact.js';
import snabbdom from './libs/snabbdom.js';
import superfine from './libs/superfine.js';

export const LIBS = [dodo, dodoInline, react, preact, snabbdom, superfine];

/**
 * The operations live here rather than in each library's adapter, so that every
 * library provably does the same work on the same rows. When each adapter owned
 * its own version of "select a row", one of them did two renders and another
 * mutated its data in place and never re-rendered at all.
 *
 * Rows are replaced rather than mutated, which is what every library here
 * expects: a mutated row is the same object, so a library that compares by
 * identity is entitled to skip it, and would be measured doing nothing.
 */
const OPS = [
  {
    name: 'create 1,000 rows',
    run: (lib, st) => {
      st.items = st.source.build(1000);
      lib.render(st.items);
    },
  },
  {
    // The same rows, unchanged. Whether a library can tell nothing happened.
    name: 're-render unchanged',
    run: (lib, st) => lib.render(st.items),
  },
  {
    name: 'replace 1,000 rows',
    run: (lib, st) => {
      st.items = st.source.build(1000);
      lib.render(st.items);
    },
  },
  {
    name: 'update every 10th row',
    run: (lib, st) => {
      st.items = st.items.map((item, i) =>
        i % 10 === 0 ? {...item, label: `${item.label} !!!`} : item,
      );
      lib.render(st.items);
    },
  },
  {
    name: 'select one row',
    run: (lib, st) => {
      const index = Math.floor(st.source.random() * st.items.length);
      st.items = st.items.slice();
      st.items[index] = {...st.items[index], selected: true};
      lib.render(st.items);
    },
  },
  {
    name: 'swap two rows',
    run: (lib, st) => {
      const next = st.items.slice();
      const a = next[1];
      next[1] = next[998];
      next[998] = a;
      st.items = next;
      lib.render(st.items);
    },
  },
  {
    name: 'remove one row',
    run: (lib, st) => {
      st.items = st.items.slice();
      st.items.splice(Math.floor(st.source.random() * st.items.length), 1);
      lib.render(st.items);
    },
  },
  {
    name: 'append 1,000 rows',
    run: (lib, st) => {
      st.items = st.items.concat(st.source.build(1000));
      lib.render(st.items);
    },
  },
  {
    name: 'clear rows',
    run: (lib, st) => {
      st.items = [];
      lib.render(st.items);
    },
  },
];

export const OP_NAMES = OPS.map(op => op.name);

// Reading a layout property inside the timed region attributes the browser's
// share of the work to the operation that caused it. Without it a library that
// merely queues DOM mutations would look faster than one that performs them.
function timed(fn, doc) {
  const started = performance.now();
  fn();
  doc.body.offsetHeight;
  return performance.now() - started;
}

function withContainer(doc, body) {
  const container = doc.createElement('div');
  doc.body.appendChild(container);
  try {
    return body(container);
  } finally {
    container.remove();
  }
}

/** One pass of every operation, in order, against a freshly mounted library. */
export function runOnce(lib, doc = document, seed = 1) {
  return withContainer(doc, container => {
    lib.mount(container);
    const state = {source: dataSource(seed), items: []};
    const timings = {};
    for (const op of OPS) {
      timings[op.name] = timed(() => op.run(lib, state), doc);
    }
    lib.unmount();
    return timings;
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Rounds are interleaved across libraries and the library order rotates, so a
 * slow patch of wall clock is shared out rather than landing on whichever
 * library happened to run during it.
 */
export async function runSuite({libs = LIBS, rounds = 12, warmup = 2, doc = document} = {}) {
  const samples = new Map(libs.map(lib => [lib.name, {}]));
  for (const lib of libs) {
    for (const name of OP_NAMES) samples.get(lib.name)[name] = [];
  }

  for (let round = 0; round < rounds; round++) {
    const order = libs.map((_, i) => libs[(i + round) % libs.length]);
    for (const lib of order) {
      const timings = runOnce(lib, doc, round + 1);
      if (round >= warmup) {
        for (const name of OP_NAMES) samples.get(lib.name)[name].push(timings[name]);
      }
      // Let the browser breathe between libraries, so one library's garbage is
      // not collected on another's clock.
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  const results = {};
  for (const [libName, byOp] of samples) {
    results[libName] = {};
    let total = 0;
    for (const name of OP_NAMES) {
      const value = median(byOp[name]);
      results[libName][name] = {median: value, best: Math.min(...byOp[name])};
      total += value;
    }
    results[libName].total = {median: total, best: total};
  }
  return results;
}

/**
 * Bytes allocated per update cycle, which is what dodo's iteration primitives
 * exist to keep down. Measured as heap growth across a run with no collection
 * in it, so it counts garbage produced rather than memory retained.
 *
 * Needs --expose-gc and --enable-precise-memory-info; returns null without them.
 */
export function measureAllocation(lib, {cycles = 100, doc = document} = {}) {
  if (typeof globalThis.gc !== 'function' || !performance.memory) return null;

  return withContainer(doc, container => {
    lib.mount(container);
    const state = {source: dataSource(7), items: []};

    // Mount, and run a few cycles so nothing lazily built lands in the sample.
    state.items = state.source.build(200);
    lib.render(state.items);
    for (let i = 0; i < 5; i++) {
      state.items = state.items.map(item => ({...item, label: `${item.label}.`}));
      lib.render(state.items);
    }

    globalThis.gc();
    const before = performance.memory.usedJSHeapSize;
    for (let i = 0; i < cycles; i++) {
      state.items = state.items.map(item => ({...item, label: `${item.label}.`}));
      lib.render(state.items);
    }
    const after = performance.memory.usedJSHeapSize;

    lib.unmount();
    return (after - before) / cycles;
  });
}

/**
 * How many DOM mutations a library performs for each operation.
 *
 * Milliseconds vary with the machine and with whatever else it is doing;
 * mutation counts do not, and they are usually the reason one number is bigger
 * than another. Counting is done by wrapping the realm's own methods for the
 * length of one operation.
 */
export function countDomOps(lib, doc = document, seed = 1) {
  const view = doc.defaultView;
  const targets = [
    [view.Node.prototype, ['insertBefore', 'appendChild', 'removeChild', 'replaceChild']],
    [view.Element.prototype, ['moveBefore']],
  ];

  let counting = false;
  let mutations = 0;
  const restore = [];

  for (const [proto, names] of targets) {
    for (const name of names) {
      const original = proto[name];
      if (typeof original !== 'function') continue;
      restore.push(() => (proto[name] = original));
      proto[name] = function (...args) {
        if (counting) mutations++;
        return original.apply(this, args);
      };
    }
  }

  try {
    return withContainer(doc, container => {
      lib.mount(container);
      const state = {source: dataSource(seed), items: []};
      const counts = {};
      for (const op of OPS) {
        mutations = 0;
        counting = true;
        op.run(lib, state);
        counting = false;
        counts[op.name] = mutations;
      }
      lib.unmount();
      return counts;
    });
  } finally {
    for (const undo of restore) undo();
  }
}
