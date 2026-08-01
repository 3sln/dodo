/** @jsx React.createElement */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

// `flushSync` because React would otherwise decide for itself when to do the
// work, and a benchmark that stops timing before the work happens measures
// nothing. Rows are plain components with no `memo`, matching the other
// libraries here, none of which have an equivalent to opt into.
const Row = ({item}) => (
  <tr id={item.id} className={item.selected ? 'danger' : ''}>
    <td className="col-md-1">{item.id}</td>
    <td className="col-md-4">
      <a>{item.label}</a>
    </td>
    <td className="col-md-1">
      <a>
        <span className="glyphicon glyphicon-remove" aria-hidden="true" />
      </a>
    </td>
    <td className="col-md-6" />
  </tr>
);

const App = ({items}) => (
  <div className="container">
    <div className="jumbotron">
      <div className="row">
        <div className="col-md-6">
          <h1>React</h1>
        </div>
      </div>
    </div>
    <table className="table table-hover table-striped test-data">
      <tbody>
        {items.map(item => (
          <Row key={item.id} item={item} />
        ))}
      </tbody>
    </table>
  </div>
);

let reactRoot;

export default {
  name: 'React',
  mount(container) {
    reactRoot = createRoot(container);
  },
  render(items) {
    flushSync(() => reactRoot.render(<App items={items} />));
  },
  unmount() {
    reactRoot.unmount();
  },
};
