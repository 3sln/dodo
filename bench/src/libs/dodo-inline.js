import * as dd from '@3sln/dodo';

// The same tree as `dodo.js`, but rows are a plain function rather than an
// `alias`. An alias is backed by a real `<udom-alias>` element, so the aliased
// version puts 1,000 extra elements in the document that no other library here
// creates — React and preact components cost no DOM at all. Measuring both says
// what that wrapper costs, and what dodo's memoisation buys in exchange.
const row = item =>
  dd
    .tr(
      dd.td(item.id).props({className: 'col-md-1'}),
      dd.td(dd.a(item.label)).props({className: 'col-md-4'}),
      dd
        .td(
          dd.a(
            dd
              .span()
              .props({className: 'glyphicon glyphicon-remove'})
              .attrs({'aria-hidden': 'true'}),
          ),
        )
        .props({className: 'col-md-1'}),
      dd.td().props({className: 'col-md-6'}),
    )
    .props({id: item.id, className: item.selected ? 'danger' : ''})
    .key(item.id);

const app = items =>
  dd
    .div(
      dd
        .div(dd.div(dd.div(dd.h1('dodo')).props({className: 'col-md-6'})).props({className: 'row'}))
        .props({className: 'jumbotron'}),
      dd
        .table(dd.tbody(items.map(row)))
        .props({className: 'table table-hover table-striped test-data'}),
    )
    .props({className: 'container'});

let root;

export default {
  name: 'dodo (no alias)',
  mount(container) {
    root = container;
  },
  render(items) {
    dd.reconcile(root, [app(items)]);
  },
  unmount() {
    dd.reconcile(root, null);
  },
};
