/* Style directives + era-coherence rules shared by the system and start prompts. */

export function styleDirective(writingStyle?: string, writingTone?: string): string {
  const style = (writingStyle || '').toLowerCase();
  const tone = (writingTone || '').toLowerCase();

  if (style === 'litteraire' || tone === 'sombre') {
    return "PROSE LITTÉRAIRE & SOMBRE : prose dense, viscérale, riche en métaphores Star Wars. Climats hostiles, rouille, ozone de blaster, ombres. Insiste sur le dilemme moral et l'ambiguïté des PNJs. Rythme lent, introspectif, silences lourds.";
  }
  if (style === 'cinematique' || tone === 'aventure') {
    return "CINÉMATIQUE & AVENTURE : démarre in media res, ouverture visuelle et percutante. Phrases courtes et nerveuses, dignes d'un storyboard. Héroïsme, panache, acrobaties, et des punchlines de contrebandier au cœur du danger.";
  }
  if (style === 'epique' || tone === 'heroique') {
    return "ÉPIQUE & HÉROÏQUE : souffle légendaire et solennel, digne d'un opéra de l'espace. Architectures monumentales, destins croisés. Courage face à l'adversité, noblesse, honneur, sens du sacrifice et enjeux galactiques.";
  }
  return "IMMERSIF & SENSORIEL : caméra au plus près de la psychologie et des sens du protagoniste. Froid mordant de l'acier, grondement des réacteurs, panique ou détermination. Au plus près de l'action physique directe — chaque choix est une question de survie.";
}

export const ERA_COHERENCE = `COHÉRENCE D'ÈRE (CRITIQUE) : ne confonds JAMAIS les factions/armées d'époques différentes :
- "clone_wars" : l'Empire n'existe PAS encore — aucun Stormtrooper. Forces = Clones de la République ou Droïdes Séparatistes (CIS).
- "imperial" : l'Empire gouverne, l'Ordre Jedi est détruit, les soldats sont des Stormtroopers.
- "old_republic" : ni Clones ni Stormtroopers impériaux — forces de la République classique ou de l'Empire Sith de l'époque.`;

/* Anti-anachronism guardrail. Shared by BOTH engines (Direct GM rules and the
   agentic Writer): models know the movie eras well but are thin on the others,
   and a half-remembered famous name is worse than a coherent invention. */
export const ERA_HONESTY = `HONNÊTETÉ HISTORIQUE : tu connais bien les époques des films mais moins d'autres ères (Ancienne République, etc.). Si un lieu, un personnage ou une technologie de l'époque te semble incertain, INVENTE un équivalent cohérent avec l'ère au lieu d'importer un nom célèbre d'une autre époque. Ne prétends jamais connaître un fait que tu ne connais pas.`;

export function contentModeDirective(contentMode?: string): string {
  const mode = (contentMode || '').toLowerCase();
  if (mode === 'dark') {
    return "DIRECTIVE DE CONTENU (SOMBRE) : Ambiance dure, sombre et tendue. Les blessures sont décrites de façon réaliste et viscérale. La noirceur morale et la cruauté de la traque sont mises en avant, sans censure.";
  }
  if (mode === 'adult') {
    return "DIRECTIVE DE CONTENU (ADULTE / MATURE) : Récit mature, viscéral et sensuel. Autorise et encourage la description explicite de combats violents, de blessures sanglantes, de passion physique/romantique, et de thèmes adultes sans retenue.";
  }
  if (mode === 'raw') {
    return "DIRECTIVE DE CONTENU (BRUT / SANS FILTRE / NSFW) : Récit totalement sans filtre et sans concession. Autorise les descriptions explicites et frontales de combats sanglants, de violence physique viscérale, de romance intime et charnelle explicite (NSFW), et de thèmes adultes non censurés.";
  }
  return "DIRECTIVE DE CONTENU (CINÉMA) : Action intense et cinématique, adaptée à un public large. Pas de violence gratuite, de sang excessif ou de thèmes matures explicites.";
}
