import vdom from './src/vdom.js';

// Create a default API instance by calling the factory with no settings.
const { h, o, alias, special, reconcile } = vdom();

// Export the factory itself for users who want to create a custom instance,
// and export the functions from the default instance for convenience.
export { vdom, h, o, alias, special, reconcile };

// Export all the HTML helpers.
export * from './src/html.js';
