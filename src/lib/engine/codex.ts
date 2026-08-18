/* ═══════════════════════════════════════════════
   Codex — factual era references for the story engine.
   Large models know the movie eras well but are thin on
   others (Old Republic, etc.). The codex gives them
   accurate, neutral anchor points — injected sparingly,
   marked as OPTIONAL context, so it helps worldbuilding
   without steering the story. Content checked against
   Wookieepedia (canon + Legends for the Old Republic).
══════════════════════════════════════════════ */
import { cleanText } from './text';
import { scoreFacts } from './retrieval';
import { callTextModel } from './provider';
import type { MemoryFact, StoryProviderConfig, StorySetup } from './types';

export interface CodexEntry {
  id: string;
  eras: string[];      // era ids this entry applies to
  keywords: string;    // scene keywords that should surface this entry
  text: string;        // factual reference, French, compact
}

/** How many codex entries feed the one-shot campaign dossier generation. */
export const CODEX_DOSSIER_TOP = 5;

export const CODEX: CodexEntry[] = [
  // ── Ancienne République (~3950 AVBY, époque KOTOR) ──────────────
  {
    id: 'or_factions',
    eras: ['old_republic'],
    keywords: 'république sith jedi empire mandalorien faction guerre',
    text: 'Ancienne République (~3950 AVBY) : la République galactique panse ses plaies après les Guerres Mandaloriennes et la Guerre Civile Jedi (3959-3956 AVBY). L\'Ordre Jedi est décimé mais toujours debout ; des Sith survivants rôdent dans les Régions Inconnues ; les clans mandaloriens sont brisés mais rancuniers.'
  },
  {
    id: 'or_places',
    eras: ['old_republic'],
    keywords: 'planète monde lieu taris dantooine korriban manaan kashyyyk telos lehon',
    text: 'Lieux notables de l\'Ancienne République : Taris (métropole à étages, monde-cité), Dantooine (enclave Jedi, verdoyante), Korriban (vallée des tombeaux Sith), Manaan (monde océan, kolto médicinal), Kashyyyk (monde des Wookiees), Telos (monde reconstruit après sa dévastation), Lehon (monde-île des anciens Rakata).'
  },
  {
    id: 'or_figures',
    eras: ['old_republic'],
    keywords: 'revan malak bastila jedi sith figure héros',
    text: 'Figures de l\'Ancienne République : Revan (héros de la République tombé au Côté Obscur puis revenu), Dark Malak (son apprenti), Bastila Shan (Jedi, maîtresse de la méditation de combat), Carth Onasi (pilote de la République), Canderous Ordo (guerrier mandalorien), Meetra Surik (l\'Exilée), Mandalore l\'Ultime (conquérant défait à Malachor V).'
  },
  {
    id: 'or_tech',
    eras: ['old_republic'],
    keywords: 'technologie vaisseau droïde sabre hyperdrive arme',
    text: 'Technologie de l\'Ancienne République : hyperdrive standard, droïdes de protocole et de combat (séries T3, HK, T1), sabres laser anciens, croiseurs de classe Hammerhead, générateurs d\'ombre de masse (armes interdites), la Forge Stellaire (station de production Sith quasi infinie).'
  },
  {
    id: 'or_mood',
    eras: ['old_republic'],
    keywords: 'ambiance atmosphère époque ton univers',
    text: 'Ambiance de l\'Ancienne République : une galaxie vaste et brutale où la Force est omniprésente et concrète, des ruines Sith anciennes partout, une République fatiguée, des mondes-frontières sauvages, et la tentation permanente du Côté Obscur.'
  },
  // ── Guerres des Clones (22-19 AVBY) ─────────────────────────────
  {
    id: 'cw_factions',
    eras: ['clone_wars'],
    keywords: 'république séparatiste confédération jedi sith faction guerre',
    text: 'Guerres des Clones (22-19 AVBY) : la République galactique affronte la Confédération des Systèmes Indépendants (Séparatistes). Les Jedi sont généraux d\'une armée de clones ; Palpatine tire les ficelles des deux camps ; la guerre use la République et érode la confiance dans les Jedi.'
  },
  {
    id: 'cw_places',
    eras: ['clone_wars'],
    keywords: 'planète monde lieu geonosis kamino coruscant naboo ryloth umbara mandalore christophsis',
    text: 'Lieux des Guerres des Clones : Geonosis (usines de droïdes, première bataille), Kamino (mondes océans, berceau des clones), Coruscant (capitale de la République), Naboo, Christophsis, Ryloth, Umbara (monde sombre, ombres mortelles), Mandalore (neutralité fragile), le siège final de Mandalore.'
  },
  {
    id: 'cw_figures',
    eras: ['clone_wars'],
    keywords: 'anakin obiwan yoda padmé ahsoka rex grevious dooku figure héros',
    text: 'Figures des Guerres des Clones : Anakin Skywalker et Obi-Wan Kenobi (duo Jedi), Yoda, Padmé Amidala (sénatrice), Ahsoka Tano (padawan d\'Anakin), le capitaine Rex (clone ARC), le Comte Dooku (seigneur Sith), le général Grievous (cyborg séparatiste).'
  },
  {
    id: 'cw_tech',
    eras: ['clone_wars'],
    keywords: 'technologie vaisseau droïde clone arme at-te',
    text: 'Technologie des Guerres des Clones : armée de clones (Kamino), droïdes de combat B1/B2, droïdes vautours, chasseurs Jedi Delta-7, marcheurs AT-TE, vaisseaux d\'assaut Vénator, croiseurs de commandement Séparatistes.'
  },
  {
    id: 'cw_events',
    eras: ['clone_wars'],
    keywords: 'ordre 66 bataille geonosis événement purge',
    text: 'Événements clés : bataille de Geonosis (22 AVBY, début), siège de Mandalore, exécution de l\'Ordre 66 (19 AVBY : les clones retournent leurs armes contre les Jedi), Grande Purge Jedi, proclamation du Nouvel Ordre.'
  },
  // ── Ère Impériale (19-4 AVBY) ───────────────────────────────────
  {
    id: 'imp_factions',
    eras: ['imperial'],
    keywords: 'empire rébellion alliance inquisiteur faction guerre',
    text: 'Ère Impériale (19-4 AVBY) : l\'Empire galactique règne par la peur après la purge des Jedi. L\'Alliance Rebelle naît de cellules dispersées ; les Inquisiteurs traquent les sensibles à la Force ; chasseurs de primes, Hutts et syndicats prospèrent dans l\'ombre.'
  },
  {
    id: 'imp_places',
    eras: ['imperial'],
    keywords: 'planète monde lieu lothal scarif jedha yavin hoth endor alderaan coruscant',
    text: 'Lieux de l\'Ère Impériale : Coruscant (capitale impériale), Lothal (monde occupé, rébellion naissante), Scarif (archives impériales), Jedha (lune sainte des disciples de la Force), Yavin IV, Hoth, Endor, et Alderaan (monde pacifiste détruit par l\'Étoile de la Mort).'
  },
  {
    id: 'imp_figures',
    eras: ['imperial'],
    keywords: 'palpatine vader tarkin thrawn luke leia han figure héros',
    text: 'Figures de l\'Ère Impériale : l\'Empereur Palpatine, Dark Vador, le grand moff Tarkin, l\'amiral Thrawn (stratège), Luke Skywalker, Leia Organa, Han Solo, Chewbacca, les héros de Lothal (Ezra, Sabine, Zeb, Hera, Kanan).'
  },
  {
    id: 'imp_tech',
    eras: ['imperial'],
    keywords: 'technologie vaisseau destroyer tie at-at stormtrooper arme',
    text: 'Technologie impériale : destroyers stellaires, chasseurs TIE, marcheurs AT-AT et AT-ST, stormtroopers, droïdes KX de sécurité, l\'Étoile de la Mort (super-arme planétaire), systèmes de blocus et zones de contrôle strict.'
  },
  {
    id: 'imp_events',
    eras: ['imperial'],
    keywords: 'yavin hoth endor alderaan événement bataille rebellion',
    text: 'Événements clés : proclamation de l\'Empire (19 AVBY), destruction d\'Alderaan et bataille de Yavin (0), occupation de Hoth (3 APBY), bataille d\'Endor et mort de l\'Empereur (4 APBY).'
  },
  // ── Nouvelle République (4-28 APBY) ─────────────────────────────
  {
    id: 'nr_factions',
    eras: ['new_republic'],
    keywords: 'nouvelle république empire restes premier ordre faction politique',
    text: 'Nouvelle République (4-28 APBY) : la démocratie renaît après Endor. La flotte impériale capitule à Jakku (5 APBY). La République désarme et se débat dans une paralysie politique ; des restes impériaux fuient vers les Régions Inconnues et préparent secrètement le Premier Ordre.'
  },
  {
    id: 'nr_places',
    eras: ['new_republic'],
    keywords: 'planète monde lieu chandrila jakku dqar hosnian ahch-to crait',
    text: 'Lieux de la Nouvelle République : Chandrila (capitale de la République), Jakku (champ de bataille final contre l\'Empire), D\'Qar (base de la Résistance naissante), Hosnian Prime (siège du Sénat), Ahch-To (premier temple Jedi, île perdue), Crait (monde de sel rouge).'
  },
  {
    id: 'nr_figures',
    eras: ['new_republic'],
    keywords: 'leia luke han ben solo snoke figure héros',
    text: 'Figures de la Nouvelle République : Leia Organa (sénatrice puis fondatrice de la Résistance), Luke Skywalker (refonde un ordre Jedi qui échoue avec la chute de Ben Solo), Han Solo, Ben Solo (tenté par le Côté Obscur), Snoke (voix mystérieuse des Régions Inconnues).'
  },
  {
    id: 'nr_tech',
    eras: ['new_republic'],
    keywords: 'technologie vaisseau x-wing destroyer arme désarmement',
    text: 'Technologie de la Nouvelle République : chasseurs X-wing T-70 et A-wing, flotte de la République réduite par le désarmement, navires de transport civils, et les prémices de la technologie du Premier Ordre (base Starkiller en construction, destroyers perfectionnés).'
  },
  {
    id: 'nr_mood',
    eras: ['new_republic'],
    keywords: 'ambiance atmosphère paix fragilité politique',
    text: 'Ambiance de la Nouvelle République : une paix fragile et une bureaucratie paralysée, la menace impériale niée par le pouvoir, des héros fatigués, des mondes-frontières livrés aux criminels, et une ombre qui grandit dans les Régions Inconnues.'
  },
  // ── Premier Ordre (28-35 APBY) ──────────────────────────────────
  {
    id: 'fo_factions',
    eras: ['first_order'],
    keywords: 'premier ordre résistance sith faction guerre',
    text: 'Premier Ordre (28-35 APBY) : une puissance militaire née des restes de l\'Empire dans les Régions Inconnues, dirigée par Snoke puis Kylo Ren. La Résistance de Leia Organa, non reconnue par la République, est la seule à s\'y opposer. Derrière tout cela, Palpatine tisse son retour.'
  },
  {
    id: 'fo_places',
    eras: ['first_order'],
    keywords: 'planète monde lieu starkiller exegol kijimi pasaana ajan kloss batuu crait',
    text: 'Lieux du Premier Ordre : Starkiller (planète-super-arme), Exegol (monde caché des Sith, forteresse de Palpatine), Kijimi, Pasaana, Ajan Kloss (base de la Résistance), Crait, Batuu (avant-poste de la Bordure Extérieure).'
  },
  {
    id: 'fo_figures',
    eras: ['first_order'],
    keywords: 'kylo ren rey palpatine snoke poe finn figure héros',
    text: 'Figures du Premier Ordre : Kylo Ren (chevalier de Ren, fils de Leia et Han), Rey (puissante dans la Force, héritière spirituelle des Jedi), le général Hux, le capitaine Phasma, Poe Dameron, Finn (stormtrooper repenti), et Palpatine ressuscité sur Exegol.'
  },
  {
    id: 'fo_tech',
    eras: ['first_order'],
    keywords: 'technologie vaisseau destroyer xyston tie silencieux arme',
    text: 'Technologie du Premier Ordre : base Starkiller (détruit des systèmes entiers), destroyers Xyston à canon axial, TIE silencieux, stormtroopers de nouvelle génération, droïdes sondes et flottes massives capables de dominer la galaxie.'
  },
  {
    id: 'fo_events',
    eras: ['first_order'],
    keywords: 'starkiller hosnian exegol événement bataille',
    text: 'Événements clés : destruction du système Hosnian (34 APBY), bataille de Crait, bataille d\'Exegol (35 APBY) où la Résistance et une flotte de citoyens détruisent l\'Ordre Final et la flotte Xyston.'
  }
];

/** Surface the codex entries most relevant to the current scene, era-filtered. */
export function retrieveCodex(era: string, query: string, topK = 4): CodexEntry[] {
  const candidates = CODEX.filter((entry) => entry.eras.includes(era));
  if (!candidates.length || !query.trim()) return candidates.slice(0, topK);
  const pseudoFacts: MemoryFact[] = candidates.map((entry) => ({
    text: `${entry.keywords} ${entry.text}`,
    category: 'notes' as const,
    turn: 0
  }));
  const scored = scoreFacts(pseudoFacts, query, { topK }).sort((a, b) => b.score - a.score);
  const byText = new Map(candidates.map((entry) => [`${entry.keywords} ${entry.text}`, entry]));
  return scored
    .map((s) => byText.get(s.fact.text))
    .filter((e): e is CodexEntry => Boolean(e))
    .slice(0, topK);
}

const DOSSIER_SYSTEM = 'Tu es un archiviste de la galaxie Star Wars. Tu rédiges des dossiers de contexte factuels et neutres. Réponds UNIQUEMENT en JSON valide : {"dossier": "texte en français, 300 à 450 mots"}.' ;

/**
 * One-shot campaign bible, generated from the era codex + the premise.
 * Factual context only: no plot, no future events — the GM stays free.
 * Returns '' on any failure so the opening never blocks.
 */
export async function generateCampaignDossier(
  setup: StorySetup,
  provider: StoryProviderConfig,
  codexEntries: CodexEntry[],
  signal?: AbortSignal
): Promise<string> {
  const refs = codexEntries.length
    ? `\nRÉFÉRENCES D'ÉPOQUE (factuelles) :\n${codexEntries.map((e) => `- ${e.text}`).join('\n')}`
    : '';
  const user = `Prémisse de la campagne : ${cleanText(setup.premise, 600) || 'Libre'}
Ère : ${setup.era} · Faction du protagoniste : ${setup.faction} · Rôle : ${setup.role}${refs}

Rédige un DOSSIER DE CONTEXTE factuel et neutre (300 à 450 mots, en français) :
- Situation politique actuelle de l'époque
- Factions actives et leurs rapports
- 5 à 8 lieux plausibles où la campagne pourrait se dérouler, cohérents avec l'ère
- Types de personnages secondaires qu'on peut croiser
- Technologies et réalités du quotidien

RÈGLES ABSOLUES : ne rédige AUCUNE intrigue, ne décide AUCUN événement futur, ne crée aucun ennemi ou objectif imposé. Le protagoniste reste un acteur parmi d'autres.`;
  try {
    const raw = await callTextModel(
      [
        { role: 'system', content: DOSSIER_SYSTEM },
        { role: 'user', content: user }
      ],
      provider,
      { jsonMode: true, skipReasoning: true, signal, label: 'dossier de campagne' }
    );
    const parsed = JSON.parse(raw) as { dossier?: unknown };
    // 300-450 words ≈ up to ~2400 chars; keep a hard cap as an injection guard.
    return typeof parsed.dossier === 'string' ? cleanText(parsed.dossier, 2400) : '';
  } catch {
    return '';
  }
}
