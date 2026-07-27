/**
 * `@3sln/dodo/context` — the context module bound to dodo's default instance.
 *
 *     import {withContext, useContext} from '@3sln/dodo/context';
 *
 * If you build your own dodo with `dodo(userSettings)`, bake your own copy
 * instead so both halves share one instance:
 *
 *     import context from '@3sln/dodo/src/context.js';
 *     const {withContext, useContext} = context(myDodo);
 */
import * as dodo from './index.js';
import contextFactory from './src/context.js';

export {default as context} from './src/context.js';

export const {
  withContext,
  withEncapsulatedContext,
  useContext,
  contextCell,
  readContext,
  attachContext,
  updateContext,
  detachContext,
} = contextFactory(dodo);
