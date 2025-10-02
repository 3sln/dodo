import { Window } from 'happy-dom';
import dodoCases from './cases/dodo.js';
import reactCases from './cases/react.jsx';

// --- Happy DOM setup ---
global.window = new Window();
global.document = window.document;
global.performance = window.performance;

// --- Benchmark Suite --- //

const benchmarkLibs = {
    dodo: dodoCases,
    React: reactCases,
};

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

const NUM_ITERATIONS = 20;
const CONCURRENT_SEQUENCES = 5;

function getStats(runs) {
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const variance = runs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runs.length;
    const stdDev = Math.sqrt(variance);
    return { mean, stdDev };
}

async function run() {
    const results = {};
    for (const libName in benchmarkLibs) {
        results[libName] = { total: [] };
        benchmarkNames.forEach(name => results[libName][name] = []);
    }

    console.log(`Running ${NUM_ITERATIONS} interleaved iterations of ${CONCURRENT_SEQUENCES} concurrent sequences...`);

    for (let i = 0; i < NUM_ITERATIONS; i++) {
        console.log(`--> Starting Iteration ${i + 1}/${NUM_ITERATIONS}`);
        for (const libName in benchmarkLibs) {
            const libCase = benchmarkLibs[libName];
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
                    results[libName][benchName].push(runResult[benchName]);
                }
            }
        }
        // Yield between each full iteration to allow for GC, etc.
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // --- Calculate and Print Summary --- //
    console.log(`\n--- Benchmark Summary (Average of ${NUM_ITERATIONS - 1} iterations after 1 warm-up) ---\n`);

    const summary = {};
    const allSteps = [...benchmarkNames, 'total'];

    for (const stepName of allSteps) {
        summary[stepName] = {};
        for (const libName in benchmarkLibs) {
            const runs = results[libName][stepName];
            // Discard the results from the first iteration (warm-up)
            const validRuns = runs.slice(CONCURRENT_SEQUENCES);
            const { mean, stdDev } = getStats(validRuns);
            summary[stepName][libName] = `${mean.toFixed(3)}ms (±${stdDev.toFixed(3)})`;
        }
    }

    console.table(summary);
}

run();
