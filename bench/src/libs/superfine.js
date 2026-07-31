import {h, text, patch} from 'superfine';

const row = item =>
  h('tr', {key: item.id, id: item.id, className: item.selected ? 'danger' : ''}, [
    h('td', {className: 'col-md-1'}, [text(item.id)]),
    h('td', {className: 'col-md-4'}, [h('a', {}, [text(item.label)])]),
    h('td', {className: 'col-md-1'}, [
      h('a', {}, [h('span', {className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true'}, [])]),
    ]),
    h('td', {className: 'col-md-6'}, []),
  ]);

const app = items =>
  h('div', {className: 'container'}, [
    h('div', {className: 'jumbotron'}, [
      h('div', {className: 'row'}, [
        h('div', {className: 'col-md-6'}, [h('h1', {}, [text('superfine')])]),
      ]),
    ]),
    h('table', {className: 'table table-hover table-striped test-data'}, [
      h('tbody', {}, items.map(row)),
    ]),
  ]);

let node;

export default {
  name: 'superfine',
  mount(container) {
    const host = document.createElement('div');
    container.appendChild(host);
    node = host;
  },
  render(items) {
    node = patch(node, app(items));
  },
  unmount() {
    node = patch(node, h('div', {}, []));
  },
};
