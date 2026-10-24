import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(`${root}public/pdfjs`, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(`${root}node_modules/pdfjs-dist/${dir}`, `${root}public/pdfjs/${dir}`, { recursive: true });
}
