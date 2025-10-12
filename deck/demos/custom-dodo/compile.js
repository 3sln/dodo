import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileString } from 'cherry-cljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.resolve(__dirname, 'custom-dodo.cljs');
const outputFile = path.resolve(__dirname, 'custom-dodo.js');

async function build() {
  try {
    console.log(`Compiling ${inputFile}...`);
    const cljsCode = await fs.readFile(inputFile, 'utf-8');
    let code = compileString(cljsCode);

    // Adjust the import path to be relative
    code = code.replace("'cherry-cljs/cljs.core.js'", "'./cljs.core.js'");

    await fs.writeFile(outputFile, code);
    console.log(`Successfully compiled to ${outputFile}`);

    // Copy the cljs.core.js library to the same directory
    const coreLibSource = path.resolve(__dirname, '../../node_modules/cherry-cljs/lib/cljs.core.js');
    const coreLibDest = path.resolve(path.dirname(outputFile), 'cljs.core.js');
    await fs.copyFile(coreLibSource, coreLibDest);
    console.log(`Copied cljs.core.js to ${coreLibDest}`);

  } catch (err) {
    console.error('Compilation failed: ', err);
    process.exit(1);
  }
}

build();
