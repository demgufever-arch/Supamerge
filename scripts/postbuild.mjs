import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve('dist/index.html');
let html = readFileSync(htmlPath, 'utf-8');

// Remove crossorigin attribute from inline module scripts
html = html.replace(/(<script type="module") crossorigin(>)/g, '$1$2');

writeFileSync(htmlPath, html);
console.log('[postbuild] Removed crossorigin from inline module scripts');
