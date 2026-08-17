/* Prompts for "Mode Direct" — the NPC persona (live chat) and the
   end-of-conversation debrief that distills consequences. */
import { cleanText } from '../text';
import type { ChatTurn, NpcRelation, StorySetup, WorldState } from '../types';
import { languageInstruction } from './language';
import { ERA_COHERENCE, contentModeDirective } from './style';
import { renderWorldDigest } from './system';

function protagonistName(setup: StorySetup): string {
  return [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'le protagoniste';
}

function disposition(npc: NpcRelation): string {
  if (npc.status === 'ally' || npc.affinity > 30) return 'allié — chaleureux, coopératif, il te fait confiance';
  if (npc.status === 'hostile' || npc.affinity < -30) return 'hostile — méfiant, cassant, peu disposé à aider';
  if (npc.affinity < -10) return 'méfiant — sur la réserve';
  return 'neutre — prudent, ni ami ni ennemi';
}

/** System prompt that turns the model INTO the NPC for a live conversation. */
export function buildNpcSystemPrompt(
  setup: StorySetup,
  world: WorldState,
  npc: NpcRelation,
  sceneSummary: string,
  canon: string,
  memoryLines: string[] = [],
  recentEvents: string[] = []
): string {
  const protagonist = protagonistName(setup);
  const events = recentEvents.length
    ? `\nDERNIERS ÉVÉNEMENTS (ce qui vient de se passer dans la campagne) :\n${recentEvents.map((e) => `- ${cleanText(e, 420)}`).join('\n')}`
    : '';
  const memory = memoryLines.length
    ? `\nFAITS ÉTABLIS DE LA CAMPAGNE (mémoire — ne jamais les contredire ; n'en parle que si ton personnage peut les connaître) :\n${memoryLines.map((f) => `- ${cleanText(f, 280)}`).join('\n')}`
    : '';
  return `${languageInstruction(setup.language)}

Tu INCARNES un personnage d'une campagne Star Wars — tu n'es PAS le narrateur. Tu réponds en dialogue direct, à la première personne, comme dans une vraie conversation.

PERSONNAGE : ${npc.name}${npc.faction ? ` · ${npc.faction}` : ''}
${npc.note ? `Profil : ${npc.note}\n` : ''}Disposition envers ${protagonist} : ${disposition(npc)}.

SCÈNE : ${cleanText(sceneSummary, 800) || '—'}
${renderWorldDigest(world)}${world.campaign?.dossier ? `\nDOSSIER DE CAMPAGNE (contexte factuel que ton personnage peut connaître selon sa position) :\n${cleanText(world.campaign.dossier, 1200)}` : ''}${events}${memory}${canon}

RÈGLES :
- Parle UNIQUEMENT comme ${npc.name}, en 1 à 3 phrases (conversation, pas monologue). Aucune narration à la 3e personne, aucune description d'ambiance — seulement tes paroles, et au plus une brève action entre *astérisques*.
- Reste fidèle à ta personnalité, ta faction et ta disposition. Tu as ton propre agenda ; tu n'es PAS au service du joueur.
- Ne révèle jamais ce que ton personnage ne peut pas savoir. Respecte les faits établis (canon) et l'ère "${setup.era}".
- ${contentModeDirective(setup.contentMode)}
- INTERDICTION absolue du tiret cadratin "—" (ou de tout tiret) en début de réplique.`;
}

export const RESOLVE_SYSTEM = `Tu es le CERVEAU d'une campagne Star Wars. On te donne une conversation entre le joueur et un PNJ ; tu en extrais les conséquences mécaniques ET un court récapitulatif jouable. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

function transcriptText(protagonist: string, npcName: string, turns: ChatTurn[]): string {
  return turns.map((t) => `${t.speaker === 'player' ? protagonist : npcName} : ${cleanText(t.content, 600)}`).join('\n');
}

/** User prompt for the exit debrief — yields a playable recap chapter + consequences. */
export function buildResolveUser(
  setup: StorySetup,
  world: WorldState,
  npc: NpcRelation,
  sceneSummary: string,
  turns: ChatTurn[],
  langName: string,
  memoryLines: string[] = []
): string {
  const protagonist = protagonistName(setup);
  const memory = memoryLines.length
    ? `\nFAITS ÉTABLIS (à ne pas contredire dans les conséquences) :\n${memoryLines.map((f) => `- ${cleanText(f, 280)}`).join('\n')}`
    : '';
  return `Conversation entre ${protagonist} et ${npc.name}${sceneSummary ? ` (contexte : ${cleanText(sceneSummary, 300)})` : ''} :
${transcriptText(protagonist, npc.name, turns)}

ÉTAT DU MONDE :
${renderWorldDigest(world)}
Affinité actuelle de ${npc.name} envers ${protagonist} : ${npc.affinity} (−100 hostile … +100 loyal).${memory}
${ERA_COHERENCE}

Déduis les conséquences de cette conversation (COHÉRENTES avec l'état) et écris un court récap jouable de l'issue. Réponds en JSON strict, TOUT en ${langName} :
{
  "chapter_title": "titre évocateur de l'échange",
  "section_type": "dialogue",
  "narrative": { "action": "récap de l'issue — ce qui a été dit, obtenu, décidé, l'ambiance (1 à 2 paragraphes)", "dialogue": "", "reflection": "", "atmosphere": "tense|calm|mysterious|eerie|heroic" },
  "state_update": { "npcs": [{ "name": "${npc.name}", "affinity": ${npc.affinity}, "status": "ally|neutral|hostile", "note": "maj brève" }], "hp": 0, "credits": 0, "experience": 5, "campaign_update": {}, "world_events_new": [], "ending": null, "injuries_new": [], "inventory_gained": [], "date_advance": "", "environment_status": "" },
  "memory_updates": { "relations": [], "places": [], "notes": ["ce que le joueur a appris d'important"] },
  "choices": [ { "text": "suite concrète juste après la conversation", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 2, "tradeoff": "", "stakes": "", "faction_impact": {} } ],
  "npcs_present": ["${npc.name}"]
}
- "affinity" = NOUVELLE valeur absolue (−100..100), ajustée depuis l'actuelle (${npc.affinity}) selon le ton de l'échange (chaleureux → monte, conflictuel → descend), de façon modérée.
- "npcs_present" = PNJ encore sur place à la FIN de l'échange (retire ${npc.name} s'il est parti).
- N'attribue de l'expérience (5 à 15 XP) que si la conversation produit une information, une alliance ou une décision concrète. Mets à jour campaign_update.progress si l'échange fait avancer ou retarde l'objectif.
- memory_updates.notes ne contient que des faits explicitement établis dans les répliques ; une hypothèse ou une menace annoncée reste une rumeur, jamais un fait canonique.
- N'invente pas d'objets/infos qui n'ont pas réellement été obtenus dans la conversation.`;
}
