import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as dodo from './index.js';
import contextFactory from './src/context.js';

const {h, reconcile, flush, clear} = dodo;
const {withContext, withEncapsulatedContext, useContext, readContext} = contextFactory({dodo});

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('withContext / useContext', () => {
  test('passes data to a descendant', () => {
    reconcile(container, [
      withContext(
        {color: 'red'},
        h(
          'div',
          null,
          useContext(['color'], ({color}) => h('p', null, color)),
        ),
      ),
    ]);
    expect(container.textContent).toBe('red');
  });

  test('re-renders the consumer when the provider data changes', () => {
    const render = color =>
      reconcile(container, [
        withContext(
          {color},
          h(
            'div',
            null,
            useContext(['color'], data => h('p', null, data.color)),
          ),
        ),
      ]);

    render('red');
    expect(container.textContent).toBe('red');

    render('blue');
    flush();
    expect(container.textContent).toBe('blue');
  });

  test('ignores changes to keys the consumer did not ask for', () => {
    const builder = mock(({wanted}) => h('p', null, wanted));
    const render = data =>
      reconcile(container, [withContext(data, h('div', null, useContext(['wanted'], builder)))]);

    render({wanted: 'a', ignored: 1});
    expect(builder).toHaveBeenCalledTimes(1);

    render({wanted: 'a', ignored: 2});
    flush();
    expect(builder).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('a');

    render({wanted: 'b', ignored: 2});
    flush();
    expect(builder).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('b');
  });

  test('nested providers merge, with the nearest one winning', () => {
    reconcile(container, [
      withContext(
        {theme: 'dark', locale: 'en'},
        h(
          'div',
          null,
          withContext(
            {theme: 'light'},
            h(
              'section',
              null,
              useContext(['theme', 'locale'], d => h('p', null, `${d.theme}/${d.locale}`)),
            ),
          ),
        ),
      ),
    ]);
    expect(container.textContent).toBe('light/en');
  });

  test('an outer provider update reaches a consumer below a nested provider', () => {
    const render = locale =>
      reconcile(container, [
        withContext(
          {theme: 'dark', locale},
          withContext(
            {theme: 'light'},
            useContext(['theme', 'locale'], d => h('p', null, `${d.theme}/${d.locale}`)),
          ),
        ),
      ]);

    render('en');
    expect(container.textContent).toBe('light/en');

    render('fr');
    flush();
    expect(container.textContent).toBe('light/fr');
  });

  test('reports undefined for keys no provider supplies', () => {
    reconcile(container, [
      withContext(
        {a: 1},
        useContext(['missing'], d => h('p', null, String(d.missing))),
      ),
    ]);
    expect(container.textContent).toBe('undefined');
  });

  test('works with no provider at all', () => {
    reconcile(container, [useContext(['anything'], d => h('p', null, String(d.anything)))]);
    expect(container.textContent).toBe('undefined');
  });

  test('stops updating a consumer once it is detached', () => {
    const builder = mock(d => h('p', null, d.n));
    reconcile(container, [withContext({n: '1'}, useContext(['n'], builder))]);
    expect(builder).toHaveBeenCalledTimes(1);

    reconcile(container, null);
    flush();
    expect(builder).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
  });
});

describe('shadow DOM encapsulation', () => {
  function mountShadowConsumer(host, keys) {
    const shadow = host.attachShadow({mode: 'open'});
    reconcile(shadow, [useContext(keys, d => h('p', null, String(d.value)))]);
    return shadow;
  }

  test('withContext crosses a shadow boundary', () => {
    const host = document.createElement('div');
    reconcile(container, [withContext({value: 'open'}, h('div', null))]);
    container.querySelector('div').appendChild(host);

    const shadow = mountShadowConsumer(host, ['value']);
    expect(shadow.textContent).toBe('open');
  });

  test('withEncapsulatedContext does not cross a shadow boundary', () => {
    const host = document.createElement('div');
    reconcile(container, [withEncapsulatedContext({value: 'closed'}, h('div', null))]);
    container.querySelector('div').appendChild(host);

    const shadow = mountShadowConsumer(host, ['value']);
    expect(shadow.textContent).toBe('undefined');
  });

  test('an encapsulated provider is visible within its own shadow root', () => {
    const host = document.createElement('div');
    container.appendChild(host);
    const shadow = host.attachShadow({mode: 'open'});
    reconcile(shadow, [
      withEncapsulatedContext(
        {value: 'inner'},
        useContext(['value'], d => h('p', null, String(d.value))),
      ),
    ]);
    expect(shadow.textContent).toBe('inner');
  });

  test('the nearest provider wins regardless of kind', () => {
    reconcile(container, [
      withContext(
        {value: 'open'},
        withEncapsulatedContext(
          {value: 'encapsulated'},
          useContext(['value'], d => h('p', null, String(d.value))),
        ),
      ),
    ]);
    expect(container.textContent).toBe('encapsulated');
  });

  test('an open provider nested inside an encapsulated one still wins', () => {
    reconcile(container, [
      withEncapsulatedContext(
        {value: 'encapsulated'},
        withContext(
          {value: 'open'},
          useContext(['value'], d => h('p', null, String(d.value))),
        ),
      ),
    ]);
    expect(container.textContent).toBe('open');
  });
});

describe('readContext', () => {
  test('reads the visible context imperatively', () => {
    reconcile(container, [withContext({a: 1, b: 2}, h('div', {id: 'leaf'}))]);
    const leaf = container.querySelector('#leaf');
    expect(readContext(leaf, ['a', 'b'])).toEqual({a: 1, b: 2});
    expect(readContext(leaf, ['a'])).toEqual({a: 1});
  });
});
