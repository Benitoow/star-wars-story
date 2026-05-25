// Mock of SvelteKit's `$app/environment` for node-based vitest runs.
// Engine + persistence logic is browser-guarded; tests run as if on the server.
export const browser = false;
export const dev = true;
export const building = false;
export const version = 'test';
