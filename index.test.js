import { test, expect, describe, beforeEach, mock } from 'bun:test';
import { Window } from 'happy-dom';
import {
  h,
  o,
  alias,
  special,
  reconcile,
} from './index.js';

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  container = document.createElement('div');
});

describe('reconcile function', () => {
  test('should reconcile an ELEMENT_NODE onto a matching DOM element', () => {
    const vdom = h('div', {
      id: 'root'
    }, h('span', null, 'Hello'));
    reconcile(container, vdom);
    expect(container.id).toEqual('root');
    expect(container.innerHTML).toEqual('<span>Hello</span>');
  });

  test('should throw an error when reconciling an ELEMENT_NODE onto a mismatched DOM element', () => {
    const vdom = h('span', null, 'Hello');
    expect(() => reconcile(container, vdom)).toThrow('incompatible target for vdom');
  });

  test('should reconcile an OPAQUE_NODE onto a matching DOM element', () => {
    const vdom = o('div', {
      classes: ['opaque-container']
    });
    reconcile(container, vdom);
    expect(container.className).toEqual('opaque-container');
  });

  test('should throw an error when reconciling an OPAQUE_NODE onto a mismatched DOM element', () => {
    const vdom = o('span', {
      class: 'opaque-container'
    });
    expect(() => reconcile(container, vdom)).toThrow('incompatible target for vdom');
  });

  test('should reconcile an ALIAS_NODE onto any DOM element', () => {
    const myAlias = alias((text) => h('p', null, text));
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
      disabled: false
    });
    reconcile(rootDiv, vdom1);
    expect(rootDiv.disabled).toBe(false);

    const vdom2 = h('div', {
      id: 'my-div',
      disabled: true
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
});


describe('o function (OPAQUE_NODE) specific behavior', () => {
  let rootDiv;
  beforeEach(() => {
    rootDiv = document.createElement('div');
    container.appendChild(rootDiv);
    rootDiv.innerHTML = '<span>Initial Content</span>';
  });

  test('should create an opaque node with props but not touch children', () => {
    const vdom = o('div', {
      id: 'opaque-div'
    });
    reconcile(rootDiv, vdom);
    expect(rootDiv.id).toEqual('opaque-div');
    expect(rootDiv.innerHTML).toEqual('<span>Initial Content</span>');
  });
});

describe('alias function (ALIAS_NODE) specific behavior', () => {
  test('should re-render when component props change', () => {
    const myComponent = alias((props) => h('span', null, props.text));
    const vdom1 = myComponent({
      text: 'Hello'
    });
    reconcile(container, vdom1);
    const span = container.querySelector('span');
    expect(span.textContent).toEqual('Hello');

    const vdom2 = myComponent({
      text: 'World'
    });
    reconcile(container, vdom2);
    expect(span.textContent).toEqual('World');
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
    const clickHandler = () => { clicked = true; };
    const button = h('button', null, 'Click me').on({ click: clickHandler });
    reconcile(container, [button]);
    const renderedButton = container.firstChild;
    renderedButton.dispatchEvent(new window.MouseEvent('click'));
    expect(clicked).toBe(true);
  });

  test('should remove the old listener when the node is replaced', () => {
    let oldListenerCalled = false;
    const oldListener = () => { oldListenerCalled = true; };
    const oldNode = [h('button', null, 'Old button').on({ click: oldListener })];
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
    const createHandler = () => { created = true; };
    const div = h('div').on({ $attach: createHandler });
    reconcile(container, [div]);
    expect(created).toBe(true);
  });

  test('should call the $detach hook when the node is removed', () => {
    let removed = false;
    const removeHandler = () => { removed = true; };
    const div = h('div').on({ $detach: removeHandler });
    reconcile(container, [div]);
    reconcile(container, null);
    expect(removed).toBe(true);
  });

  test('should call the $update hook after every reconciliation', () => {
    let reconcileCount = 0;
    const reconcileHandler = () => { reconcileCount++; };

    reconcile(container, [h('div').on({ $update: reconcileHandler })]);
    expect(reconcileCount).toBe(1);

    reconcile(container, [h('div', { id: 'updated' }).on({ $update: reconcileHandler })]);
    expect(reconcileCount).toBe(2);

    reconcile(container, null);
    expect(reconcileCount).toBe(2);
  });
});
