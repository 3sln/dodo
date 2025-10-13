import * as d from '@3sln/dodo';

export default driver => {
  const specialCounter = d.special({
    attach(element) {
      console.log('specialCounter attached!');
      element.counter = 0;
      element.style.border = '1px solid green';
      element.style.padding = '1em';
    },
    update(element, [label, visible]) {
      if (!visible) {
        d.reconcile(element, [
          d.p('Component detached.')
        ]);
        return;
      }

      element.counter++;
      d.reconcile(element, [
        d.h2(`${label}: ${element.counter}`),
        d.p(
          'This component has its own internal state (',
          element.counter,
          ') and lifecycle hooks.',
        ),
      ]);
    },
    detach(element) {
      console.log('specialCounter detached! Counter was:', element.counter);
      // A special component is responsible for its own cleanup.
      d.reconcile(element, []);
    },
  });

  driver.panel('Demo', (container, signal) => {
    const show$ = driver.property('Visible', {defaultValue: true, type: 'checkbox'});

    const sub = show$.subscribe(visible => {
      d.reconcile(container, [specialCounter('Counter', visible).key('test')]);
    });

    signal.addEventListener('abort', () => {
      sub.unsubscribe();
      d.reconcile(container, []);
    });
  });
};
