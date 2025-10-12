import {compileString} from 'cherry-cljs';
import fs from 'fs/promises';
import path from 'path';

const currentDir = path.dirname(import.meta.url).replace('file://', '');
const inputFile = path.join(currentDir, 'custom-dodo.cljs');
const outputFile = path.join(currentDir, 'custom-dodo.js');

async function build() {
  try {
    console.log(`Compiling ${inputFile}...`);
    const cljsCode = await fs.readFile(inputFile, 'utf-8');
    const code = compileString(cljsCode);
    await fs.writeFile(outputFile, code);
    console.log(`Successfully compiled to ${outputFile}`);
  } catch (error) {
    console.error('Compilation failed:', error);
    process.exit(1);
  }
}

build();
