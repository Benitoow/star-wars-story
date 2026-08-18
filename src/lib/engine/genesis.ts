/* ═══════════════════════════════════════════════
   Character genesis — one call at creation time that turns
   the wizard's catalog ids into an actual character: a past,
   a drive, a flaw, objects to use and someone who knows them.
   Before this, creation produced only ids and turn 1 had to
   invent the protagonist while also opening the scene, setting
   the campaign goal and offering choices — six jobs in one call.
   Now turn 1 has one job: stage a character that already exists.
══════════════════════════════════════════════ */
import { cleanText, isRecord } from './text';
import { callTextModel } from './provider';
import type { CharacterGenesis, InventoryItem, NpcRelation, StoryProviderConfig, StorySetup } from './types';

const SYSTEM =
  "Tu es un créateur de personnages pour un jeu narratif Star Wars. Tu inventes des protagonistes crédibles, ancrés dans leur époque, avec des failles réelles. " +
  'Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.';

const CONTRACT = `{
  "background": "2 à 3 phrases de passé concret — d'où il vient, ce qu'il a fait, ce qu'il a perdu",
  "motivation": "une phrase : ce qui le pousse MAINTENANT",
  "flaw": "une phrase : un défaut réel et jouable contre lui (pas une qualité déguisée)",
  "items": [{ "name": "objet de départ concret et utilisable", "qty": 1 }],
  "ally": { "name": "Prénom Nom", "role": "mentor|contact|rival|proche", "note": "en une phrase, qui il est et son lien avec le protagoniste", "affinity": 40 },
  "location": "lieu précis et cohérent avec l'ère où l'histoire s'ouvre",
  "premise": "2 à 3 phrases : la situation de départ, RÉÉCRITE pour CE personnage précis"
}`;

function coerceItems(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: InventoryItem[] = [];
  for (const entry of raw.slice(0, 2)) {
    const name = cleanText(isRecord(entry) ? entry.name : entry, 60);
    if (!name) continue;
    const qty = isRecord(entry) && typeof entry.qty === 'number' && entry.qty > 0 ? Math.min(Math.round(entry.qty), 9) : 1;
    items.push({ name, qty });
  }
  return items;
}

function coerceAlly(raw: unknown, fallbackFaction: string): NpcRelation | null {
  if (!isRecord(raw)) return null;
  const name = cleanText(raw.name, 40);
  if (!name) return null;
  const affinity = typeof raw.affinity === 'number' && Number.isFinite(raw.affinity)
    ? Math.max(-100, Math.min(100, Math.round(raw.affinity)))
    : 40;
  const role = cleanText(raw.role, 20).toLowerCase();
  const note = cleanText(raw.note, 160) || (role ? `${role} du protagoniste` : '');
  return {
    name,
    affinity,
    status: affinity > 30 ? 'ally' : affinity < -30 ? 'hostile' : 'neutral',
    faction: fallbackFaction || undefined,
    alive: true,
    note
  };
}

/** Turn a raw model payload into a validated genesis, or null if unusable. */
export function parseGenesis(raw: string, setup: StorySetup): CharacterGenesis | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw.replace(/^```json\s*|```$/gi, '').trim());
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  const background = cleanText(payload.background, 600);
  const premise = cleanText(payload.premise, 600);
  // Background and premise are what turn 1 actually stages — without them the
  // genesis buys nothing, so treat it as a failure and open without it.
  if (!background || !premise) return null;

  return {
    background,
    motivation: cleanText(payload.motivation, 240),
    flaw: cleanText(payload.flaw, 240),
    items: coerceItems(payload.items),
    ally: coerceAlly(payload.ally, setup.faction) ?? { name: '', affinity: 0, status: 'neutral', alive: true },
    location: cleanText(payload.location, 80),
    premise
  };
}

/**
 * Generate the character. Returns null on any failure — creation then proceeds
 * exactly as before, so a genesis outage never blocks starting a story.
 */
export async function generateCharacterGenesis(
  setup: StorySetup,
  trameLabel: string | null,
  eraRefs: string[],
  provider: StoryProviderConfig,
  signal?: AbortSignal
): Promise<CharacterGenesis | null> {
  const name = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim();
  const refs = eraRefs.length ? `\n\nRÉFÉRENCES D'ÉPOQUE (factuelles) :\n${eraRefs.map((r) => `- ${r}`).join('\n')}` : '';

  const user = `Crée le protagoniste de cette campagne Star Wars.

Nom : ${name || '(à inventer, cohérent avec l\'ère)'}
Ère : ${setup.era}
Faction : ${setup.faction}
Rôle : ${setup.role}
Trame choisie : ${trameLabel || 'Libre'}
Situation de départ souhaitée : ${cleanText(setup.premise, 500) || 'libre'}${refs}

EXIGENCES :
- Croise VRAIMENT l'ère, la faction, le rôle et la trame — un ${setup.role} de l'ère ${setup.era} n'a pas le même passé qu'ailleurs.
- Le défaut doit pouvoir se retourner contre lui en jeu. Pas de « trop loyal » ni de « trop courageux ».
- Les objets doivent être UTILISABLES dans une scène (outil, arme, document, appareil), pas des souvenirs décoratifs.
- L'allié est une personne précise avec un lien clair, pas une figure abstraite.
- La prémisse réécrite doit parler de CE personnage nommé, pas d'un archétype.
- N'écris AUCUN événement futur, aucune intrigue, aucune fin. Tu poses un point de départ.

Réponds en JSON strict :
${CONTRACT}`;

  try {
    const raw = await callTextModel(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user }
      ],
      provider,
      { jsonMode: true, skipReasoning: true, signal, label: 'genèse du personnage' }
    );
    return parseGenesis(raw, setup);
  } catch {
    return null;
  }
}
