import {init, propsModule, attributesModule, h} from 'snabbdom';

const patch = init([propsModule, attributesModule]);

const row = item =>
  h('tr', {key: item.id, props: {id: item.id, className: item.selected ? 'danger' : ''}}, [
    h('td', {props: {className: 'col-md-1'}}, String(item.id)),
    h('td', {props: {className: 'col-md-4'}}, h('a', item.label)),
    h(
      'td',
      {props: {className: 'col-md-1'}},
      h(
        'a',
        h('span', {
          props: {className: 'glyphicon glyphicon-remove'},
          attrs: {'aria-hidden': 'true'},
        }),
      ),
    ),
    h('td', {props: {className: 'col-md-6'}}),
  ]);

const app = items =>
  h('div', {props: {className: 'container'}}, [
    h('div', {props: {className: 'jumbotron'}}, [
      h('div', {props: {className: 'row'}}, [
        h('div', {props: {className: 'col-md-6'}}, [h('h1', 'snabbdom')]),
      ]),
    ]),
    h('div', {props: {className: 'table table-hover table-striped test-data'}}, [
      h('table', [h('tbody', items.map(row))]),
    ]),
  ]);

// snabbdom patches over whatever it is handed and hands back a vnode, so the
// first patch takes an element and every one after it takes the last vnode.
let current;

export default {
  name: 'snabbdom',
  mount(container) {
    const host = document.createElement('div');
    container.appendChild(host);
    current = host;
  },
  render(items) {
    current = patch(current, app(items));
  },
  unmount() {
    current = patch(current, h('div'));
  },
};
