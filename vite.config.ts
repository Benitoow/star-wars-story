import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // When run from a git worktree, node_modules resolves to the parent checkout,
  // which sits outside the project root — allow Vite to serve it. Harmless in a
  // normal checkout (the parents simply aren't used).
  server: { fs: { allow: ['..', '../..', '../../..'] } }
});
