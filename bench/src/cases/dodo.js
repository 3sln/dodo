import * as dd from '@3sln/dodo';

// --- Data --- //
let idCounter = 1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function buildData(count = 1000) {
    let data = new Array(count);
    for (let i = 0; i < count; i++) {
        data[i] = {
            id: idCounter++,
            label: adjectives[_random(adjectives.length)] + " " + colours[_random(colours.length)] + " " + nouns[_random(nouns.length)]
        }
    }
    return data;
}

function _random(max) {
    return Math.round(Math.random() * 1000) % max;
}

// --- Dodo Component --- //

// The key is removed from inside the alias
const row = dd.alias(({ item }) => {
    return dd.tr({ id: item.id },
        dd.td({ className: 'col-md-1' }, item.id),
        dd.td({ className: 'col-md-4' },
            dd.a(item.label)
        ),
        dd.td({ className: 'col-md-1' },
            dd.a(dd.span({ className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true' }))
        ),
        dd.td({ className: 'col-md-6' })
    );
});

const app = dd.alias(({ items }) => {
    return dd.div({ className: 'container' },
        dd.div({ className: 'jumbotron' },
            dd.div({ className: 'row' },
                dd.div({ className: 'col-md-6' }, dd.h1('dodo')),
            )
        ),
        dd.table({ className: 'table table-hover table-striped test-data' },
            dd.tbody(
                items.map(item => 
                    // The key is applied to the alias VNode itself
                    row({ item }).key(item.id)
                )
            )
        )
    );
});

// --- Benchmark Cases --- //

let root, data;

export default {
    // Setup function to create the DOM container
    setup: (container) => {
        root = container;
    },
    // Test cases
    'Create 1,000 rows': () => {
        data = buildData(1000);
        dd.reconcile(root, app({ items: data }));
    },
    'Replace 1,000 rows': () => {
        data = buildData(1000);
        dd.reconcile(root, app({ items: data }));
    },
    'Partial update': () => {
        for (let i = 0; i < data.length; i += 10) {
            data[i].label += ' !!!';
        }
        dd.reconcile(root, app({ items: data }));
    },
    'Select row': () => {
        const index = _random(data.length);
        data[index].selected = true;
        dd.reconcile(root, app({ items: data }));
        data[index].selected = false;
    },
    'Swap rows': () => {
        if (data.length > 998) {
            let a = data[1];
            data[1] = data[998];
            data[998] = a;
        }
        dd.reconcile(root, app({ items: data }));
    },
    'Remove row': () => {
        const index = _random(data.length);
        data.splice(index, 1);
        dd.reconcile(root, app({ items: data }));
    },
    'Append 1,000 rows': () => {
        data = data.concat(buildData(1000));
        dd.reconcile(root, app({ items: data }));
    },
    'Clear rows': () => {
        data = [];
        dd.reconcile(root, app({ items: [] }));
    },
};