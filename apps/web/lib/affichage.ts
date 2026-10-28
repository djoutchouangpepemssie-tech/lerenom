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

/**
 * Un numéro français, écrit comme on l'écrit : « 01 99 00 00 10 ».
 *
 * La base conserve la forme internationale E.164 — c'est elle qui sert à appeler et à envoyer
 * un SMS — mais personne ne lit « +33199000010 ». Un numéro qui n'est pas français est rendu
 * tel quel plutôt que mal découpé.
 */
export function telephoneLisible(numero: string): string {
  const compact = numero.replace(/[\s.-]/g, '');
  const national = /^\+33(\d{9})$/.exec(compact);
  const chiffres = national !== null ? `0${national[1] ?? ''}` : compact;
  if (!/^0\d{9}$/.test(chiffres)) return numero;
  return (chiffres.match(/\d{2}/g) ?? []).join(' ');
}

/**
 * Le fuseau dans lequel toutes les dates sont écrites.
 *
 * Le fixer n'est pas un détail : le serveur tourne en UTC, le navigateur dans le fuseau de son
 * utilisateur. Sans ce réglage, la même date rend deux textes différents de part et d'autre, et
 * React refuse d'hydrater la page — un bogue qui ne se voit qu'en production, sur les pages
 * pré-rendues, à certaines heures.
 *
 * Le Renom opère en Île-de-France : l'heure de Paris est la bonne pour tout le monde, y compris
 * pour un client qui consulte depuis l'étranger. « Votre rendez-vous à 9 h » veut dire 9 h chez
 * lui, pas 9 h là où il se trouve ce jour-là.
 */
export const FUSEAU = 'Europe/Paris';

/** Une date et une heure : « 28 octobre à 09:30 ». */
export function dateEtHeure(valeur: Date | string): string {
  return new Date(valeur).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSEAU,
  });
}

/** Une date seule : « 28 octobre 2026 ». */
export function dateSeule(valeur: Date | string): string {
  return new Date(valeur).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: FUSEAU,
  });
}
