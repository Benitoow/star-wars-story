import { describe, expect, it } from 'vitest';
import {
  DATA_SCHEMA_VERSION,
  createAllDataExportEnvelope,
  normalizePreferencesForStorage,
  parseAllDataImportEnvelope
} from './index';

describe('persistence normalization', () => {
  it('normalizes unsupported preference values and maps legacy image fields', () => {
    const normalized = normalizePreferencesForStorage({
      uiLanguage: 'xx',
      theme: 'neon',
      defaultImageProvider: 'openrouter',
      defaultImgModel: 'google/gemini-2.5-flash-image'
    });

    expect(normalized.uiLanguage).toBe('auto');
    expect(normalized.theme).toBe('dark');
    expect(normalized.imageProvider).toBe('openrouter_img');
    expect(normalized.imageModel).toBe('google/gemini-2.5-flash-image');
  });

  it('creates a complete data export envelope with schema version', () => {
    const envelope = createAllDataExportEnvelope({
      stories: [{}],
      folders: [],
      storyVersions: [],
      preferences: {},
      appState: {}
    });

    expect(envelope.schemaVersion).toBe(DATA_SCHEMA_VERSION);
    expect(envelope.data.stories).toHaveLength(1);
  });

  it('rejects unsupported future schema versions on import', () => {
    const payload = JSON.stringify({
      schemaVersion: DATA_SCHEMA_VERSION + 1,
      data: {}
    });

    expect(() => parseAllDataImportEnvelope(payload)).toThrow('Unsupported data export version');
  });

  it('rejects non-numeric schema versions on import', () => {
    const payload = JSON.stringify({
      schemaVersion: 'latest',
      data: {}
    });

    expect(() => parseAllDataImportEnvelope(payload)).toThrow('Invalid data export version');
  });
});
