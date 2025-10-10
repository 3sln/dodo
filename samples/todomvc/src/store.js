const STORAGE_KEY = 'todos-dodo';

// Use `let` to allow the state object to be replaced.
let state = {
  todos: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
  filter: 'all',
  editingTodo: null,
};

const listeners = new Set();

function notify() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  listeners.forEach(listener => listener(state));
}

export const store = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  addTodo(title) {
    state = {
      ...state,
      todos: [...state.todos, {id: Date.now(), title, completed: false}],
    };
    notify();
  },

  removeTodo(todo) {
    state = {
      ...state,
      todos: state.todos.filter(t => t !== todo),
    };
    notify();
  },

  toggleTodo(todo) {
    state = {
      ...state,
      todos: state.todos.map(t => (t === todo ? {...t, completed: !t.completed} : t)),
    };
    notify();
  },

  toggleAll(completed) {
    state = {
      ...state,
      todos: state.todos.map(t => ({...t, completed})),
    };
    notify();
  },

  clearCompleted() {
    state = {
      ...state,
      todos: state.todos.filter(t => !t.completed),
    };
    notify();
  },

  startEditing(todo) {
    state = {...state, editingTodo: todo};
    notify();
  },

  finishEditing(todo, newTitle) {
    if (state.editingTodo !== todo) return;
    const title = newTitle.trim();
    if (title === '') {
      this.removeTodo(todo);
    } else {
      state = {
        ...state,
        todos: state.todos.map(t => (t === todo ? {...t, title} : t)),
        editingTodo: null,
      };
      notify();
    }
  },

  cancelEditing(todo) {
    if (state.editingTodo === todo) {
      state = {...state, editingTodo: null};
      notify();
    }
  },

  setFilter(filter) {
    state = {...state, filter};
    notify();
  },

  init() {
    notify();
  },
};

// Handle hash changes for filtering
window.addEventListener('hashchange', () => {
  const filter = window.location.hash.replace(/#\/?/, '');
  if (['all', 'active', 'completed'].includes(filter)) {
    store.setFilter(filter);
  } else {
    window.location.hash = '';
    store.setFilter('all');
  }
});

// Trigger initial filter state
store.setFilter(window.location.hash.replace(/#\/?/, '') || 'all');
