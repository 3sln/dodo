import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as dodo from './index.js';
import reactiveFactory, {PENDING} from './src/reactive.js';
import observeFactory, {
  elementIntersection,
  elementSize,
  elementVisibility,
  nearestLaidOutElement,
} from './src/observe.js';

const {h, reconcile, flush, clear} = dodo;
const {withElementSize, withVisibility} = observeFactory({
  dodo,
  reactive: reactiveFactory({dodo}),
});

let container;
let resizeObservers;
let intersectionObservers;

// Stubs installed on the window rather than on globalThis, which is also what
// exercises the realm based constructor lookup.
function installObserverStubs(view) {
  resizeObservers = [];
  intersectionObservers = [];

  view.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      this.disconnected = false;
      resizeObservers.push(this);
    }
    observe(target, options) {
      this.targets.push({target, options});
    }
    disconnect() {
      this.disconnected = true;
    }
    emit(size) {
      this.callback([{contentRect: size, target: this.targets[0]?.target}]);
    }
  };

  view.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = [];
      this.disconnected = false;
      intersectionObservers.push(this);
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      this.disconnected = true;
    }
    emit(isIntersecting, intersectionRatio = isIntersecting ? 1 : 0) {
      this.callback([{isIntersecting, intersectionRatio, target: this.targets[0]}]);
    }
  };
}

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  installObserverStubs(window);
  clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('nearestLaidOutElement', () => {
  test('walks up past display: contents wrappers', () => {
    const outer = document.createElement('div');
    const wrapper = document.createElement('div');
    const inner = document.createElement('span');
    wrapper.style.display = 'contents';
    inner.style.display = 'contents';
    container.appendChild(outer);
    outer.appendChild(wrapper);
    wrapper.appendChild(inner);
    outer.style.display = 'block';

    expect(nearestLaidOutElement(inner)).toBe(outer);
  });

  test('crosses a shadow boundary to reach the host', () => {
    const host = document.createElement('div');
    host.style.display = 'block';
    container.appendChild(host);
    const shadow = host.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    shadow.appendChild(wrapper);

    expect(nearestLaidOutElement(wrapper)).toBe(host);
  });

  test('returns the element itself when nothing above is laid out', () => {
    const orphan = document.createElement('div');
    expect(nearestLaidOutElement(orphan)).toBe(orphan);
  });
});

describe('elementSize', () => {
  let laidOut;
  beforeEach(() => {
    laidOut = document.createElement('div');
    laidOut.style.display = 'block';
    container.appendChild(laidOut);
  });

  test('measures directly when nothing has been observed yet', () => {
    const size = elementSize(laidOut);
    expect(size.getValue()).toEqual({width: 0, height: 0});
    // Never pending: a size is always knowable.
    expect(size.getValue()).not.toBe(PENDING);
  });

  test('connects on the first listener and disconnects on the last', () => {
    const size = elementSize(laidOut);
    expect(resizeObservers.length).toBe(0);

    const unsubscribe = size.onDirty(() => {});
    expect(resizeObservers.length).toBe(1);
    expect(resizeObservers[0].targets[0].target).toBe(laidOut);

    unsubscribe();
    expect(resizeObservers[0].disconnected).toBe(true);
  });

  test('shares one observer across listeners', () => {
    const size = elementSize(laidOut);
    const a = size.onDirty(() => {});
    const b = size.onDirty(() => {});
    expect(resizeObservers.length).toBe(1);
    a();
    expect(resizeObservers[0].disconnected).toBe(false);
    b();
    expect(resizeObservers[0].disconnected).toBe(true);
  });

  test('reports a plain object so equal sizes compare equal', () => {
    const size = elementSize(laidOut);
    size.onDirty(() => {});
    resizeObservers[0].emit({width: 100, height: 50});

    const first = size.getValue();
    expect(first).toEqual({width: 100, height: 50});
    expect(first.constructor).toBe(Object);
    expect(dodo.settings.shouldUpdate(first, {width: 100, height: 50})).toBe(false);
  });

  test('observes the nearest laid out ancestor, not a contents wrapper', () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    laidOut.appendChild(wrapper);

    elementSize(wrapper).onDirty(() => {});
    expect(resizeObservers[0].targets[0].target).toBe(laidOut);
  });

  test('passes the box option through', () => {
    elementSize(laidOut, {box: 'border-box'}).onDirty(() => {});
    expect(resizeObservers[0].targets[0].options).toEqual({box: 'border-box'});
  });

  test('reads border box sizes when asked for them', () => {
    const size = elementSize(laidOut, {box: 'border-box'});
    size.onDirty(() => {});
    resizeObservers[0].callback([
      {borderBoxSize: [{inlineSize: 10, blockSize: 20}], contentRect: {width: 1, height: 2}},
    ]);
    expect(size.getValue()).toEqual({width: 10, height: 20});
  });

  test('reports an error when no ResizeObserver exists', () => {
    delete window.ResizeObserver;
    expect(() => elementSize(laidOut).onDirty(() => {})).toThrow('ResizeObserver is not available');
  });
});

describe('elementVisibility', () => {
  let target;
  beforeEach(() => {
    target = document.createElement('div');
    target.style.display = 'block';
    container.appendChild(target);
  });

  test('is PENDING until the first entry arrives', () => {
    const visible = elementVisibility(target);
    visible.onDirty(() => {});
    expect(visible.getValue()).toBe(PENDING);

    intersectionObservers[0].emit(true);
    expect(visible.getValue()).toBe(true);
  });

  test('accepts an initial value instead of PENDING', () => {
    const visible = elementVisibility(target, {initial: false});
    visible.onDirty(() => {});
    expect(visible.getValue()).toBe(false);
  });

  test('resolves a string root against the element ancestry', () => {
    const scroller = document.createElement('div');
    scroller.className = 'scroller';
    container.appendChild(scroller);
    const inner = document.createElement('div');
    scroller.appendChild(inner);

    elementVisibility(inner, {root: '.scroller'}).onDirty(() => {});
    expect(intersectionObservers[0].options.root).toBe(scroller);
  });

  test('passes rootMargin and threshold through', () => {
    elementVisibility(target, {rootMargin: '10px', threshold: 0.5}).onDirty(() => {});
    expect(intersectionObservers[0].options.rootMargin).toBe('10px');
    expect(intersectionObservers[0].options.threshold).toBe(0.5);
  });

  test('disconnects and forgets its value on unsubscribe', () => {
    const visible = elementVisibility(target);
    const unsubscribe = visible.onDirty(() => {});
    intersectionObservers[0].emit(true);
    expect(visible.getValue()).toBe(true);

    unsubscribe();
    expect(intersectionObservers[0].disconnected).toBe(true);
    expect(visible.getValue()).toBe(PENDING);
  });

  test('elementIntersection reports the ratio too', () => {
    const intersection = elementIntersection(target);
    intersection.onDirty(() => {});
    intersectionObservers[0].emit(true, 0.25);
    expect(intersection.getValue()).toEqual({visible: true, ratio: 0.25});
  });

  test('reports an error when no IntersectionObserver exists', () => {
    delete window.IntersectionObserver;
    expect(() => elementVisibility(target).onDirty(() => {})).toThrow(
      'IntersectionObserver is not available',
    );
  });
});

describe('withElementSize', () => {
  test('renders the builder with the observed size', () => {
    const laidOut = document.createElement('div');
    laidOut.style.display = 'block';
    container.appendChild(laidOut);

    reconcile(laidOut, [withElementSize(size => h('p', `${size.width}x${size.height}`))]);
    expect(laidOut.textContent).toBe('0x0');

    resizeObservers[0].emit({width: 200, height: 100});
    flush();
    expect(laidOut.textContent).toBe('200x100');
  });

  test('disconnects the observer when detached', () => {
    reconcile(container, [withElementSize(size => h('p', String(size.width)))]);
    expect(resizeObservers[0].disconnected).toBe(false);

    reconcile(container, null);
    expect(resizeObservers[0].disconnected).toBe(true);
  });

  test('does not rebuild the observer for an equal options literal', () => {
    const render = () =>
      reconcile(container, [
        withElementSize(size => h('p', String(size.width)), {box: 'border-box'}),
      ]);

    render();
    expect(resizeObservers.length).toBe(1);
    render();
    render();
    expect(resizeObservers.length).toBe(1);
  });

  test('rebuilds the observer when the options change', () => {
    const render = box =>
      reconcile(container, [withElementSize(size => h('p', String(size.width)), {box})]);

    render('content-box');
    expect(resizeObservers.length).toBe(1);

    render('border-box');
    expect(resizeObservers.length).toBe(2);
    expect(resizeObservers[0].disconnected).toBe(true);
    expect(resizeObservers[1].targets[0].options).toEqual({box: 'border-box'});
  });

  test('does not re-render when the size did not change', () => {
    const builder = mock(size => h('p', String(size.width)));
    reconcile(container, [withElementSize(builder)]);
    expect(builder).toHaveBeenCalledTimes(1);

    resizeObservers[0].emit({width: 0, height: 0});
    flush();
    expect(builder).toHaveBeenCalledTimes(1);

    resizeObservers[0].emit({width: 10, height: 0});
    flush();
    expect(builder).toHaveBeenCalledTimes(2);
  });
});

describe('withVisibility', () => {
  test('renders a placeholder until visibility is known', () => {
    reconcile(container, [
      withVisibility(visible => h('p', visible ? 'seen' : 'hidden'), {
        placeholder: () => h('em', 'unknown'),
      }),
    ]);
    expect(container.textContent).toBe('unknown');

    intersectionObservers[0].emit(true);
    flush();
    expect(container.textContent).toBe('seen');
  });

  test('gives its own node a box and observes it', () => {
    reconcile(container, [withVisibility(v => h('p', String(v)), {initial: false})]);
    const node = container.firstChild;
    expect(node.style.display).toBe('block');
    expect(intersectionObservers[0].targets[0]).toBe(node);
  });

  test('accepts a different display', () => {
    reconcile(container, [
      withVisibility(v => h('p', String(v)), {display: 'inline-block', initial: false}),
    ]);
    expect(container.firstChild.style.display).toBe('inline-block');
  });

  test('observes the nearest laid out ancestor when display is null', () => {
    const laidOut = document.createElement('div');
    laidOut.style.display = 'block';
    container.appendChild(laidOut);

    reconcile(laidOut, [withVisibility(v => h('p', String(v)), {display: null, initial: false})]);
    expect(intersectionObservers[0].targets[0]).toBe(laidOut);
  });

  test('disconnects the observer when detached', () => {
    reconcile(container, [withVisibility(v => h('p', String(v)), {initial: false})]);
    expect(intersectionObservers[0].disconnected).toBe(false);

    reconcile(container, null);
    expect(intersectionObservers[0].disconnected).toBe(true);
  });
});

describe('observe factory', () => {
  test('requires an injected reactive api', () => {
    expect(() => observeFactory({dodo})).toThrow(
      'observe() requires a reactive API providing a watch component',
    );
    expect(() => observeFactory({dodo, reactive: {}})).toThrow(
      'observe() requires a reactive API providing a watch component',
    );
  });

  test('requires a dodo instance', () => {
    expect(() => observeFactory({reactive: {watch: () => {}}})).toThrow(
      'a dodo instance must be provided',
    );
  });

  test('the bundled entry point renders through the bundled watch', async () => {
    const entry = await import('./observe.js');
    expect(typeof entry.withElementSize).toBe('function');
    expect(typeof entry.elementSize).toBe('function');
    expect(entry.watch).toBeUndefined();
  });
});

describe('missing observer support', () => {
  test('renders the error view rather than blowing up the render', () => {
    delete window.ResizeObserver;
    const consoleError = console.error;
    console.error = () => {};
    try {
      reconcile(container, [
        withElementSize(size => h('p', String(size.width)), {
          error: err => h('b', err.message),
        }),
      ]);
    } finally {
      console.error = consoleError;
    }
    expect(container.textContent).toBe('ResizeObserver is not available in this environment');
  });

  test('a failed connection does not leave the cell permanently connected', () => {
    delete window.ResizeObserver;
    const laidOut = document.createElement('div');
    laidOut.style.display = 'block';
    container.appendChild(laidOut);
    const size = elementSize(laidOut);

    expect(() => size.onDirty(() => {})).toThrow('ResizeObserver is not available');

    // Restoring support and retrying works, which it would not if the failed
    // listener had stayed registered.
    installObserverStubs(window);
    size.onDirty(() => {});
    expect(resizeObservers.length).toBe(1);
  });
});
