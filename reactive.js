/**
 * `@3sln/dodo/reactive` — the reactive module bound to dodo's default instance.
 *
 *     import {cell, watch} from '@3sln/dodo/reactive';
 *
 * This `watch` is the same one `@3sln/dodo/context` renders through; both entry
 * points are built from one shared settings object.
 *
 * If you build your own dodo with `dodo(userSettings)`, or you want to replace
 * the scheduler or the error view, bake your own copy instead — and pass the
 * same settings object to `context` so the two stay one system:
 *
 *     import reactive from '@3sln/dodo/src/reactive.js';
 *     import context from '@3sln/dodo/src/context.js';
 *
 *     const userSettings = {dodo: myDodo};
 *     const {watch} = reactive(userSettings);
 *     const {withContext} = context(userSettings);
 */
import reactiveFactory from './src/reactive.js';
import {defaultSettings} from './src/default-instance.js';

export * from './src/reactive.js';
export {default as reactive} from './src/reactive.js';
export {settings} from './src/settings.js';

export const {watch} = reactiveFactory(defaultSettings);
