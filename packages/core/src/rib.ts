/**
 * Le relevé d'identité bancaire d'un professionnel : les règles.
 *
 * C'est le compte sur lequel ses clients virent l'argent. Deux conséquences en découlent, et
 * elles gouvernent tout ce fichier.
 *
 * **Changer de compte est le geste le plus convoité par la fraude.** Un escroc qui prend la
 * main sur un espace professionnel n'a rien à voler sur place : ce qu'il veut, c'est que les
 * virements des clients arrivent chez lui. Un changement de RIB ne vaut donc qu'une fois
 * confirmé par un code envoyé **au numéro déjà connu** — pas à un numéro fourni dans la même
 * requête, ce qui ne prouverait rien. Tant que le code n'est pas saisi, l'ancien compte reste
 * le compte actif.
 *
 * **Un RIB ne se supprime pas.** Les factures émises le désignent, figé à l'émission : un
 * client qui paie une facture de l'an dernier doit la payer sur le compte qui y figure. Un
 * nouveau RIB *remplace* l'ancien, qui reste en base avec sa date de remplacement.
 *
 * Les contrôles de forme — clé IBAN, forme du BIC — vivent dans `validateurs.ts` et sont
 * appelés ici. Ils rejettent une saisie qui ne peut pas être correcte, pas une saisie qui
 * désigne un compte inexistant : seule la banque sait cela, et elle ne le dira qu'au premier
 * virement.
 */

import { ibanValide } from './validateurs.ts';

export interface SaisieRib {
  readonly titulaire: string;
  readonly iban: string;
  readonly bic: string;
  readonly banque: string;
}

export interface ProblemeRib {
  readonly champ: 'titulaire' | 'iban' | 'bic' | 'banque';
  readonly message: string;
}

/**
 * Forme d'un BIC (norme ISO 9362) : 4 lettres pour la banque, 2 pour le pays, 2 pour la
 * localité, et 3 caractères de succursale, facultatifs.
 *
 * Il n'existe pas de clé de contrôle : seule la forme se vérifie. Un BIC bien formé mais
 * inexistant passera, et c'est inévitable — l'annuaire officiel est payant et hors ligne.
 */
const FORME_BIC = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function bicValide(bic: string): boolean {
  return FORME_BIC.test(bic.replace(/\s/g, '').toUpperCase());
}

/** Le BIC tel qu'on le stocke : sans espaces, en capitales. */
export function normaliseBic(bic: string): string {
  return bic.replace(/\s/g, '').toUpperCase();
}

/** L'IBAN tel qu'on le stocke : sans espaces ni tirets, en capitales. */
export function normaliseIban(iban: string): string {
  return iban.replace(/[\s-]/g, '').toUpperCase();
}

/** Les deux lettres de pays d'un IBAN, ou `null` si la saisie n'en a pas la forme. */
export function paysIban(iban: string): string | null {
  const propre = normaliseIban(iban);
  return /^[A-Z]{2}/.test(propre) ? propre.slice(0, 2) : null;
}

/**
 * Tous les problèmes d'une saisie, d'un coup.
 *
 * D'un coup, et non le premier rencontré : un formulaire bancaire se remplit une fois, et le
 * corriger erreur après erreur est une façon sûre de faire renoncer.
 */
export function problemesRib(saisie: SaisieRib): readonly ProblemeRib[] {
  const problemes: ProblemeRib[] = [];

  const titulaire = saisie.titulaire.trim();
  if (titulaire.length < 2) {
    problemes.push({
      champ: 'titulaire',
      message: 'Indiquez le titulaire du compte, tel qu’il figure sur le relevé.',
    });
  }

  const iban = normaliseIban(saisie.iban);
  if (iban.length === 0) {
    problemes.push({ champ: 'iban', message: 'Indiquez l’IBAN du compte.' });
  } else if (!ibanValide(iban)) {
    // Le message ne dit pas « IBAN invalide » : la clé de contrôle attrape surtout les fautes
    // de frappe, et c'est cela qu'il faut suggérer d'aller vérifier.
    problemes.push({
      champ: 'iban',
      message:
        'Cet IBAN ne passe pas le contrôle : vérifiez-le caractère par caractère sur votre relevé.',
    });
  }

  const bic = normaliseBic(saisie.bic);
  if (bic.length === 0) {
    problemes.push({
      champ: 'bic',
      message: 'Indiquez le BIC, à côté de l’IBAN sur votre relevé.',
    });
  } else if (!bicValide(bic)) {
    problemes.push({
      champ: 'bic',
      message: 'Un BIC compte 8 ou 11 caractères, par exemple BNPAFRPP.',
    });
  }

  return problemes;
}

/** La saisie, propre, telle qu'elle doit être écrite. */
export interface RibNormalise {
  readonly titulaire: string;
  readonly iban: string;
  readonly bic: string;
  readonly banque: string | null;
}

export function normaliseRib(saisie: SaisieRib):
  | { readonly ok: true; readonly rib: RibNormalise }
  | {
      readonly ok: false;
      readonly problemes: readonly ProblemeRib[];
    } {
  const problemes = problemesRib(saisie);
  if (problemes.length > 0) return { ok: false, problemes };

  const banque = saisie.banque.trim();
  return {
    ok: true,
    rib: {
      titulaire: saisie.titulaire.trim(),
      iban: normaliseIban(saisie.iban),
      bic: normaliseBic(saisie.bic),
      // Le nom de la banque est un confort d'affichage, pas une donnée de paiement : il se
      // laisse vide sans conséquence.
      banque: banque.length === 0 ? null : banque,
    },
  };
}

/**
 * Deux IBAN désignent-ils le même compte ?
 *
 * Utile pour ne pas faire confirmer par SMS un « changement » qui n'en est pas un : resaisir
 * le même compte, avec ou sans espaces, ne doit pas désactiver le RIB actif le temps d'une
 * confirmation.
 */
export function memeCompte(unIban: string, autreIban: string): boolean {
  return normaliseIban(unIban) === normaliseIban(autreIban);
}
