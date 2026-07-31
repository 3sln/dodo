import {test, expect, describe, beforeEach, afterEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import {h, alias, special, reconcile, schedule, flush, clear, dodo} from './index.js';

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  clear();
  container = document.createElement('div');
});

describe('reconcile function', () => {
  test('should reconcile an ELEMENT_NODE onto a matching DOM element', () => {
    const vdom = h(
      'div',
      {
        id: 'root',
      },
      h('span', null, 'Hello'),
    );
    reconcile(container, vdom);
    expect(container.id).toEqual('root');
    expect(container.innerHTML).toEqual('<span>Hello</span>');
  });

  test('should throw an error when reconciling an ELEMENT_NODE onto a mismatched DOM element', () => {
    const vdom = h('span', null, 'Hello');
    expect(() => reconcile(container, vdom)).toThrow('incompatible target for vdom');
  });

  test('should reconcile an OPAQUE_NODE onto a matching DOM element', () => {
    const vdom = h('div').classes('opaque-container').opaque();
    reconcile(container, vdom);
    expect(container.className).toEqual('opaque-container');
  });

  test('should throw an error when reconciling an OPAQUE_NODE onto a mismatched DOM element', () => {
    const vdom = h('span', {
      class: 'opaque-container',
    }).opaque();
    expect(() => reconcile(container, vdom)).toThrow('incompatible target for vdom');
  });

  test('should reconcile an ALIAS_NODE onto any DOM element', () => {
    const myAlias = alias(text => h('p', null, text));
    const vdom = myAlias('Component Content');
    reconcile(container, vdom);
    expect(container.innerHTML).toEqual('<p>Component Content</p>');
  });

  test('should reconcile a SPECIAL_NODE onto any DOM element', () => {
    const mySpecial = special({});
    reconcile(container, mySpecial('A'));
  });

  test('should reconcile an iterable of VNodes for the target element children', () => {
    const vdom = [h('p', null, 'First'), h('p', null, 'Second')];
    reconcile(container, vdom);
    expect(container.innerHTML).toEqual('<p>First</p><p>Second</p>');
  });

  test('should reconcile an iterable of text nodes for the target element children', () => {
    reconcile(container, ['First', 'Second']);
    expect(container.textContent).toEqual('FirstSecond');
  });
});

describe('h function (ELEMENT_NODE) specific behavior', () => {
  let rootDiv;
  beforeEach(() => {
    rootDiv = document.createElement('div');
    container.appendChild(rootDiv);
  });

  test('should update props on a re-render', () => {
    const vdom1 = h('div', {
      id: 'my-div',
      disabled: false,
    });
    reconcile(rootDiv, vdom1);
    expect(rootDiv.disabled).toBe(false);

    const vdom2 = h('div', {
      id: 'my-div',
      disabled: true,
    });
    reconcile(rootDiv, vdom2);
    expect(rootDiv.disabled).toBe(true);
  });

  test('should correctly reconcile children with keys', () => {
    const vdom1 = h('div', null, [
      h('li', null, 'A').key('a'),
      h('li', null, 'B').key('b'),
      h('li', null, 'C').key('c'),
    ]);
    reconcile(rootDiv, vdom1);
    expect(rootDiv.textContent).toEqual('ABC');
    const firstChild = rootDiv.childNodes[0];

    const vdom2 = h('div', null, [
      h('li', null, 'C').key('c'),
      h('li', null, 'A').key('a'),
      h('li', null, 'B').key('b'),
    ]);
    reconcile(rootDiv, vdom2);
    expect(rootDiv.textContent).toEqual('CAB');
    expect(rootDiv.childNodes[1]).toBe(firstChild);
  });

  test('should handle omitted props object', () => {
    const vdom = h('p', 'test content');
    reconcile(rootDiv, [vdom]);
    expect(rootDiv.innerHTML).toEqual('<p>test content</p>');
  });
});

describe('o function (OPAQUE_NODE) specific behavior', () => {
  let rootDiv;
  beforeEach(() => {
    rootDiv = document.createElement('div');
    container.appendChild(rootDiv);
    rootDiv.innerHTML = '<span>Initial Content</span>';
  });

  test('should create an opaque node with props but not touch children', () => {
    const vdom = h('div', {
      id: 'opaque-div',
    }).opaque();
    reconcile(rootDiv, vdom);
    expect(rootDiv.id).toEqual('opaque-div');
    expect(rootDiv.innerHTML).toEqual('<span>Initial Content</span>');
  });
});

describe('alias function (ALIAS_NODE) specific behavior', () => {
  test('should re-render when component props change', () => {
    const myComponent = alias(props => h('span', null, props.text));
    const vdom1 = myComponent({
      text: 'Hello',
    });
    reconcile(container, vdom1);
    const span = container.querySelector('span');
    expect(span.textContent).toEqual('Hello');

    const vdom2 = myComponent({
      text: 'World',
    });
    reconcile(container, vdom2);
    expect(span.textContent).toEqual('World');
  });

  test('should dispatch event from alias to material element', () => {
    const eventSpy = mock();
    const myComponent = alias(function () {
      return h('button', null, 'Hello').on({
        click: () => this.dispatchEvent(new window.CustomEvent('my-event', {bubbles: true})),
      });
    });

    const vdom = myComponent().on({'my-event': eventSpy});
    reconcile(container, [vdom]);

    container.querySelector('button').click();

    expect(eventSpy).toHaveBeenCalledTimes(1);
  });
});

describe('special function (SPECIAL_NODE) specific behavior', () => {
  test('should call update when args change', () => {
    const attachMock = mock();
    const detachMock = mock();
    const updateMock = mock();

    const mySpecial = special({
      attach: attachMock,
      detach: detachMock,
      update: updateMock,
    });

    reconcile(container, mySpecial('A'));
    expect(attachMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);

    reconcile(container, mySpecial('B'));
    expect(updateMock).toHaveBeenCalledTimes(2);

    reconcile(container, null);
    expect(attachMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(detachMock).toHaveBeenCalledTimes(1);

    const updateCalls = updateMock.mock.calls;
    expect(updateCalls[0][0]).toBe(container);
    expect(updateCalls[0][1]).toEqual(['A']);
    expect(updateCalls[0][2]).toBe(undefined);
    expect(updateCalls[1][0]).toBe(container);
    expect(updateCalls[1][1]).toEqual(['B']);
    expect(updateCalls[1][2]).toEqual(['A']);
  });
});

describe('Event Listeners', () => {
  test('should call the listener when the event is triggered', () => {
    let clicked = false;
    const clickHandler = () => {
      clicked = true;
    };
    const button = h('button', null, 'Click me').on({click: clickHandler});
    reconcile(container, [button]);
    const renderedButton = container.firstChild;
    renderedButton.dispatchEvent(new window.MouseEvent('click'));
    expect(clicked).toBe(true);
  });

  test('should remove the old listener when the node is replaced', () => {
    let oldListenerCalled = false;
    const oldListener = () => {
      oldListenerCalled = true;
    };
    const oldNode = [h('button', null, 'Old button').on({click: oldListener})];
    reconcile(container, oldNode);
    const oldButtonElement = container.firstChild;
    const newNode = [h('button', null, 'New button')];
    reconcile(container, newNode);
    oldButtonElement.dispatchEvent(new window.MouseEvent('click'));
    expect(oldListenerCalled).toBe(false);
  });
});

describe('VNode lifecycle hooks', () => {
  test('should call the $attach hook when the node is created', () => {
    let created = false;
    const createHandler = () => {
      created = true;
    };
    const div = h('div').on({$attach: createHandler});
    reconcile(container, [div]);
    expect(created).toBe(true);
  });

  test('should call the $detach hook when the node is removed', () => {
    let removed = false;
    const removeHandler = () => {
      removed = true;
    };
    const div = h('div').on({$detach: removeHandler});
    reconcile(container, [div]);
    reconcile(container, null);
    expect(removed).toBe(true);
  });

  test('should call the $update hook after every reconciliation', () => {
    let reconcileCount = 0;
    const reconcileHandler = () => {
      reconcileCount++;
    };

    reconcile(container, [h('div').on({$update: reconcileHandler})]);
    expect(reconcileCount).toBe(1);

    reconcile(container, [h('div', {id: 'updated'}).on({$update: reconcileHandler})]);
    expect(reconcileCount).toBe(2);

    reconcile(container, null);
    expect(reconcileCount).toBe(2);
  });
});

describe('children flattening', () => {
  test('should drop null, undefined and false children at any nesting depth', () => {
    reconcile(container, h('div', null, [null, [undefined, false], h('p', null, 'kept')]));
    expect(container.innerHTML).toEqual('<p>kept</p>');
  });

  test('should render 0 and the empty string as text', () => {
    reconcile(container, h('div', null, [0, 'a', '', 0.0]));
    expect(container.textContent).toEqual('0a0');
  });

  test('should treat a nullish props slot as absent rather than as a child', () => {
    reconcile(container, h('div', null, 'only child'));
    expect(container.childNodes.length).toEqual(1);
    expect(container.textContent).toEqual('only child');
  });
});

describe('keyed reconciliation', () => {
  test('should support keys that collide with Object.prototype members', () => {
    const build = text =>
      h('div', null, [
        h('li', null, `${text}1`).key('constructor'),
        h('li', null, `${text}2`).key('__proto__'),
        h('li', null, `${text}3`).key('toString'),
      ]);

    reconcile(container, build('a'));
    expect(container.textContent).toEqual('a1a2a3');
    const firstItem = container.childNodes[0];

    reconcile(container, build('b'));
    expect(container.textContent).toEqual('b1b2b3');
    // The nodes were reused, not recreated.
    expect(container.childNodes[0]).toBe(firstItem);
  });

  test('should reuse nodes in order for a long unkeyed list', () => {
    const items = n =>
      h(
        'div',
        null,
        Array.from({length: n}, (_, i) => h('li', null, String(i))),
      );
    reconcile(container, items(50));
    const third = container.childNodes[2];
    reconcile(container, items(50));
    expect(container.childNodes.length).toEqual(50);
    expect(container.childNodes[2]).toBe(third);
  });
});

describe('prop safety', () => {
  test('should refuse to assign __proto__ as a property', () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      reconcile(container, h('div', {['__proto__']: {polluted: true}}));
    } finally {
      console.error = consoleError;
    }
    expect(container.polluted).toBeUndefined();
    // The element is still a working DOM node.
    expect(typeof container.appendChild).toBe('function');
  });

  test('should skip empty and nullish class names', () => {
    reconcile(container, h('div').classes('a', '', null, false, 'b'));
    expect(container.className).toEqual('a b');
  });

  test('should remove classes that are no longer present', () => {
    reconcile(container, h('div').classes('a', 'b'));
    reconcile(container, h('div').classes('b', 'c'));
    expect(container.classList.contains('a')).toBe(false);
    expect(container.classList.contains('b')).toBe(true);
    expect(container.classList.contains('c')).toBe(true);
  });
});

describe('node identity changes', () => {
  test('should reject reconciling a different tag onto an already managed target', () => {
    reconcile(container, h('div', {id: 'first'}));
    expect(() => reconcile(container, h('span', {id: 'second'}))).toThrow(
      'incompatible target for vdom',
    );
  });

  test('should detach the old special and attach the new one when the tag changes', () => {
    const firstAttach = mock();
    const firstDetach = mock();
    const secondAttach = mock();
    const first = special({attach: firstAttach, detach: firstDetach, update: () => {}});
    const second = special({attach: secondAttach, update: () => {}});

    reconcile(container, first('x'));
    reconcile(container, second('x'));

    expect(firstAttach).toHaveBeenCalledTimes(1);
    expect(firstDetach).toHaveBeenCalledTimes(1);
    expect(secondAttach).toHaveBeenCalledTimes(1);
  });

  test('should clear rendered content when an alias returns nothing', () => {
    const conditional = alias(show => (show ? h('p', null, 'shown') : null));
    reconcile(container, [conditional(true)]);
    expect(container.textContent).toEqual('shown');
    reconcile(container, [conditional(false)]);
    expect(container.textContent).toEqual('');
  });

  test('should swap a listener that changed while the props stayed identical', () => {
    const props = {id: 'btn'};
    const child = 'go';
    let clicked = null;
    const render = label =>
      reconcile(container, [h('button', props, child).on({click: () => (clicked = label)})]);

    render('first');
    render('second');
    container.firstChild.dispatchEvent(new window.MouseEvent('click'));
    expect(clicked).toEqual('second');
  });
});

describe('scheduler', () => {
  test('should run queued tasks on flush', () => {
    const ran = [];
    schedule(() => ran.push('a'));
    schedule(() => ran.push('b'));
    flush();
    expect(ran).toEqual(['a', 'b']);
  });

  test('should also run tasks queued during a flush', () => {
    const ran = [];
    schedule(() => {
      ran.push('outer');
      schedule(() => ran.push('inner'));
    });
    flush();
    expect(ran).toEqual(['outer', 'inner']);
  });

  test('should not run tasks whose signal was aborted', () => {
    const controller = new AbortController();
    const task = mock();
    schedule(task, {signal: controller.signal});
    controller.abort();
    flush();
    expect(task).not.toHaveBeenCalled();
  });

  test('should drop everything on clear', () => {
    const task = mock();
    schedule(task);
    clear();
    flush();
    expect(task).not.toHaveBeenCalled();
  });

  test('should keep running after an error in a task', () => {
    const consoleError = console.error;
    console.error = () => {};
    const after = mock();
    try {
      schedule(() => {
        throw new Error('task failed');
      });
      schedule(after);
      flush();
    } finally {
      console.error = consoleError;
    }
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe('chained styling, classes, attrs and dataset', () => {
  test('should apply every facet chained onto a child vnode', () => {
    reconcile(container, [
      h('p', {id: 'p'}, 'hi')
        .style({color: 'red'})
        .classes('a', 'b')
        .attrs({role: 'note'})
        .data({foo: 'bar'})
        .key('k'),
    ]);
    const p = container.firstChild;
    expect(p.style.color).toBe('red');
    expect(p.className).toBe('a b');
    expect(p.getAttribute('role')).toBe('note');
    expect(p.dataset.foo).toBe('bar');
    expect(p.textContent).toBe('hi');
  });

  test('should update a facet on a reused child node', () => {
    const render = color => reconcile(container, [h('p', {id: 'p'}).style({color})]);
    render('red');
    const p = container.firstChild;
    render('blue');
    expect(container.firstChild).toBe(p);
    expect(p.style.color).toBe('blue');
  });

  test('should flatten and skip blanks in chained classes', () => {
    reconcile(container, h('div').classes('a', ['b', null, ['c']], false, ''));
    expect(container.className).toBe('a b c');
  });

  test('should replace rather than merge when a setter is called twice', () => {
    reconcile(container, h('div').classes('a').classes('b').style({color: 'red'}).style({}));
    expect(container.className).toBe('b');
    expect(container.style.color).toBe('');
  });

  test('should remove everything chained when the node is cleaned up', () => {
    reconcile(
      container,
      h('div').style({color: 'red'}).classes('a').attrs({role: 'main'}).data({foo: 'bar'}),
    );
    reconcile(container, null);
    expect(container.style.color).toBe('');
    expect(container.className).toBe('');
    expect(container.getAttribute('role')).toBe(null);
    expect(container.dataset.foo).toBeUndefined();
  });

  test('should not re-render when a chained map is rebuilt with the same contents', () => {
    // Props and hooks are held stable so that the chained map is the only thing
    // the reconciler could notice a change in.
    const props = {id: 'p'};
    const hooks = {$update: mock()};
    const render = color => reconcile(container, [h('p', props).style({color}).on(hooks)]);

    render('red');
    render('red');
    expect(hooks.$update).toHaveBeenCalledTimes(1);

    render('blue');
    expect(hooks.$update).toHaveBeenCalledTimes(2);
  });

  test('should reject chaining onto alias and special nodes', () => {
    const myAlias = alias(text => h('p', null, text));
    const mySpecial = special({});
    expect(() => myAlias('x').style({color: 'red'})).toThrow(
      '.style() can only be used on element nodes (h).',
    );
    expect(() => myAlias('x').classes('a')).toThrow(
      '.classes() can only be used on element nodes (h).',
    );
    expect(() => mySpecial('x').attrs({role: 'main'})).toThrow(
      '.attrs() can only be used on element nodes (h).',
    );
    expect(() => mySpecial('x').data({foo: 'bar'})).toThrow(
      '.data() can only be used on element nodes (h).',
    );
  });

  test('should reject a non-map value for the map taking setters', () => {
    // A fresh target each time: the throw leaves the previous one half claimed.
    const target = () => document.createElement('div');
    expect(() => reconcile(target(), h('div').style('color: red'))).toThrow(
      'invalid value for .style(), expected a map',
    );
    expect(() => reconcile(target(), h('div').attrs(['role', 'main']))).toThrow(
      'invalid value for .attrs(), expected a map',
    );
    expect(() => reconcile(target(), h('div').data('foo'))).toThrow(
      'invalid value for .data(), expected a map',
    );
  });
});

describe('deprecated $-prefixed props', () => {
  let consoleWarn;
  beforeEach(() => {
    consoleWarn = console.warn;
    console.warn = () => {};
  });
  afterEach(() => {
    console.warn = consoleWarn;
  });

  test('should still apply and remove every facet', () => {
    reconcile(
      container,
      h('div', {
        $styling: {color: 'red'},
        $attrs: {role: 'main'},
        $dataset: {foo: 'a'},
        $classes: ['c1'],
      }),
    );
    expect(container.style.color).toBe('red');
    expect(container.getAttribute('role')).toBe('main');
    expect(container.dataset.foo).toBe('a');
    expect(container.className).toBe('c1');

    reconcile(container, h('div'));
    expect(container.style.color).toBe('');
    expect(container.getAttribute('role')).toBe(null);
    expect(container.dataset.foo).toBeUndefined();
    expect(container.className).toBe('');
  });

  test('should warn once per prop name', () => {
    const warn = mock();
    console.warn = warn;
    // A fresh instance, because the notice is only given once per prop name.
    const fresh = dodo();
    fresh.reconcile(container, fresh.h('div', {$dataset: {foo: 'a'}}));
    fresh.reconcile(container, fresh.h('div', {$dataset: {foo: 'b'}}));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('.data()');

    fresh.reconcile(container, fresh.h('div', {$classes: ['a']}));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('.classes()');
  });
});

describe('special props, namespaces and custom settings', () => {
  test('styling, attrs, dataset add and remove', () => {
    reconcile(
      container,
      h('div', {id: 'root'})
        .style({color: 'red', 'font-size': '12px'})
        .attrs({role: 'main', 'aria-label': 'x'})
        .data({foo: 'a', bar: 'b'})
        .classes('c1', 'c2'),
    );
    expect(container.style.color).toBe('red');
    expect(container.getAttribute('role')).toBe('main');
    expect(container.dataset.foo).toBe('a');
    expect(container.className).toBe('c1 c2');

    reconcile(
      container,
      h('div', {id: 'root'})
        .style({color: 'blue'})
        .attrs({role: 'nav'})
        .data({foo: 'z'})
        .classes('c2'),
    );
    expect(container.style.color).toBe('blue');
    expect(container.style.getPropertyValue('font-size')).toBe('');
    expect(container.getAttribute('aria-label')).toBe(null);
    expect(container.dataset.bar).toBeUndefined();
    expect(container.className).toBe('c2');

    reconcile(container, h('div', {id: 'root'}));
    expect(container.style.color).toBe('');
    expect(container.getAttribute('role')).toBe(null);
    expect(container.className).toBe('');
  });

  test('svg children get the svg namespace and attribute props', () => {
    reconcile(container, [h('svg', {width: '10'}, h('circle', {cx: '1', r: '2'}))]);
    const svg = container.firstChild;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.firstChild.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.firstChild.getAttribute('cx')).toBe('1');
    expect(svg.getAttribute('width')).toBe('10');
  });

  test('keyed reorder preserves node identity', () => {
    const list = order =>
      h(
        'ul',
        null,
        order.map(k => h('li', null, k).key(k)),
      );
    reconcile(container, [list(['a', 'b', 'c'])]);
    const ul = container.firstChild;
    const nodes = new Map([...ul.childNodes].map(n => [n.textContent, n]));

    reconcile(container, [list(['c', 'a', 'b'])]);
    expect(ul.textContent).toBe('cab');
    expect(ul.childNodes[0]).toBe(nodes.get('c'));
    expect(ul.childNodes[1]).toBe(nodes.get('a'));

    reconcile(container, [list(['b'])]);
    expect(ul.textContent).toBe('b');
    expect(ul.childNodes.length).toBe(1);
  });

  test('custom map settings still drive the reconciler', () => {
    const custom = dodo({
      isMap: x => x instanceof Map,
      mapIter: m => m.entries(),
      mapGet: (m, k) => m.get(k),
      newMap: obj => new Map(Object.entries(obj ?? {})),
      mapPut: (m, k, v) => new Map(m).set(k, v),
      mapMerge: (...ms) => new Map(ms.flatMap(m => [...m])),
    });
    const props = new Map([['id', 'custom']]);
    custom.reconcile(
      container,
      custom.h('div', props, custom.h('p', null, 'hi')).style(new Map([['color', 'green']])),
    );
    expect(container.id).toBe('custom');
    expect(container.style.color).toBe('green');
    expect(container.textContent).toBe('hi');

    custom.reconcile(
      container,
      custom.h('div', new Map([['id', 'custom2']]), custom.h('p', null, 'bye')),
    );
    expect(container.id).toBe('custom2');
    expect(container.style.color).toBe('');
    expect(container.textContent).toBe('bye');
  });

  test('settings.mapIter keeps returning independent entry pairs', () => {
    const {settings} = dodo();
    const entries = [...settings.mapIter({a: 1, b: 2})];
    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('connected reordering', () => {
  let mounted;
  beforeEach(() => {
    mounted = document.createElement('div');
    document.body.appendChild(mounted);
  });

  test('should reorder a keyed list that is live in the document', () => {
    const list = order =>
      h(
        'ul',
        null,
        order.map(k => h('li', null, k).key(k)),
      );
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    const ul = mounted.firstChild;
    expect(ul.isConnected).toBe(true);

    reconcile(mounted, [list(['c', 'b', 'a'])]);
    expect(ul.textContent).toEqual('cba');
  });

  test('should keep focus on an input while its siblings change', () => {
    const list = items =>
      h(
        'div',
        null,
        items.map(item => h('input', {value: item, id: item}).key(item)),
      );
    reconcile(mounted, [list(['a', 'b'])]);
    const focused = mounted.querySelector('#a');
    focused.focus();
    expect(document.activeElement).toBe(focused);

    reconcile(mounted, [list(['a', 'b', 'c'])]);
    expect(document.activeElement).toBe(focused);
    expect(mounted.firstChild.childNodes.length).toEqual(3);
  });
});

describe('reordering around a focused child', () => {
  let mounted;
  const list = order =>
    h(
      'div',
      null,
      order.map(k => h('input', {id: k}).key(k)),
    );
  const order = () => [...mounted.firstChild.childNodes].map(n => n.id).join('');

  beforeEach(() => {
    mounted = document.createElement('div');
    document.body.appendChild(mounted);
  });

  test('should move a focused child to the front without blurring it', () => {
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    const focused = mounted.querySelector('#b');
    focused.focus();

    reconcile(mounted, [list(['b', 'a', 'c'])]);
    expect(order()).toEqual('bac');
    expect(document.activeElement).toBe(focused);
  });

  test('should move a focused child to the back without blurring it', () => {
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    const focused = mounted.querySelector('#a');
    focused.focus();

    reconcile(mounted, [list(['b', 'c', 'a'])]);
    expect(order()).toEqual('bca');
    expect(document.activeElement).toBe(focused);
  });

  test('should reorder both sides of a focused child', () => {
    reconcile(mounted, [list(['a', 'b', 'c', 'd'])]);
    const focused = mounted.querySelector('#b');
    focused.focus();

    reconcile(mounted, [list(['c', 'd', 'b', 'a'])]);
    expect(order()).toEqual('cdba');
    expect(document.activeElement).toBe(focused);
  });

  test('should reorder correctly after focus moves between children', () => {
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    mounted.querySelector('#a').focus();
    const focused = mounted.querySelector('#b');
    focused.focus();

    reconcile(mounted, [list(['c', 'b', 'a'])]);
    expect(order()).toEqual('cba');
    expect(document.activeElement).toBe(focused);
  });

  test('should reorder correctly after focus leaves the list', () => {
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    mounted.querySelector('#b').focus();
    mounted.querySelector('#b').blur();

    reconcile(mounted, [list(['c', 'b', 'a'])]);
    expect(order()).toEqual('cba');
  });

  test('should insert and remove around a focused child', () => {
    reconcile(mounted, [list(['a', 'b', 'c'])]);
    const focused = mounted.querySelector('#b');
    focused.focus();

    reconcile(mounted, [list(['x', 'b', 'y'])]);
    expect(order()).toEqual('xby');
    expect(document.activeElement).toBe(focused);
  });
});
