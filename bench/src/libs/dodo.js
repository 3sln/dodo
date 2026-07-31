import * as dd from '@3sln/dodo';

// `className` stays a plain property rather than `.classes()`, because that is
// the single property write every other library here performs.
// The object form, which is how components are usually written. It memoises
// because `shouldUpdate` looks one level into the arguments; comparing them by
// identity alone would rebuild every row on every render, since the wrapper is
// freshly allocated each call.
const row = dd.alias(({item}) =>
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
    .props({id: item.id, className: item.selected ? 'danger' : ''}),
);

const app = dd.alias(({items}) =>
  dd
    .div(
      dd
        .div(dd.div(dd.div(dd.h1('dodo')).props({className: 'col-md-6'})).props({className: 'row'}))
        .props({className: 'jumbotron'}),
      dd
        .table(dd.tbody(items.map(item => row({item}).key(item.id))))
        .props({className: 'table table-hover table-striped test-data'}),
    )
    .props({className: 'container'}),
);

let root;

export default {
  name: 'dodo',
  mount(container) {
    root = container;
  },
  render(items) {
    dd.reconcile(root, app({items}));
  },
  unmount() {
    dd.reconcile(root, null);
  },
};
