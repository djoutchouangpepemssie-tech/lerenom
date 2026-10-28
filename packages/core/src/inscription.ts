/**
 * Les règles de l'inscription d'un professionnel.
 *
 * Une inscription n'est pas qu'un formulaire valide : c'est l'entrée d'une entreprise dans un
 * annuaire qui la nomme publiquement. Deux exigences s'ensuivent, et elles sont ici.
 *
 * La première : **l'inscription crée, ou revendique, jamais les deux à l'aveugle.** L'annuaire
 * contient déjà des entreprises issues de la base SIRENE, que personne n'a réclamées. Un
 * professionnel qui s'inscrit avec un SIRET déjà présent ne doit pas créer un doublon — il
 * revendique sa fiche. Si elle est déjà revendiquée, il faut refuser et renvoyer vers la
 * connexion : deux personnes ne peuvent pas tenir la même fiche sans que l'une s'en aperçoive.
 *
 * La seconde : **tout est relevé d'un coup.** Un formulaire de huit étapes qui refuse une chose
 * à la fois est une épreuve. `valideInscription` rend la liste complète des problèmes, chacun
 * rattaché à son étape, pour que l'écran puisse y ramener directement.
 */

import { FORMULES, REGLES_VALIDEES, type Formule, prixAnnuelHT } from './regles-validees.ts';
import { siretValide } from './validateurs.ts';
import { MESSAGES_FAIBLESSE, faiblessesMotDePasse } from './mot-de-passe.ts';

/** La longueur minimale d'une présentation : en deçà, la fiche n'apprend rien au visiteur. */
export const LONGUEUR_DESCRIPTION_MINIMALE = 60;
/** Au-delà, ce n'est plus une présentation, c'est une page. */
export const LONGUEUR_DESCRIPTION_MAXIMALE = 1200;

/**
 * Le slug d'une entreprise, tel qu'il apparaît dans l'URL de sa fiche.
 *
 * Une seule définition pour tout le dépôt — le semis et l'inscription doivent produire le même
 * slug pour la même entreprise, sinon la même société porte deux adresses selon la façon dont
 * elle est entrée dans la base.
 */
export function slugifie(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Le slug d'une fiche d'entreprise : le nom, puis le SIRET.
 *
 * Le SIRET est dans l'adresse parce que deux entreprises peuvent porter le même nom — « Dupont
 * Plomberie » n'est pas une singularité — et qu'une adresse de fiche ne doit jamais désigner
 * deux sociétés. Sans SIRET (une fiche créée à la main avant vérification), un suffixe est
 * fourni par l'appelant.
 */
export function slugEntreprise(nom: string, suffixe: string): string {
  const base = slugifie(nom);
  const queue = slugifie(suffixe);
  if (base === '') return queue === '' ? 'entreprise' : queue;
  return queue === '' ? base : `${base}-${queue}`;
}

/** Ce qu'un professionnel saisit pendant les huit étapes. */
export type SaisieInscription = {
  readonly siret: string;
  readonly nomEntreprise: string;
  readonly email: string;
  readonly telephone: string;
  readonly motDePasse: string;
  readonly motDePasseConfirme: string;
  readonly metiers: readonly string[];
  readonly metierPrincipal: string | null;
  readonly villes: readonly string[];
  readonly communeSiege: string | null;
  readonly description: string;
  readonly formule: Formule;
  readonly annuel: boolean;
};

/**
 * Un problème relevé, avec l'étape où le corriger.
 *
 * `etape` n'est pas décoratif : c'est ce qui permet à l'écran de ramener le professionnel au
 * bon endroit au lieu de lui afficher une liste d'erreurs sans chemin pour les atteindre.
 */
export type ProblemeInscription = {
  readonly champ: string;
  readonly etape: number;
  readonly message: string;
};

/** Les étapes, par leur nom, pour que les numéros ne soient pas écrits en dur plus bas. */
export const ETAPE = Object.freeze({
  entreprise: 0,
  verification: 1,
  metiers: 2,
  villes: 3,
  fiche: 4,
  formule: 5,
});

function emailPlausible(email: string): boolean {
  // Volontairement permissif : la seule preuve qu'une adresse existe est qu'elle reçoive un
  // message. Un contrôle trop strict refuse des adresses valides et n'arrête pas les fausses.
  const nettoye = email.trim();
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(nettoye) && nettoye.length <= 320;
}

function telephonePlausible(telephone: string): boolean {
  const chiffres = telephone.replace(/\D/g, '');
  return chiffres.length >= 10 && chiffres.length <= 15;
}

/**
 * Relève tout ce qui empêche d'enregistrer cette inscription.
 *
 * Rend une liste vide quand l'inscription est enregistrable. Ne dit rien de ce que la base
 * contient déjà — SIRET connu, adresse déjà utilisée : ces vérifications demandent une lecture
 * et vivent donc dans l'application, pas ici.
 */
export function valideInscription(saisie: SaisieInscription): readonly ProblemeInscription[] {
  const problemes: ProblemeInscription[] = [];

  if (!siretValide(saisie.siret)) {
    problemes.push({
      champ: 'siret',
      etape: ETAPE.entreprise,
      message: 'Ce numéro SIRET n’est pas valide : vérifiez les 14 chiffres.',
    });
  }

  if (saisie.nomEntreprise.trim().length < 2) {
    problemes.push({
      champ: 'nomEntreprise',
      etape: ETAPE.entreprise,
      message: 'Indiquez le nom de votre entreprise.',
    });
  }

  if (!emailPlausible(saisie.email)) {
    problemes.push({
      champ: 'email',
      etape: ETAPE.verification,
      message: 'Cette adresse électronique ne semble pas valide.',
    });
  }

  if (!telephonePlausible(saisie.telephone)) {
    problemes.push({
      champ: 'telephone',
      etape: ETAPE.verification,
      message: 'Indiquez un numéro de téléphone à dix chiffres.',
    });
  }

  for (const faiblesse of faiblessesMotDePasse(saisie.motDePasse, saisie.email)) {
    problemes.push({
      champ: 'motDePasse',
      etape: ETAPE.verification,
      message: MESSAGES_FAIBLESSE[faiblesse],
    });
  }

  if (saisie.motDePasse !== saisie.motDePasseConfirme) {
    problemes.push({
      champ: 'motDePasseConfirme',
      etape: ETAPE.verification,
      message: 'Les deux mots de passe ne sont pas identiques.',
    });
  }

  if (saisie.metiers.length === 0) {
    problemes.push({
      champ: 'metiers',
      etape: ETAPE.metiers,
      message: 'Choisissez au moins un métier.',
    });
  }

  if (saisie.metierPrincipal === null) {
    problemes.push({
      champ: 'metierPrincipal',
      etape: ETAPE.metiers,
      message: 'Désignez votre métier principal : c’est lui qui nomme votre fiche.',
    });
  } else if (!saisie.metiers.includes(saisie.metierPrincipal)) {
    problemes.push({
      champ: 'metierPrincipal',
      etape: ETAPE.metiers,
      message: 'Votre métier principal doit faire partie des métiers choisis.',
    });
  }

  if (new Set(saisie.metiers).size !== saisie.metiers.length) {
    problemes.push({
      champ: 'metiers',
      etape: ETAPE.metiers,
      message: 'Un même métier est choisi deux fois.',
    });
  }

  if (saisie.villes.length === 0) {
    problemes.push({
      champ: 'villes',
      etape: ETAPE.villes,
      message: 'Choisissez au moins une ville d’intervention.',
    });
  }

  if (new Set(saisie.villes).size !== saisie.villes.length) {
    problemes.push({
      champ: 'villes',
      etape: ETAPE.villes,
      message: 'Une même ville est choisie deux fois.',
    });
  }

  if (saisie.communeSiege !== null && !saisie.villes.includes(saisie.communeSiege)) {
    problemes.push({
      champ: 'communeSiege',
      etape: ETAPE.villes,
      message: 'La ville de votre siège doit faire partie de vos villes d’intervention.',
    });
  }

  const description = saisie.description.trim();
  if (description.length < LONGUEUR_DESCRIPTION_MINIMALE) {
    problemes.push({
      champ: 'description',
      etape: ETAPE.fiche,
      message: `Votre présentation doit faire au moins ${LONGUEUR_DESCRIPTION_MINIMALE} caractères.`,
    });
  }
  if (description.length > LONGUEUR_DESCRIPTION_MAXIMALE) {
    problemes.push({
      champ: 'description',
      etape: ETAPE.fiche,
      message: `Votre présentation ne peut pas dépasser ${LONGUEUR_DESCRIPTION_MAXIMALE} caractères.`,
    });
  }

  if (!FORMULES.includes(saisie.formule)) {
    problemes.push({
      champ: 'formule',
      etape: ETAPE.formule,
      message: 'Cette formule n’existe pas.',
    });
  }

  return problemes;
}

/**
 * Ce que l'inscription engage financièrement, calculé une seule fois et au même endroit que
 * les tarifs affichés.
 *
 * L'écran d'inscription montre un total avant de valider. S'il le calculait de son côté, le
 * professionnel pourrait voir un prix et en payer un autre — exactement l'erreur déjà
 * rencontrée sur le coût d'acceptation d'une demande.
 */
export function engagementInscription(
  formule: Formule,
  annuel: boolean,
): {
  readonly prixHT: number;
  readonly moisEngagement: number;
  readonly paiementRequis: boolean;
} {
  const prixHT = annuel ? prixAnnuelHT(formule) : REGLES_VALIDEES.prixMensuelHT[formule];
  return {
    prixHT,
    moisEngagement: REGLES_VALIDEES.moisEngagement[formule],
    // La fiche gratuite n'exige aucun moyen de paiement : c'est ce qui permet à un
    // professionnel d'exister dans l'annuaire avant d'avoir décidé quoi que ce soit.
    paiementRequis: prixHT > 0,
  };
}
