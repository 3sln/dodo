import {h, render} from 'preact';

const row = item =>
  h('tr', {key: item.id, id: item.id, className: item.selected ? 'danger' : ''}, [
    h('td', {className: 'col-md-1'}, item.id),
    h('td', {className: 'col-md-4'}, h('a', null, item.label)),
    h(
      'td',
      {className: 'col-md-1'},
      h('a', null, h('span', {className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true'})),
    ),
    h('td', {className: 'col-md-6'}),
  ]);

const app = items =>
  h('div', {className: 'container'}, [
    h(
      'div',
      {className: 'jumbotron'},
      h('div', {className: 'row'}, h('div', {className: 'col-md-6'}, h('h1', null, 'preact'))),
    ),
    h(
      'table',
      {className: 'table table-hover table-striped test-data'},
      h('tbody', null, items.map(row)),
    ),
  ]);

let root;

export default {
  name: 'preact',
  mount(container) {
    root = container;
  },
  render(items) {
    render(app(items), root);
  },
  unmount() {
    render(null, root);
  },
};
