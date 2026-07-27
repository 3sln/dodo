import * as d from '@3sln/dodo';
import {withPresence} from '@3sln/dodo/animate';
import {cell, watch} from '@3sln/dodo/reactive';

// The presence node mirrors its phase onto itself as `data-presence`, which is
// the hook to style. The base rule is the "from" state; the spawn spec applies
// the "to" state one frame later, so the transition has something to run from.
const styles = `
  [data-presence] {
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 400ms ease, transform 400ms ease;
  }
  .demo-card {
    padding: 1em;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
`;

const config = {
  mode: 'remove',
  spawn: {styling: {opacity: '1', transform: 'translateY(0)'}},
  despawn: {styling: {opacity: '0', transform: 'translateY(-10px)'}},
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
      // Toggle rapidly to watch a reversal abort whatever was in flight.
      watch(shown, isShown =>
        withPresence(
          isShown,
          phase => d.div({$classes: ['demo-card']}, d.strong('Phase: '), phase),
          config,
        ),
      ),
    ]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, null);
    });
  });
};
