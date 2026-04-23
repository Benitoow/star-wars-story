import { describe, expect, it } from 'vitest';
import type { BackgroundWorldEvent } from '$lib/ai/storyEngine';
import { initWorldState } from './worldStateReducer';
import {
  applyBackgroundWorldEventToRuntime,
  buildStoredAssistantContent,
  describeStoryOrchestration,
  getVisibleBackgroundEvents
} from './storyRuntime';

const setup = {
  era: 'imperial',
  faction: 'rebels',
  role: 'smuggler',
  premise: 'Test'
};

describe('storyRuntime', () => {
  it('stores a readable assistant transcript for orchestrated turns', () => {
    const transcript = buildStoredAssistantContent(
      {
        chapter_title: 'Embuscade sur Corellia',
        chapter_number: 3,
        section_type: 'action',
        narrative: {
          context: 'La pluie martèle les docks.',
          action: 'Tu glisses derrière une caisse et dégaines ton blaster.',
          dialogue: '"À couvert !" hurle Jyn.',
          reflection: 'Tu comprends que la fuite est terminée.',
          atmosphere: 'tense'
        },
        choices: [{ text: 'Riposter', attribute: 'combat', difficulty: 2, faction_impact: {} }],
        memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] },
        scene_description: 'Docks de nuit',
        user_edits_applied: null,
        state_update: undefined
      },
      'pipeline',
      '{"raw":"ignore-moi"}'
    );

    expect(transcript).toContain('# Embuscade sur Corellia');
    expect(transcript).toContain('Choix:');
    expect(transcript).toContain('Riposter');
    expect(transcript).not.toContain('ignore-moi');
  });

  it('describes the visible orchestration mode honestly', () => {
    expect(describeStoryOrchestration('pipeline')).toMatchObject({
      isSubagentOrchestration: true,
      summaryLabel: 'orchestration à sous-agents',
      chipTag: '4A'
    });

    expect(describeStoryOrchestration('structured-json')).toMatchObject({
      isSubagentOrchestration: false,
      summaryLabel: 'sortie JSON directe',
      chipTag: 'JSON'
    });
  });

  it('applies non-injected background events silently while preserving them in runtime history', () => {
    const worldState = initWorldState(setup);
    const event: BackgroundWorldEvent = {
      title: 'Patrouilles sur les quais',
      summary_public: '',
      summary_private: 'Des stormtroopers verrouillent discrètement les accès.',
      inject_now: false,
      prompt_hook: 'Les issues sont plus dangereuses que prévu.',
      memory_updates: {
        relations: [],
        places: ['Nar Shaddaa'],
        injuries: [],
        resources: [],
        notes: ['Le port est désormais sous surveillance renforcée.']
      },
      state_update: {
        credits: -50,
        rumors_new: ['Les quais sont verrouillés.'],
        environment_status: 'Surveillance impériale renforcée'
      }
    };

    const applied = applyBackgroundWorldEventToRuntime(worldState, [], [], event, 4);

    expect(applied.worldState.player.credits).toBe(750);
    expect(applied.worldState.rumors).toContain('Les quais sont verrouillés.');
    expect(applied.worldState.environment_status).toBe('Surveillance impériale renforcée');
    expect(applied.memoryLog.some(item => item.includes('surveillance renforcée'))).toBe(true);
    expect(applied.backgroundEvents[0]?.visibleNow).toBe(false);
    expect(getVisibleBackgroundEvents(applied.backgroundEvents)).toHaveLength(0);
  });
});
