import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('docs/runtime consistency', () => {
  it('keeps README and SPEC aligned with the frozen engine surface', () => {
    const readme = read('README.md');
    const spec = read('SPEC.md');
    const settingsPage = read('src/routes/settings/+page.svelte');

    const forbiddenClaims = [
      /tool calling natif/i,
      /fallback json structuré automatique pour les providers sans tool calling/i,
      /OpenRouter \(tool calling\) \+ fallback JSON/i,
      /provider recommandé/i
    ];

    for (const claim of forbiddenClaims) {
      expect(readme).not.toMatch(claim);
    }

    expect(readme).toMatch(/orchestration à sous-agents/i);
    expect(readme).toMatch(/sole text provider|OpenRouter \+ orchestration à sous-agents/i);
    expect(spec).toMatch(/OpenRouter \+ none/i);
    expect(settingsPage).toMatch(/orchestration à sous-agents/i);
  });
});
