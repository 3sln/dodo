import {test, expect, describe, mock} from './test-helpers.js';
import schedulerFactory from './src/scheduler.js';

// A window whose clock and animation frames are driven by hand, so the frame
// budget can be crossed deterministically rather than by hoping a real machine
// is slow enough.
function fakeWindow({withRaf = true} = {}) {
  const frames = [];
  let time = 0;
  const win = {
    performance: {now: () => time},
    advance: ms => (time += ms),
    runFrame() {
      const pending = frames.splice(0);
      for (const {fn} of pending) fn();
      return pending.length;
    },
    pending: () => frames.length,
    cancelled: [],
  };
  if (withRaf) {
    let nextId = 1;
    win.requestAnimationFrame = fn => {
      const id = nextId++;
      frames.push({id, fn});
      return id;
    };
    win.cancelAnimationFrame = id => {
      win.cancelled.push(id);
      const i = frames.findIndex(f => f.id === id);
      if (i !== -1) frames.splice(i, 1);
    };
  }
  return win;
}

describe('frame scheduling', () => {
  test('should run queued tasks on the next frame', () => {
    const window = fakeWindow();
    const {schedule} = schedulerFactory({window});
    const ran = [];

    schedule(() => ran.push('a'));
    schedule(() => ran.push('b'));
    expect(ran).toEqual([]);
    expect(window.pending()).toBe(1);

    window.runFrame();
    expect(ran).toEqual(['a', 'b']);
  });

  test('should request only one frame for a burst of tasks', () => {
    const window = fakeWindow();
    const {schedule} = schedulerFactory({window});
    for (let i = 0; i < 10; i++) schedule(() => {});
    expect(window.pending()).toBe(1);
  });

  test('should yield to a new frame once the budget is spent', () => {
    const window = fakeWindow();
    const {schedule} = schedulerFactory({window});
    const ran = [];

    // 250 tasks is three chunks of 100. The clock jumps past the 10ms budget
    // inside every chunk, so each frame gets through exactly one of them.
    for (let i = 0; i < 250; i++) {
      schedule(() => {
        ran.push(i);
        if (i % 100 === 0) window.advance(11);
      });
    }

    window.runFrame();
    expect(ran.length).toBe(100);
    expect(window.pending()).toBe(1);

    window.runFrame();
    expect(ran.length).toBe(200);

    window.runFrame();
    expect(ran.length).toBe(250);
    // Drained, so nothing is left pending.
    expect(window.pending()).toBe(0);
  });

  test('should keep draining a frame when a task throws', () => {
    const window = fakeWindow();
    const {schedule} = schedulerFactory({window});
    const consoleError = console.error;
    console.error = mock();
    try {
      const after = mock();
      schedule(() => {
        throw new Error('task failed');
      });
      schedule(after);
      window.runFrame();
      expect(after).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = consoleError;
    }
  });

  test('should cancel the pending frame on flush and on clear', () => {
    const window = fakeWindow();
    const {schedule, flush, clear} = schedulerFactory({window});

    schedule(() => {});
    flush();
    expect(window.cancelled.length).toBe(1);
    expect(window.pending()).toBe(0);

    schedule(() => {});
    clear();
    expect(window.cancelled.length).toBe(2);
    expect(window.pending()).toBe(0);
  });

  test('should schedule a fresh frame after a flush', () => {
    const window = fakeWindow();
    const {schedule, flush} = schedulerFactory({window});
    const ran = [];

    schedule(() => ran.push('first'));
    flush();
    expect(ran).toEqual(['first']);

    schedule(() => ran.push('second'));
    expect(window.pending()).toBe(1);
    window.runFrame();
    expect(ran).toEqual(['first', 'second']);
  });
});

describe('environments without animation frames', () => {
  test('should fall back to a timer', async () => {
    const window = fakeWindow({withRaf: false});
    const {schedule} = schedulerFactory({window});
    const ran = mock();

    schedule(ran);
    expect(ran).not.toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(ran).toHaveBeenCalledTimes(1);
  });

  test('should clear a pending timer', async () => {
    const window = fakeWindow({withRaf: false});
    const {schedule, clear} = schedulerFactory({window});
    const ran = mock();

    schedule(ran);
    clear();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(ran).not.toHaveBeenCalled();
  });

  test('should fall back to Date.now when performance is absent', () => {
    const window = fakeWindow();
    delete window.performance;
    const {schedule} = schedulerFactory({window});
    const ran = mock();
    schedule(ran);
    window.runFrame();
    expect(ran).toHaveBeenCalledTimes(1);
  });
});
