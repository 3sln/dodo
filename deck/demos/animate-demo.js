import * as d from '@3sln/dodo';
import {withPresence} from '@3sln/dodo/animate';
import {cell, watch} from '@3sln/dodo/reactive';

const styles = `
  .demo-card {
    padding: 1em;
    border: 1px solid #ccc;
    border-radius: 4px;
    transition: opacity 400ms ease, transform 400ms ease;
  }
  .demo-card.enter { opacity: 1; transform: translateY(0); }
  .demo-card.leave { opacity: 0; transform: translateY(-8px); }
`;

const config = {
  mode: 'remove',
  spawn: {styling: {opacity: '0', transform: 'translateY(-8px)'}, duration: 0},
  despawn: {classes: ['leave']},
};

export default driver => {
  driver.panel('Demo', (container, signal) => {
    const shown = cell(true);

    d.reconcile(container, [
      d.style(styles),
      d.p(
        d.button('Toggle').on({click: () => shown.update(v => !v)}),
        ' ',
        watch(shown, v => d.span(v ? 'present' : 'absent')),
      ),
      // The card stays mounted through its exit animation, then removes itself.
      // Toggle quickly to see the reversal abort whatever was in flight.
      watch(shown, isShown =>
        withPresence(
          isShown,
          phase =>
            d.div(
              {
                $classes: [
                  'demo-card',
                  phase === 'spawned' || phase === 'spawning' ? 'enter' : '',
                ].filter(Boolean),
              },
              d.strong('Phase: '),
              phase,
            ),
          config,
        ),
      ),
    ]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, null);
    });
  });

  driver.setActivePanel('Demo');
};
