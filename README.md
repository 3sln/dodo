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