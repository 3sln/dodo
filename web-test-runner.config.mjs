import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {playwrightLauncher} from '@web/test-runner-playwright';

// Playwright insists on the exact browser build it was pinned against. A CI
// image that ships its own Chromium and points `PLAYWRIGHT_BROWSERS_PATH` at it
// will rarely match that pin, and re-downloading a browser to run a test suite
// is a poor trade. Where such a browser exists, use it; otherwise let
// playwright resolve its own, which is what a developer machine wants.
function installedChromium() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit) return explicit;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const binary = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(binary)) return binary;
  }
  return undefined;
}

const executablePath = installedChromium();

// Tests run against a real browser rather than a DOM emulation, because a good
// half of what dodo does is only meaningful against a real one: focus survival
// during reordering, `Node.prototype.moveBefore`, shadow roots with adopted
// stylesheets, resize and intersection observers, `Element.animate` and
// transition durations read back off computed style. An emulator either fakes
// those or does not have them at all, and a test passing against a fake is
// worth very little.
export default {
  files: ['*.test.js'],
  nodeResolve: true,
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: executablePath ? {executablePath} : undefined,
    }),
  ],
  coverageConfig: {
    include: [
      'src/**/*.js',
      'index.js',
      'reactive.js',
      'context.js',
      'observe.js',
      'animate.js',
      'style.js',
    ],
    exclude: ['**/node_modules/**'],
    reporters: ['text', 'lcov'],
  },
  testFramework: {
    config: {timeout: '5000'},
  },
};
