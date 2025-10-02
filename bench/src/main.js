import * as dd from '@3sln/dodo';
import benchmarkApp from './ui.js';

// --- Benchmark Implementations ---
import dodoCases from './cases/dodo.js';
import reactCases from './cases/react.jsx';

const benchmarkCases = {
    dodo: dodoCases,
    React: reactCases,
};

const root = document.getElementById('root');
const NUM_ITERATIONS = 20;
const CONCURRENT_SEQUENCES = 5;

// --- State Management ---
const benchmarkNames = [
    'Create 1,000 rows',
    'Replace 1,000 rows',
    'Append 1,000 rows',
    'Partial update',
    'Select row',
    'Swap rows',
    'Remove row',
    'Clear rows',
];
const libraries = Object.keys(benchmarkCases);

let state = {
  benchmarks: benchmarkNames,
  libraries,
  results: {},
};

function setState(updater) {
  state = updater(state);
  render();
}

function getStats(runs) {
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const variance = runs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runs.length;
    const stdDev = Math.sqrt(variance);
    return { mean, stdDev };
}

// --- Benchmark Runner --- //
async function runSuiteForLibrary(libName) {
  // 1. Set UI to running state
  setState(s => {
    const newResults = { ...s.results, [libName]: {} };
    [...benchmarkNames, 'total'].forEach(name => {
        newResults[libName][name] = { running: true };
    });
    return { ...s, results: newResults };
  });

  // Yield to allow UI to update
  await new Promise(resolve => setTimeout(resolve, 0));

  // 2. Run the concurrent sequences multiple times
  const allResults = { total: [] };
  benchmarkNames.forEach(name => allResults[name] = []);

  const libCase = benchmarkCases[libName];

  for (let i = 0; i < NUM_ITERATIONS; i++) {
    const runPromises = [];
    for (let j = 0; j < CONCURRENT_SEQUENCES; j++) {
        const runSingleSequence = async () => {
            const container = document.createElement('div');
            libCase.setup(container);
            const runResult = {};
            const sequenceStart = performance.now();
            for (const benchName of benchmarkNames) {
                const stepStart = performance.now();
                libCase[benchName]();
                const stepEnd = performance.now();
                runResult[benchName] = stepEnd - stepStart;
            }
            const sequenceEnd = performance.now();
            runResult.total = sequenceEnd - sequenceStart;
            return runResult;
        };
        runPromises.push(runSingleSequence());
    }

    const iterationResults = await Promise.all(runPromises);
    for (const runResult of iterationResults) {
        for (const benchName in runResult) {
            allResults[benchName].push(runResult[benchName]);
        }
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // 3. Calculate averages and update UI
  const finalResults = {};
  for (const benchName in allResults) {
    const runs = allResults[benchName];
    runs.splice(0, CONCURRENT_SEQUENCES); // Discard all runs from the first iteration
    const { mean, stdDev } = getStats(runs);
    finalResults[benchName] = { mean, stdDev, running: false };
  }

  setState(s => ({
    ...s,
    results: { ...s.results, [libName]: finalResults },
  }));
}

// --- Render Loop ---
function render() {
  dd.reconcile(root, benchmarkApp({ state, runSuite: runSuiteForLibrary }));
}

// Initial render
render();