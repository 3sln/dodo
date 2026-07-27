/**
 * `@3sln/dodo/reactive` — the reactive module bound to dodo's default instance.
 *
 *     import {cell, watch} from '@3sln/dodo/reactive';
 *
 * If you build your own dodo with `dodo(userSettings)`, bake your own copy
 * instead so both halves share one instance:
 *
 *     import reactive from '@3sln/dodo/src/reactive.js';
 *     const {watch} = reactive(myDodo);
 */
import * as dodo from './index.js';
import reactiveFactory from './src/reactive.js';

export * from './src/reactive.js';
export {default as reactive} from './src/reactive.js';

export const {watch} = reactiveFactory(dodo);
