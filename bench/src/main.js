import * as dd from '@3sln/dodo';
import benchmarkApp from './ui.js';
import {LIBS, OP_NAMES, runSuite} from './suite.js';

// The interactive view of the same suite `run.mjs` drives headlessly. Both go
// through `runSuite`, so there is one definition of what the benchmark does and
// no way for the two to drift into measuring different things.

const root = document.getElementById('root');
const libraries = LIBS.map(lib => lib.name);

let state = {
  benchmarks: OP_NAMES,
  libraries,
  results: {},
};

function setState(updater) {
  state = updater(state);
  render();
}

async function runFor(libName) {
  const lib = LIBS.find(l => l.name === libName);

  setState(s => ({
    ...s,
    results: {
      ...s.results,
      [libName]: Object.fromEntries([...OP_NAMES, 'total'].map(name => [name, {running: true}])),
    },
  }));

  // Yield so the running state paints before the main thread is taken.
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    const results = await runSuite({libs: [lib]});
    setState(s => ({...s, results: {...s.results, [libName]: results[libName]}}));
  } catch (error) {
    console.error(error);
    setState(s => ({
      ...s,
      results: {
        ...s.results,
        [libName]: Object.fromEntries(
          [...OP_NAMES, 'total'].map(name => [name, {error: error.message}]),
        ),
      },
    }));
  }
}

function render() {
  dd.reconcile(root, [benchmarkApp({state, runSuite: runFor})]);
}

render();
