import * as d from '@3sln/dodo';
import {css, scoped} from '@3sln/dodo/style';
import {fromObservable, watch} from '@3sln/dodo/reactive';

// A page level rule that would hit any unscoped paragraph.
const pageStyles = `
  .style-demo p { color: crimson; text-decoration: underline; }
`;

export default driver => {
  driver.panel('Demo', (container, signal) => {
    const color$ = driver.property('Scoped colour', {defaultValue: '#2f7d32', type: 'color'});
    const color = fromObservable(color$, {initial: '#2f7d32'});

    d.reconcile(container, [
      d.style(pageStyles),
      d.div(
        {$classes: ['style-demo']},
        d.p('Unscoped: the page rule reaches this one.'),
        // Rebuilt per render, but `css` is memoised per call site, so the sheet
        // is only actually rebuilt when the interpolated colour changes.
        watch(color, value =>
          scoped(
            {
              styleSheets: [
                css`
                  p {
                    color: ${value};
                    font-weight: bold;
                  }
                `,
              ],
            },
            d.p('Scoped: the page rule cannot reach in, and this rule cannot leak out.'),
          ),
        ),
      ),
    ]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, null);
    });
  });
};
