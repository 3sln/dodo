import * as dd from '@3sln/dodo';
import { store } from './store.js';

const ENTER_KEY = 'Enter';
const ESCAPE_KEY = 'Escape';

const todoItem = dd.alias((props) => {
  const { todo, isEditing } = props;

  const finishEdit = (e) => store.finishEditing(todo, e.target.value);
  const cancelEdit = (e) => {
    if (e.key === ESCAPE_KEY) {
      store.cancelEditing(todo);
    }
  };

  return dd.li({
    $classes: [
      todo.completed && 'completed',
      isEditing && 'editing'
    ].filter(Boolean),
  },
    dd.div({ $classes: ['view'] },
      dd.input({ $classes: ['toggle'], type: 'checkbox', checked: todo.completed })
        .on({ change: () => store.toggleTodo(todo) }),
      dd.label(todo.title)
        .on({ dblclick: () => store.startEditing(todo) }),
      dd.button({ $classes: ['destroy'] })
        .on({ click: () => store.removeTodo(todo) })
    ),
    isEditing && dd.input({
      $classes: ['edit'],
      value: todo.title
    }).on({
      blur: finishEdit,
      keyup: cancelEdit,
      keydown: (e) => {
        if (e.key === ENTER_KEY) finishEdit(e);
      },
      // Use $attach hook to focus the element when it's created
      $attach: (el) => el.focus(),
    })
  ).key(todo.id);
});

const app = dd.alias((props) => {
  const { todos, filter, editingTodo } = props;

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const handleNewTodo = (e) => {
    if (e.key === ENTER_KEY) {
      const title = e.target.value.trim();
      if (title) {
        store.addTodo(title);
        e.target.value = '';
      }
    }
  };

  return dd.section({ className: 'todoapp' },
    dd.header({ className: 'header' },
      dd.h1('todos'),
      dd.input({ 
        className: 'new-todo',
        placeholder: 'What needs to be done?',
        autofocus: true
      }).on({ keydown: handleNewTodo })
    ),
    todos.length > 0 && dd.section({ className: 'main' },
      dd.input({ 
        id: 'toggle-all',
        className: 'toggle-all',
        type: 'checkbox',
        checked: activeCount === 0
      }).on({ change: (e) => store.toggleAll(e.target.checked) }),
      dd.label({ htmlFor: 'toggle-all' }, 'Mark all as complete'),
      dd.ul({ className: 'todo-list' },
        filteredTodos.map(todo => todoItem({ todo, isEditing: editingTodo === todo }))
      )
    ),
    todos.length > 0 && dd.footer({ className: 'footer' },
      dd.span({ className: 'todo-count' },
        dd.strong(activeCount),
        ` item${activeCount !== 1 ? 's' : ''} left`
      ),
      dd.ul({ className: 'filters' },
        dd.li(dd.a({ href: '#/all', className: filter === 'all' ? 'selected' : '' }, 'All')),
        dd.li(dd.a({ href: '#/active', className: filter === 'active' ? 'selected' : '' }, 'Active')),
        dd.li(dd.a({ href: '#/completed', className: filter === 'completed' ? 'selected' : '' }, 'Completed'))
      ),
      completedCount > 0 && dd.button({ className: 'clear-completed' }, 'Clear completed')
        .on({ click: () => store.clearCompleted() })
    )
  );
});

export default app;
