import * as dd from '@3sln/dodo';
import {store} from './store.js';

const ENTER_KEY = 'Enter';
const ESCAPE_KEY = 'Escape';

const todoItem = dd.alias(props => {
  const {todo, isEditing} = props;

  const finishEdit = e => store.finishEditing(todo, e.target.value);
  const cancelEdit = e => {
    if (e.key === ESCAPE_KEY) {
      store.cancelEditing(todo);
    }
  };

  return (
    dd
      .li(
        dd
          .div(
            dd
              .input()
              .props({type: 'checkbox', checked: todo.completed})
              .classes('toggle')
              .on({change: () => store.toggleTodo(todo)}),
            dd.label(todo.title).on({dblclick: () => store.startEditing(todo)}),
            dd
              .button()
              .classes('destroy')
              .on({click: () => store.removeTodo(todo)}),
          )
          .classes('view'),
        isEditing &&
          dd
            .input()
            .props({value: todo.title})
            .classes('edit')
            .on({
              blur: finishEdit,
              keyup: cancelEdit,
              keydown: e => {
                if (e.key === ENTER_KEY) finishEdit(e);
              },
              // Use $attach hook to focus the element when it's created
              $attach: el => el.focus(),
            }),
      )
      // Blank names are skipped, so the conditionals need no filtering.
      .classes(todo.completed && 'completed', isEditing && 'editing')
      .key(todo.id)
  );
});

const app = dd.alias(props => {
  const {todos, filter, editingTodo} = props;

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const handleNewTodo = e => {
    if (e.key === ENTER_KEY) {
      const title = e.target.value.trim();
      if (title) {
        store.addTodo(title);
        e.target.value = '';
      }
    }
  };

  const filterLink = (href, label, name) =>
    dd.li(
      dd
        .a(label)
        .props({href})
        .classes(filter === name && 'selected'),
    );

  return dd
    .section(
      dd
        .header(
          dd.h1('todos'),
          dd
            .input()
            .props({placeholder: 'What needs to be done?', autofocus: true})
            .classes('new-todo')
            .on({keydown: handleNewTodo}),
        )
        .classes('header'),
      todos.length > 0 &&
        dd
          .section(
            dd
              .input()
              .props({id: 'toggle-all', type: 'checkbox', checked: activeCount === 0})
              .classes('toggle-all')
              .on({change: e => store.toggleAll(e.target.checked)}),
            dd.label('Mark all as complete').props({htmlFor: 'toggle-all'}),
            dd
              .ul(filteredTodos.map(todo => todoItem({todo, isEditing: editingTodo === todo})))
              .classes('todo-list'),
          )
          .classes('main'),
      todos.length > 0 &&
        dd
          .footer(
            dd
              .span(dd.strong(activeCount), ` item${activeCount !== 1 ? 's' : ''} left`)
              .classes('todo-count'),
            dd
              .ul(
                filterLink('#/all', 'All', 'all'),
                filterLink('#/active', 'Active', 'active'),
                filterLink('#/completed', 'Completed', 'completed'),
              )
              .classes('filters'),
            completedCount > 0 &&
              dd
                .button('Clear completed')
                .classes('clear-completed')
                .on({click: () => store.clearCompleted()}),
          )
          .classes('footer'),
    )
    .classes('todoapp');
});

export default app;
