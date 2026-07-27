import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as dodo from './index.js';
import styleFactory, {css} from './src/style.js';

const {h, reconcile, clear} = dodo;
const {scoped, reconcileShadow, detachShadow} = styleFactory({dodo});

let container;
let sheetFor;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  globalThis.CSSStyleSheet = window.CSSStyleSheet;
  clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  sheetFor = css.in(window);
});

describe('css', () => {
  test('builds a stylesheet from a template', () => {
    const sheet = sheetFor`p { color: red; }`;
    expect(sheet).toBeInstanceOf(window.CSSStyleSheet);
    expect(sheet.cssRules.length).toBe(1);
  });

  test('interpolates values, including falsey ones', () => {
    const build = value => sheetFor`p { opacity: ${value}; }`;
    expect(build(0).cssRules[0].cssText).toContain('0');
    // A truthiness test here would drop the zero and produce `opacity: ;`.
    expect(build(0.5).cssRules[0].cssText).toContain('0.5');
  });

  test('treats null and undefined as empty', () => {
    const sheet = sheetFor`p { color: red; }${null}${undefined}`;
    expect(sheet.cssRules.length).toBe(1);
  });

  test('returns the same sheet for an unchanged call site', () => {
    const build = color => sheetFor`p { color: ${color}; }`;
    const first = build('red');
    expect(build('red')).toBe(first);
  });

  test('rebuilds when an interpolated value changes', () => {
    const build = color => sheetFor`p { color: ${color}; }`;
    const red = build('red');
    const blue = build('blue');
    expect(blue).not.toBe(red);
    expect(blue.cssRules[0].cssText).toContain('blue');
  });

  test('keeps distinct call sites distinct', () => {
    const a = sheetFor`p { color: red; }`;
    const b = sheetFor`p { color: red; }`;
    expect(a).not.toBe(b);
  });

  test('reports an error when constructable stylesheets are unavailable', () => {
    const bare = css.in({});
    expect(() => bare`p { color: red; }`).toThrow('CSSStyleSheet is not available');
  });
});

describe('scoped', () => {
  test('renders children into a shadow root', () => {
    reconcile(container, [scoped(h('p', null, 'inside'))]);
    const host = container.firstChild;
    expect(host.shadowRoot).toBeTruthy();
    expect(host.shadowRoot.textContent).toBe('inside');
    // The content is not in the light DOM.
    expect(container.textContent).toBe('');
  });

  test('adopts the stylesheets it is given', () => {
    const sheet = sheetFor`p { color: red; }`;
    reconcile(container, [scoped({styleSheets: [sheet]}, h('p', null, 'x'))]);
    expect(container.firstChild.shadowRoot.adoptedStyleSheets).toEqual([sheet]);
  });

  test('does not reassign an unchanged stylesheet list', () => {
    const sheet = sheetFor`p { color: red; }`;
    const sheets = [sheet];
    reconcile(container, [scoped({styleSheets: sheets}, h('p', null, 'a'))]);
    const shadow = container.firstChild.shadowRoot;

    let assignments = 0;
    let current = shadow.adoptedStyleSheets;
    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      configurable: true,
      get: () => current,
      set(next) {
        assignments++;
        current = next;
      },
    });

    reconcile(container, [scoped({styleSheets: [sheet]}, h('p', null, 'b'))]);
    expect(assignments).toBe(0);

    reconcile(container, [scoped({styleSheets: []}, h('p', null, 'c'))]);
    expect(assignments).toBe(1);
  });

  test('can drop the last stylesheet', () => {
    const sheet = sheetFor`p { color: red; }`;
    reconcile(container, [scoped({styleSheets: [sheet]}, h('p', null, 'x'))]);
    const shadow = container.firstChild.shadowRoot;
    expect(shadow.adoptedStyleSheets.length).toBe(1);

    // Bones only ever assigned a non-empty list, so this left the sheet adopted.
    reconcile(container, [scoped({styleSheets: []}, h('p', null, 'x'))]);
    expect(shadow.adoptedStyleSheets.length).toBe(0);
  });

  test('updates its children in place', () => {
    reconcile(container, [scoped(h('p', null, 'first'))]);
    const shadow = container.firstChild.shadowRoot;
    const paragraph = shadow.firstChild;

    reconcile(container, [scoped(h('p', null, 'second'))]);
    expect(shadow.textContent).toBe('second');
    expect(shadow.firstChild).toBe(paragraph);
  });

  test('works with no props at all', () => {
    reconcile(container, [scoped(h('p', null, 'a'), h('span', null, 'b'))]);
    expect(container.firstChild.shadowRoot.textContent).toBe('ab');
  });

  test('tears down its shadow content when detached', () => {
    const detached = mock();
    reconcile(container, [scoped(h('p', null, 'x').on({$detach: detached}))]);
    const shadow = container.firstChild.shadowRoot;

    reconcile(container, null);
    // Bones left the shadow content in place, so this hook never fired and its
    // listeners stayed attached.
    expect(detached).toHaveBeenCalledTimes(1);
    expect(shadow.childNodes.length).toBe(0);
    expect(shadow.adoptedStyleSheets.length).toBe(0);
  });

  test('reuses an existing shadow root rather than attaching a second', () => {
    const host = document.createElement('my-widget');
    container.appendChild(host);
    const existing = host.attachShadow({mode: 'open'});

    reconcile(host, [scoped(h('p', null, 'x'))]);
    // `scoped` renders into its own node, so the host's root is untouched.
    expect(host.shadowRoot).toBe(existing);
    expect(host.firstChild.shadowRoot.textContent).toBe('x');
  });
});

describe('reconcileShadow', () => {
  test('mounts a tree into a shadow root imperatively', () => {
    const host = document.createElement('my-widget');
    container.appendChild(host);
    const sheet = sheetFor`p { color: red; }`;

    const shadow = reconcileShadow(host, [h('p', null, 'imperative')], [sheet]);
    expect(shadow.textContent).toBe('imperative');
    expect(shadow.adoptedStyleSheets).toEqual([sheet]);

    detachShadow(host);
    expect(shadow.childNodes.length).toBe(0);
  });
});

describe('style factory', () => {
  test('requires a dodo instance', () => {
    expect(() => styleFactory({})).toThrow('a dodo instance must be provided');
  });

  test('needs no reactive api', () => {
    expect(typeof styleFactory({dodo}).scoped).toBe('function');
  });
});
