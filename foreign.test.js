import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import {dodo, settings as defaultSettings} from './index.js';

/**
 * A persistent map with nothing plain about it: the entries live in a private
 * field, so `Object.keys` and `Object.entries` both see nothing at all. If the
 * reconciler ever falls back to a plain-object walk for one of these, every
 * assertion below fails.
 */
class PMap {
  #entries;
  constructor(entries = []) {
    this.#entries = entries;
  }
  static from(obj) {
    return new PMap(Object.entries(obj ?? {}));
  }
  get(key) {
    const found = this.#entries.find(([k]) => k === key);
    return found ? found[1] : undefined;
  }
  set(key, value) {
    return new PMap([...this.#entries.filter(([k]) => k !== key), [key, value]]);
  }
  entries() {
    return this.#entries[Symbol.iterator]();
  }
  each(visit, a, b, c) {
    for (const [k, v] of this.#entries) visit(k, v, a, b, c);
  }
  merge(...others) {
    let out = this;
    for (const other of others) other.each((k, v) => (out = out.set(k, v)));
    return out;
  }
}

const base = {
  isMap: x => x instanceof PMap,
  mapGet: (m, k) => m.get(k),
  newMap: obj => PMap.from(obj),
  mapPut: (m, k, v) => m.set(k, v),
  mapMerge: (...ms) => ms.reduce((a, b) => a.merge(b), new PMap()),
};

// Sanity: these really are opaque to the plain-object walk.
test('the fixture is genuinely foreign', () => {
  const m = PMap.from({a: 1});
  expect(Object.keys(m)).toEqual([]);
  expect(Object.entries(m)).toEqual([]);
  expect(m.get('a')).toBe(1);
});

let container;
beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  container = document.createElement('div');
  document.body.appendChild(container);
});

// Both ways of describing a custom collection must behave identically.
const variants = {
  'mapIter (pairs)': {...base, mapIter: m => m.entries()},
  'mapEach (visitor)': {...base, mapEach: (m, visit, a, b, c) => m.each(visit, a, b, c)},
  'both, mapEach wins': {
    ...base,
    mapIter: m => m.entries(),
    mapEach: (m, visit, a, b, c) => m.each(visit, a, b, c),
  },
};

for (const [label, userSettings] of Object.entries(variants)) {
  describe(`nested foreign maps via ${label}`, () => {
    test('drives props, styling, attrs, dataset and listeners', () => {
      const d = dodo(userSettings);
      const clicked = mock();

      d.reconcile(
        container,
        d
          .h(
            'div',
            PMap.from({
              id: 'foreign',
              $styling: PMap.from({color: 'red', 'font-size': '12px'}),
              $attrs: PMap.from({role: 'main', 'aria-label': 'x'}),
              $dataset: PMap.from({foo: 'a', bar: 'b'}),
            }),
            d.h('p', null, 'hi'),
          )
          .on(PMap.from({click: clicked})),
      );

      expect(container.id).toBe('foreign');
      expect(container.style.color).toBe('red');
      expect(container.getAttribute('role')).toBe('main');
      expect(container.dataset.foo).toBe('a');
      expect(container.textContent).toBe('hi');

      container.dispatchEvent(new window.MouseEvent('click'));
      expect(clicked).toHaveBeenCalledTimes(1);
    });

    test('sweeps removed entries out of every nested map', () => {
      const d = dodo(userSettings);
      const clicked = mock();
      const full = d
        .h(
          'div',
          PMap.from({
            id: 'a',
            $styling: PMap.from({color: 'red', 'font-size': '12px'}),
            $attrs: PMap.from({role: 'main', 'aria-label': 'x'}),
            $dataset: PMap.from({foo: 'a', bar: 'b'}),
          }),
        )
        .on(PMap.from({click: clicked}));

      d.reconcile(container, full);
      d.reconcile(
        container,
        d.h('div', PMap.from({id: 'b', $styling: PMap.from({color: 'blue'})})),
      );

      expect(container.id).toBe('b');
      expect(container.style.color).toBe('blue');
      expect(container.style.getPropertyValue('font-size')).toBe('');
      expect(container.getAttribute('role')).toBe(null);
      expect(container.getAttribute('aria-label')).toBe(null);
      expect(container.dataset.foo).toBeUndefined();
      expect(container.dataset.bar).toBeUndefined();

      container.dispatchEvent(new window.MouseEvent('click'));
      expect(clicked).not.toHaveBeenCalled();
    });

    test('exposes the resolved mapEach on settings', () => {
      const d = dodo(userSettings);
      const seen = [];
      d.settings.mapEach(PMap.from({x: 1, y: 2}), (k, v) => seen.push([k, v]));
      expect(seen).toEqual([
        ['x', 1],
        ['y', 2],
      ]);
    });
  });
}

describe('default settings', () => {
  test('mapEach walks a plain object', () => {
    const seen = [];
    defaultSettings.mapEach({a: 1, b: 2}, (k, v) => seen.push([k, v]));
    expect(seen).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  test('mapEach tolerates a nullish map', () => {
    const seen = [];
    defaultSettings.mapEach(null, (k, v) => seen.push([k, v]));
    defaultSettings.mapEach(undefined, (k, v) => seen.push([k, v]));
    expect(seen).toEqual([]);
  });

  test('mapEach passes context through without allocating a closure', () => {
    const seen = [];
    const visit = (k, v, a, b, c) => seen.push([k, v, a, b, c]);
    defaultSettings.mapEach({a: 1}, visit, 'x', 'y', 'z');
    expect(seen).toEqual([['a', 1, 'x', 'y', 'z']]);
  });

  test('mapIter still yields ordinary pairs', () => {
    expect([...defaultSettings.mapIter({a: 1, b: 2})]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});
