import { readFileSync } from 'fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'variables/index': 'src/variables/index.ts',
      'similarity/index': 'src/similarity/index.ts',
      'quality/index': 'src/quality/index.ts',
      'builder/index': 'src/builder/index.ts',
      'parser/index': 'src/parser/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
  },
  {
    entry: {
      'cli/index': 'src/cli/index.tsx',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: true,
    external: ['ink', 'react', 'ink-text-input', 'ink-spinner', 'ink-select-input'],
    define: {
      __CLI_VERSION__: JSON.stringify(version),
    },
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
