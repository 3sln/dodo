# Customization

Dodo is designed to be configurable. You can create your own instance of the Dodo API by calling the `dodo` factory with a settings object. This is particularly useful when integrating with other languages or frameworks that have their own data structures, like ClojureScript's persistent maps and vectors.

## ClojureScript Example

This demo shows how to configure Dodo to work with ClojureScript. The demo runs the *compiled* JavaScript output, but displays the original `.cljs` source code in the "Source" panel, thanks to the `canonical-src` attribute.

<deck-demo id="cljs-demo" src="/demos/custom-dodo/custom-dodo.js" canonical-src="/demos/custom-dodo/custom-dodo.cljs"></deck-demo>