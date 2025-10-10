let scheduled = false;
let frameId = 0;
let queue = [];

const FRAME_BUDGET = 10; // ms
const CHUNK_SIZE = 100;

function _runTasks(tasks) {
  for (const f of tasks) {
    try {
      f();
    } catch (err) {
      console.error('Error in scheduled function:', err);
    }
  }
}

function runQueue() {
  const startTime = performance.now();
  frameId = 0;

  while (queue.length > 0) {
    const chunk = queue.splice(0, CHUNK_SIZE);
    _runTasks(chunk);

    if (performance.now() - startTime > FRAME_BUDGET && queue.length > 0) {
      frameId = requestAnimationFrame(runQueue);
      return;
    }
  }

  scheduled = false;
}

// Schedules a function to be executed on the next animation frame.
export function schedule(f, {signal} = {}) {
  if (signal?.aborted) {
    return;
  }

  let task = f;
  // If a signal is provided, wrap the task to check for abortion before execution.
  if (signal) {
    task = () => {
      if (!signal.aborted) {
        f();
      }
    };
  }

  queue.push(task);

  if (!scheduled) {
    scheduled = true;
    frameId = requestAnimationFrame(runQueue);
  }
}

// Immediately runs all queued tasks synchronously.
export function flush() {
  if (frameId) {
    cancelAnimationFrame(frameId);
  }
  const toRun = queue;
  queue = [];
  _runTasks(toRun);
  scheduled = false;
  frameId = 0;
}

// Clears all pending tasks.
export function clear() {
  if (frameId) {
    cancelAnimationFrame(frameId);
  }
  queue = [];
  scheduled = false;
  frameId = 0;
}
