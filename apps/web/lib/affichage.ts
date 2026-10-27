/**
 * Mise en forme des libellés pour l'affichage.
 *
 * Les données gardent le nom officiel de l'Insee — « Paris 11e Arrondissement » — parce que
 * c'est lui qui fait foi dans un export, une facture ou un litige. Mais personne ne dit
 * « je cherche un plombier à Paris 11e Arrondissement » : à l'écran, on écrit « Paris 11e ».
 */

/** Le nom d'une commune tel qu'on l'écrit dans une phrase. */
export function nomVille(nom: string): string {
  return nom.replace(/\s+Arrondissement$/i, '');
}

/** « à Paris 11e », « à Montreuil », mais « au Plessis-Robinson ». */
export function aLaVille(nom: string): string {
  const court = nomVille(nom);
  if (/^Le\s/i.test(court)) return `au ${court.slice(3)}`;
  if (/^Les\s/i.test(court)) return `aux ${court.slice(4)}`;
  if (/^La\s/i.test(court)) return `à ${court}`;
  return `à ${court}`;
}
