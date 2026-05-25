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
