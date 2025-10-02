/** @jsx React.createElement */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

// --- Data --- //
let idCounter = 1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function buildData(count = 1000) {
    let data = new Array(count);
    for (let i = 0; i < count; i++) {
        data[i] = {
            id: idCounter++,
            label: adjectives[_random(adjectives.length)] + " " + colours[_random(colours.length)] + " " + nouns[_random(nouns.length)]
        }
    }
    return data;
}

function _random(max) {
    return Math.round(Math.random() * 1000) % max;
}

// --- React Component --- //

class Row extends React.Component {
    render() {
        let { item } = this.props;
        return (
            <tr id={item.id} className={item.selected ? 'danger' : ''}>
                <td className="col-md-1">{item.id}</td>
                <td className="col-md-4">
                    <a>{item.label}</a>
                </td>
                <td className="col-md-1"><a><span className="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td>
                <td className="col-md-6"></td>
            </tr>
        );
    }
}

class App extends React.Component {
    render() {
        return (
            <div className="container">
                <div className="jumbotron">
                    <div className="row">
                        <div className="col-md-6"><h1>React</h1></div>
                    </div>
                </div>
                <table className="table table-hover table-striped test-data">
                    <tbody>
                        {this.props.items.map(item => <Row key={item.id} item={item} />)}
                    </tbody>
                </table>
            </div>
        );
    }
}

// --- Benchmark Cases --- //

let root, data, reactRoot;

export default {
    setup: (container) => {
        root = container;
        reactRoot = createRoot(root);
    },
    'Create 1,000 rows': () => {
        data = buildData(1000);
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
    'Replace 1,000 rows': () => {
        data = buildData(1000);
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
    'Partial update': () => {
        const newData = [...data];
        for (let i = 0; i < newData.length; i += 10) {
            newData[i] = { ...newData[i], label: newData[i].label + ' !!!' };
        }
        data = newData;
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
    'Select row': () => {
        const index = _random(data.length);
        const newData = [...data];
        newData[index] = { ...newData[index], selected: true };
        flushSync(() => {
            reactRoot.render(<App items={newData} />);
        });
        newData[index] = { ...newData[index], selected: false };
        flushSync(() => {
            reactRoot.render(<App items={newData} />);
        });
    },
    'Swap rows': () => {
        if (data.length > 998) {
            const newData = [...data];
            let a = newData[1];
            newData[1] = newData[998];
            newData[998] = a;
            data = newData;
            flushSync(() => {
                reactRoot.render(<App items={data} />);
            });
        }
    },
    'Remove row': () => {
        const index = _random(data.length);
        const newData = [...data];
        newData.splice(index, 1);
        data = newData;
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
    'Append 1,000 rows': () => {
        data = data.concat(buildData(1000));
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
    'Clear rows': () => {
        data = [];
        flushSync(() => {
            reactRoot.render(<App items={data} />);
        });
    },
};