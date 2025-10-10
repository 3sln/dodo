import vdom from './src/vdom.js';

// Create a default API instance by calling the factory with no settings.
const {h, alias, special, reconcile, settings} = vdom();

export {vdom, h, alias, special, reconcile, settings};

// Export all the HTML helpers.
export * from './src/html.js';
export {schedule, flush, clear} from './src/scheduler.js';
