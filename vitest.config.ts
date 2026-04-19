import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '$app/environment': path.resolve(__dirname, 'src/test/mocks/app-environment.ts'),
      '$lib': path.resolve(__dirname, 'src/lib')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}']
  }
});
