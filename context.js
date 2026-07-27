/**
 * `@3sln/dodo/context` — the context module bound to dodo's default instance.
 *
 *     import {withContext, useContext} from '@3sln/dodo/context';
 *
 * Built from the same shared settings object as `@3sln/dodo/reactive`, so the
 * `watch` re-exported here is that module's `watch`, not a second copy.
 *
 * If you build your own dodo with `dodo(userSettings)`, bake your own copy and
 * hand the same settings object to both factories:
 *
 *     import reactive from '@3sln/dodo/src/reactive.js';
 *     import context from '@3sln/dodo/src/context.js';
 *
 *     const userSettings = {dodo: myDodo};
 *     const {watch} = reactive(userSettings);
 *     const {withContext, useContext} = context(userSettings);
 */
import contextFactory from './src/context.js';
import {defaultSettings} from './src/default-instance.js';

export {default as context} from './src/context.js';
export {settings} from './src/settings.js';

export const {
  withContext,
  withEncapsulatedContext,
  useContext,
  contextCell,
  readContext,
  attachContext,
  updateContext,
  detachContext,
  watch,
} = contextFactory(defaultSettings);
