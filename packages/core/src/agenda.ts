/**
 * L'agenda d'un professionnel : les règles.
 *
 * Attention au vocabulaire. `horaires.ts` appelle « créneau » une tranche horaire
 * hebdomadaire — « le mardi de 9 h à 12 h » — qui n'a pas de date. Ici, il s'agit de **plages
 * datées** : « le 3 mars de 9 h à 10 h 30 ». Deux notions voisines qui ne se mélangent pas,
 * et c'est pourquoi celle-ci s'appelle `Plage` et non `Creneau`.
 *
 * Trois règles gouvernent ce fichier.
 *
 * **Deux plages d'un même professionnel ne se chevauchent pas.** Un artisan ne peut pas être
 * à deux endroits ; un agenda qui l'accepterait ne servirait qu'à produire des rendez-vous
 * manqués.
 *
 * **Une proposition non répondue expire, et cesse alors de bloquer.** C'est la règle la moins
 * évidente et la plus importante. Quand un professionnel propose un créneau à un client, ce
 * créneau est réservé — sinon il le vendrait deux fois. Mais si le client ne répond jamais,
 * ce blocage ne doit pas durer : au bout de quarante-huit heures, la plage redevient libre
 * **sans que personne n'ait à faire le ménage**. Un agenda qui se remplit de propositions
 * mortes est un agenda qu'on cesse d'utiliser.
 *
 * **Le passé ne se planifie pas.** On peut *consigner* une intervention passée — c'est même
 * utile —, mais pas *proposer* un rendez-vous hier.
 */

/** Une plage datée dans l'agenda. */
export interface Plage {
  readonly debut: Date;
  readonly fin: Date;
}

export type TypePlage = 'visite' | 'intervention' | 'propose' | 'blocage';

export const LIBELLE_TYPE_PLAGE: Readonly<Record<TypePlage, string>> = Object.freeze({
  visite: 'Visite',
  intervention: 'Intervention',
  propose: 'Créneau proposé',
  blocage: 'Indisponible',
});

/**
 * Durée minimale d'une plage.
 *
 * Un quart d'heure : c'est le pas de l'agenda, et une intervention plus courte que cela ne se
 * planifie pas — elle se fait.
 */
export const DUREE_MINIMALE_MINUTES = 15;

/**
 * Durée maximale d'une plage, en heures.
 *
 * Douze heures. Pas une limite de droit du travail — ce n'est pas à une plateforme de
 * l'imposer — mais un garde-fou de saisie : au-delà, c'est presque toujours une date de fin
 * mal saisie, et une plage de trois jours bloquerait l'agenda sans qu'on comprenne pourquoi.
 */
export const DUREE_MAXIMALE_HEURES = 12;

/** Combien de temps une proposition reste valable avant de libérer la plage. */
export const VALIDITE_PROPOSITION_HEURES = 48;

/** Au bout de combien de temps sans réponse le client est relancé, une fois. */
export const RELANCE_PROPOSITION_HEURES = 24;

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/** Durée d'une plage, en minutes. */
export function dureeMinutes(plage: Plage): number {
  return Math.round((plage.fin.getTime() - plage.debut.getTime()) / MINUTE);
}

/**
 * Deux plages se chevauchent-elles ?
 *
 * Les bornes ne comptent pas : une plage qui finit à 10 h et une qui commence à 10 h se
 * suivent, elles ne se chevauchent pas. C'est la définition qui permet d'enchaîner deux
 * rendez-vous sans trou artificiel.
 */
export function chevauchent(une: Plage, autre: Plage): boolean {
  return une.debut.getTime() < autre.fin.getTime() && autre.debut.getTime() < une.fin.getTime();
}

/** Ce qu'il faut savoir d'une plage déjà posée pour décider si elle en bloque une autre. */
export interface PlageExistante extends Plage {
  readonly id: string;
  readonly type: TypePlage;
  /** `null` pour tout ce qui n'est pas une proposition. */
  readonly expireLe: Date | null;
  /** Renseignée quand la plage a été annulée : elle reste en base sans occuper son horaire. */
  readonly annuleLe: Date | null;
}

/**
 * Cette plage occupe-t-elle encore le temps qu'elle couvre ?
 *
 * Une proposition expirée n'occupe plus rien : le client n'a pas répondu, la plage est
 * rendue. Sans cette règle, un agenda se minéralise au fil des propositions sans réponse, et
 * le professionnel finit par ne plus pouvoir rien y poser.
 */
export function occupeEncore(plage: PlageExistante, maintenant: Date = new Date()): boolean {
  // Une plage annulée ne disparaît pas — l'effacer emporterait le rendez-vous en cascade, et
  // un rendez-vous annulé est une trace. Elle cesse simplement d'occuper son horaire.
  if (plage.annuleLe !== null) return false;
  if (plage.type !== 'propose') return true;
  if (plage.expireLe === null) return true;
  return plage.expireLe.getTime() > maintenant.getTime();
}

/**
 * L'instant d'expiration d'une proposition.
 *
 * Quarante-huit heures — **ou le début du créneau, si c'est plus tôt**. Une proposition ne
 * peut pas survivre à l'horaire qu'elle propose : promettre à un client qu'il a jusqu'à
 * samedi pour accepter un rendez-vous de vendredi n'a aucun sens, et c'est pourtant ce que
 * la page lui annonçait.
 *
 * Sans `debut`, on s'en tient aux quarante-huit heures : l'appelant qui ne donne pas la date
 * du créneau n'en a pas une à protéger.
 */
export function expirationProposition(maintenant: Date = new Date(), debut?: Date): Date {
  const plafond = maintenant.getTime() + VALIDITE_PROPOSITION_HEURES * HEURE;
  if (debut === undefined) return new Date(plafond);
  return new Date(Math.min(plafond, debut.getTime()));
}

/** Faut-il relancer le client sur cette proposition ? */
export function aRelancer(
  plage: { readonly type: TypePlage; readonly creeLe: Date; readonly relanceeLe: Date | null },
  maintenant: Date = new Date(),
): boolean {
  if (plage.type !== 'propose' || plage.relanceeLe !== null) return false;
  return maintenant.getTime() - plage.creeLe.getTime() >= RELANCE_PROPOSITION_HEURES * HEURE;
}

export interface SaisiePlage {
  readonly type: TypePlage;
  readonly debut: Date;
  readonly fin: Date;
}

export interface ProblemePlage {
  readonly champ: 'type' | 'debut' | 'fin' | 'chevauchement';
  readonly message: string;
}

/**
 * Tous les problèmes d'une plage, d'un coup.
 *
 * `existantes` ne contient que les plages du **même professionnel**, l'éventuelle plage en
 * cours de modification exclue : une plage ne se chevauche pas elle-même.
 */
export function problemesPlage(
  saisie: SaisiePlage,
  existantes: readonly PlageExistante[],
  maintenant: Date = new Date(),
): readonly ProblemePlage[] {
  const problemes: ProblemePlage[] = [];

  const debut = saisie.debut.getTime();
  const fin = saisie.fin.getTime();

  if (!Number.isFinite(debut)) {
    problemes.push({ champ: 'debut', message: 'Indiquez la date et l’heure de début.' });
  }
  if (!Number.isFinite(fin)) {
    problemes.push({ champ: 'fin', message: 'Indiquez l’heure de fin.' });
  }

  if (Number.isFinite(debut) && Number.isFinite(fin)) {
    const duree = Math.round((fin - debut) / MINUTE);
    if (duree <= 0) {
      problemes.push({ champ: 'fin', message: 'La fin doit venir après le début.' });
    } else if (duree < DUREE_MINIMALE_MINUTES) {
      problemes.push({
        champ: 'fin',
        message: `Une plage dure au moins ${String(DUREE_MINIMALE_MINUTES)} minutes.`,
      });
    } else if (duree > DUREE_MAXIMALE_HEURES * 60) {
      problemes.push({
        champ: 'fin',
        message: `Une plage de plus de ${String(DUREE_MAXIMALE_HEURES)} heures est presque toujours une erreur de saisie. Découpez-la.`,
      });
    }

    // Proposer un rendez-vous dans le passé n'a pas de sens ; consigner une intervention
    // passée, si. La règle ne porte donc que sur ce qu'on adresse à un client.
    if (saisie.type === 'propose' && debut < maintenant.getTime()) {
      problemes.push({
        champ: 'debut',
        message: 'Un créneau proposé à un client ne peut pas être dans le passé.',
      });
    }

    const occupantes = existantes.filter((plage) => occupeEncore(plage, maintenant));
    const conflit = occupantes.find((plage) =>
      chevauchent(plage, { debut: saisie.debut, fin: saisie.fin }),
    );
    if (conflit !== undefined) {
      problemes.push({
        champ: 'chevauchement',
        message: `Cette plage en recouvre une autre : ${LIBELLE_TYPE_PLAGE[conflit.type].toLowerCase()} de ${heureDe(conflit.debut)} à ${heureDe(conflit.fin)}.`,
      });
    }
  }

  return problemes;
}

/** « 9 h 30 », « 14 h ». Le format que l'on dit à voix haute. */
export function heureDe(date: Date): string {
  const heures = date.getHours();
  const minutes = date.getMinutes();
  return minutes === 0
    ? `${String(heures)} h`
    : `${String(heures)} h ${String(minutes).padStart(2, '0')}`;
}

/**
 * Les plages d'un jour donné, dans l'ordre.
 *
 * Une plage qui enjambe minuit appartient aux deux jours : l'agenda d'un dépanneur de nuit
 * doit la montrer les deux fois, sans quoi elle disparaîtrait de la vue du lendemain.
 */
export function plagesDuJour<T extends Plage>(plages: readonly T[], jour: Date): readonly T[] {
  const debutJour = new Date(jour);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(debutJour);
  finJour.setDate(finJour.getDate() + 1);

  return plages
    .filter((plage) => chevauchent(plage, { debut: debutJour, fin: finJour }))
    .toSorted((une, autre) => une.debut.getTime() - autre.debut.getTime());
}

/**
 * Les sept jours de la semaine contenant cette date, du lundi au dimanche.
 *
 * Lundi en premier : c'est la semaine française, et un agenda professionnel qui commencerait
 * le dimanche se lirait de travers.
 */
export function semaineDe(date: Date): readonly Date[] {
  const lundi = new Date(date);
  lundi.setHours(0, 0, 0, 0);
  // `getDay()` rend 0 pour dimanche : on le ramène à 7 pour que lundi vaille 1.
  const jour = lundi.getDay() === 0 ? 7 : lundi.getDay();
  lundi.setDate(lundi.getDate() - (jour - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(lundi);
    date.setDate(date.getDate() + index);
    return date;
  });
}
