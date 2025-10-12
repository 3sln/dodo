import * as d from '@3sln/dodo';

export default driver => {
  const name$ = driver.property('Name', {defaultValue: 'World'});

  driver.panel('Demo', (container, signal) => {
    const sub = name$.subscribe(name => {
      d.reconcile(container, [
        d.div(d.h1(`Hello, ${name}! `), d.p('This is a simple demo for the Dodo library.')),
      ]);
    });

    signal.addEventListener('abort', () => {
      sub.unsubscribe();
      d.reconcile(container, []);
    });
  });
};
