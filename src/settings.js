/**
 * Shared settings resolution for dodo's optional modules.
 *
 * The modules follow the same factory shape as the rest of the project: you
 * hand a factory a `userSettings` object carrying a `dodo` instance, and it
 * returns a configured API.
 *
 *     const userSettings = {dodo};
 *     const {watch} = reactive(userSettings);
 *     const {withContext} = context(userSettings);
 *
 * Passing the *same* settings object to both is what makes them one system:
 * factories are memoised against it, so `context` and `reactive` end up sharing
 * a single `watch`. That matters — a `special` component's identity is its
 * descriptor object, so two independently built `watch` components would never
 * reuse each other's DOM nodes.
 *
 * As a convenience a bare dodo instance is accepted in place of the settings
 * object, and memoised against just as well:
 *
 *     const {watch} = reactive(dodo);
 */

// Keyed on the object the caller passed, so nothing is written onto it and a
// frozen settings object works fine.
const apiCaches = new WeakMap();

function microtaskSchedule(fn, {signal} = {}) {
  queueMicrotask(() => {
    if (!signal?.aborted) fn();
  });
}

function defaultRenderError(h) {
  return error =>
    h(
      'pre',
      {
        $styling: {
          'background-color': '#fdd',
          color: '#330',
          padding: '1em',
          'white-space': 'pre-wrap',
        },
      },
      h('strong', null, `Error: ${error?.message ?? String(error)}`),
      '\n\n',
      error?.stack ?? '',
    );
}

function looksLikeDodo(value) {
  return (
    value != null && typeof value.special === 'function' && typeof value.reconcile === 'function'
  );
}

/**
 * Merges user settings with defaults.
 *
 * | setting       | default                                                   |
 * | ------------- | --------------------------------------------------------- |
 * | `dodo`        | required                                                   |
 * | `schedule`    | the instance's `schedule`, else a microtask                |
 * | `renderError` | a plain `<pre>` with the message and stack                 |
 */
export function settings(userSettings) {
  const source = looksLikeDodo(userSettings) ? {dodo: userSettings} : userSettings;
  const dodo = source?.dodo;
  if (!looksLikeDodo(dodo)) {
    throw new Error('a dodo instance must be provided in settings, e.g. reactive({dodo})');
  }

  return {
    // Rendering is scheduled rather than run inline so that a burst of changes
    // collapses into one pass. Replace it to render synchronously, to render on
    // idle, or to drive frames from a test.
    schedule: typeof dodo.schedule === 'function' ? dodo.schedule : microtaskSchedule,
    renderError: defaultRenderError(dodo.h),
    ...source,
    dodo,
    // Map handling and change detection always come from the dodo instance. A
    // module that disagreed with its renderer about what a map is would be
    // worse than useless, so these are not overridable here.
    ...dodo.settings,
  };
}

/**
 * Builds a module's API once per settings object.
 *
 * `build` receives the resolved settings and the original object the caller
 * passed, so that a module can hand that same object to another factory and hit
 * its cache.
 */
export function moduleApi(userSettings, key, build) {
  if (userSettings == null || typeof userSettings !== 'object') {
    throw new Error('a dodo instance must be provided in settings, e.g. reactive({dodo})');
  }

  let cache = apiCaches.get(userSettings);
  if (!cache) {
    cache = new Map();
    apiCaches.set(userSettings, cache);
  }
  if (cache.has(key)) return cache.get(key);

  const api = build(settings(userSettings), userSettings);
  cache.set(key, api);
  return api;
}
