import * as dd from '@3sln/dodo';
import app from './app.js';
import {store} from './store.js';

const target = document.querySelector('.todoapp');

// Subscribe to store changes and reconcile the app component with the new state.
store.subscribe(state => {
  dd.reconcile(target, app(state));
});

// Initial render
store.init();
