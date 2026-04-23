export interface ProviderResponseFixture {
  name: string;
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  shouldThrow: boolean;
  expectedMessage?: string;
  expectContent?: string;
}

export const PROVIDER_RESPONSE_FIXTURES: ProviderResponseFixture[] = [
  { name: 'missing choices', ok: true, json: {}, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'empty choices array', ok: true, json: { choices: [] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'missing message', ok: true, json: { choices: [{}] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'null content', ok: true, json: { choices: [{ message: { role: 'assistant', content: null } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'blank content', ok: true, json: { choices: [{ message: { role: 'assistant', content: '   ' } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'reasoning only', ok: true, json: { choices: [{ message: { role: 'assistant', reasoning: 'chain', content: '' } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'reasoning content only', ok: true, json: { choices: [{ message: { role: 'assistant', reasoning_content: 'thoughts', content: '' } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'empty tool calls', ok: true, json: { choices: [{ message: { role: 'assistant', content: '', tool_calls: [] } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'invalid nested payload', ok: true, json: { data: { message: 'nope' } }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'truncated choice payload', ok: true, json: { choices: [{ delta: { content: 'partial' } }] }, shouldThrow: true, expectedMessage: 'réponse vide ou incomplète' },
  { name: 'http json error', ok: false, status: 401, text: JSON.stringify({ error: { message: 'Unauthorized provider key' } }), shouldThrow: true, expectedMessage: 'Unauthorized provider key' },
  { name: 'http text error', ok: false, status: 500, text: 'provider meltdown', shouldThrow: true, expectedMessage: 'provider meltdown' },
  { name: 'valid simple content', ok: true, json: { choices: [{ message: { role: 'assistant', content: 'Réponse valide.' } }] }, shouldThrow: false, expectContent: 'Réponse valide.' },
  { name: 'valid content with crlf', ok: true, json: { choices: [{ message: { role: 'assistant', content: 'Ligne 1.\r\n\r\nLigne 2.' } }] }, shouldThrow: false, expectContent: 'Ligne 1.\n\nLigne 2.' },
  { name: 'valid tool call only', ok: true, json: { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'tool-1', type: 'function', function: { name: 'set_scene', arguments: '{}' } }] } }] }, shouldThrow: false },
  { name: 'valid content and tool calls', ok: true, json: { choices: [{ message: { role: 'assistant', content: 'Scène prête.', tool_calls: [{ id: 'tool-2', type: 'function', function: { name: 'update_world', arguments: '{}' } }] } }] }, shouldThrow: false, expectContent: 'Scène prête.' },
  { name: 'valid unicode content', ok: true, json: { choices: [{ message: { role: 'assistant', content: 'Coruscant crépite sous la pluie.' } }] }, shouldThrow: false, expectContent: 'Coruscant crépite sous la pluie.' },
  { name: 'valid long content', ok: true, json: { choices: [{ message: { role: 'assistant', content: 'A'.repeat(500) } }] }, shouldThrow: false, expectContent: 'A'.repeat(500) },
  { name: 'valid compact json string content', ok: true, json: { choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }] }, shouldThrow: false, expectContent: '{"ok":true}' },
  { name: 'valid message with whitespace around content', ok: true, json: { choices: [{ message: { role: 'assistant', content: '  Nar Shaddaa tient encore.  ' } }] }, shouldThrow: false, expectContent: 'Nar Shaddaa tient encore.' }
];
