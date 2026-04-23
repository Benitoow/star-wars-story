export const SESSION_CORRUPTION_FIXTURES: Array<{
  name: string;
  payload: Record<string, unknown>;
}> = [
  { name: 'missing setup snapshot', payload: { version: 1, turnNumber: 0 } },
  { name: 'string turn number', payload: { version: 1, turnNumber: 'two', setupSnapshot: {} } },
  { name: 'bad ai messages', payload: { version: 1, turnNumber: 1, aiMessages: [{ role: 'narrator', content: {} }], setupSnapshot: {} } },
  { name: 'background events not array', payload: { version: 1, turnNumber: 1, backgroundEvents: 'oops', setupSnapshot: {} } },
  { name: 'world state missing player', payload: { version: 1, turnNumber: 1, worldState: { npcs: [] }, setupSnapshot: {} } },
  { name: 'world state with invalid location', payload: { version: 1, turnNumber: 1, worldState: { player: { hp: 100, credits: 10, location: '' } }, setupSnapshot: {} } },
  { name: 'chapter history malformed', payload: { version: 1, turnNumber: 1, chapterHistory: [{ chapter_title: 'Broken' }], setupSnapshot: {} } },
  { name: 'current chapter malformed', payload: { version: 1, turnNumber: 1, currentChapter: { narrative: {} }, setupSnapshot: {} } },
  { name: 'campaign archive wrong type', payload: { version: 1, turnNumber: 1, campaignArchive: [1, 2, 3], setupSnapshot: {} } },
  { name: 'future session version', payload: { version: 99, turnNumber: 1, setupSnapshot: {} } }
];
