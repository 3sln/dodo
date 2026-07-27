# Dodo

> [!WARNING]
> This is a work-in-progress project and is not yet ready for production use.

A minimal, configurable virtual DOM library.

## Documentation

For detailed documentation, live demos, and advanced usage examples, please check out the [Dodo Deck](https://dodo.3sln.com).

## Quick Start

Installation:
```shell
npm install @3sln/dodo
# or
bun add @3sln/dodo
# or
yarn add @3sln/dodo
```

Basic usage:
```javascript
import { reconcile, h1, p, div } from '@3sln/dodo';

const container = document.getElementById('root');

// Use helper functions like h1(), p(), etc. for standard elements.
// The props object is optional.
const myVdom = div({ id: 'app' },
  h1('Hello, dodo!'),
  p('This is a paragraph.')
);

// Reconcile the virtual DOM with the real DOM.
reconcile(container, [myVdom]);
```

## Optional modules

Two modules ship alongside the core. Dodo's core does not import either of them,
so they cost nothing if you do not use them.

### Reactivity — `@3sln/dodo/reactive`

Reactive rendering built on a two method `Cell` protocol:

```javascript
{ onDirty(fn) -> unsubscribe, getValue() -> any }
```

Dodo does not depend on the observable protocol, on signals, or on any other
library — it depends on this. Adapters bridge the rest (`fromObservable`,
`fromSubscribe`, `fromSignal`), and `cell()` is there if you would rather not
bring anything at all.

```javascript
import {reconcile, p} from '@3sln/dodo';
import {cell, watch} from '@3sln/dodo/reactive';

const name = cell('world');

reconcile(container, [watch(name, value => p(`hello ${value}`))]);

name.setValue('dodo'); // re-renders on the next frame
```

### Context — `@3sln/dodo/context`

DOM-scoped context, so data reaches a descendant without passing through every
component in between. Providers respect shadow DOM boundaries, and consumers
name the keys they care about so unrelated changes do not re-render them.

```javascript
import {withContext, useContext} from '@3sln/dodo/context';

withContext({theme: 'dark'},
  someDeeplyNestedTree(
    useContext(['theme'], ({theme}) => p(`theme is ${theme}`)),
  ),
)
```

### Baking your own

Both modules follow the same factory pattern as the rest of the project. If you
use a custom dodo instance, or want to replace the scheduler or the error view,
build your own. Context renders through a `watch`, so it requires the reactive
API to be injected — build it once and pass it in:

```javascript
import reactive from '@3sln/dodo/src/reactive.js';
import context from '@3sln/dodo/src/context.js';

const userSettings = {dodo: myDodo, schedule: fn => fn()};

const {watch} = reactive(userSettings);
const {withContext, useContext} = context({...userSettings, reactive: {watch}});
```