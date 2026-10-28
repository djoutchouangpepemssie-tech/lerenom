/**
 * La complétude d'une fiche professionnelle.
 *
 * Ce n'est pas un ornement. `completude` alimente la composante **pertinence** du score de
 * qualité, qui décide du classement naturel : une fiche mieux remplie remonte. Jusqu'ici la
 * valeur n'était calculée nulle part — le semis en écrivait une au jugé, et le classement
 * s'appuyait donc sur une constante inventée. Ce module la calcule.
 *
 * Deux principes gouvernent la pondération :
 *
 * **Ce qui aide le visiteur à décider pèse le plus.** Une présentation écrite, des photos de
 * chantiers et une attestation décennale valide valent plus qu'un slogan. Le poids n'est pas
 * une récompense d'effort, c'est une mesure d'utilité pour la personne qui cherche.
 *
 * **Rien n'est exigé.** Une fiche gratuite incomplète existe, s'affiche et reçoit des
 * demandes. La complétude la classe, elle ne la conditionne pas. C'est la différence entre un
 * annuaire et un péage.
 */

/** L'état d'une fiche, tel que l'application le lit en base. */
export interface EtatFiche {
  readonly description: string | null;
  readonly slogan: string | null;
  readonly logoUrl: string | null;
  readonly couvertureUrl: string | null;
  readonly telephone: string | null;
  readonly email: string | null;
  readonly siteWeb: string | null;
  readonly horaires: unknown;
  readonly atouts: readonly string[];
  readonly nombrePhotos: number;
  readonly decennaleNumero: string | null;
  readonly decennaleAssureur: string | null;
  readonly decennaleExpireLe: Date | null;
  /** Nombre de prestations déclarées : un métier coché ne dit pas ce qu'on sait faire. */
  readonly nombrePrestations: number;
}

/** Un critère de complétude, et ce qu'il vaut. */
export interface CritereFiche {
  readonly cle: string;
  readonly libelle: string;
  /** Ce que le professionnel doit faire, écrit pour lui et non pour la base. */
  readonly action: string;
  readonly poids: number;
  readonly acquis: boolean;
}

import { horairesDepuisJson, horairesRenseignes } from './horaires.ts';

/** La longueur en deçà de laquelle une présentation n'apprend rien. */
export const LONGUEUR_PRESENTATION_UTILE = 60;
/** Trois photos : moins ne donne pas une idée du travail. */
export const PHOTOS_ATTENDUES = 3;
/** Trois atouts : la carte de résultats en affiche trois. */
export const ATOUTS_ATTENDUS = 3;
/** Au-delà de six, ce n'est plus une mise en avant mais une liste. */
export const ATOUTS_MAXIMUM = 6;

function rempli(valeur: string | null | undefined): boolean {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

function horairesUtiles(valeur: unknown): boolean {
  const horaires = horairesDepuisJson(valeur);
  return horaires !== null && horairesRenseignes(horaires);
}

/**
 * Les critères de complétude d'une fiche, chacun avec son poids et son état.
 *
 * Les poids totalisent 1. Ils sont écrits ici, en clair et au même endroit, plutôt que
 * dispersés dans l'écran qui les affiche : le chiffre qui classe et le chiffre qui s'affiche
 * doivent venir de la même source.
 */
export function criteresFiche(
  etat: EtatFiche,
  maintenant: Date = new Date(),
): readonly CritereFiche[] {
  const decennaleValide =
    rempli(etat.decennaleNumero) &&
    rempli(etat.decennaleAssureur) &&
    etat.decennaleExpireLe !== null &&
    etat.decennaleExpireLe.getTime() > maintenant.getTime();

  return [
    {
      cle: 'presentation',
      libelle: 'Présentation',
      action: `Écrire au moins ${String(LONGUEUR_PRESENTATION_UTILE)} caractères sur votre entreprise.`,
      poids: 0.2,
      acquis: (etat.description ?? '').trim().length >= LONGUEUR_PRESENTATION_UTILE,
    },
    {
      cle: 'photos',
      libelle: 'Photos de chantiers',
      action: `Ajouter au moins ${String(PHOTOS_ATTENDUES)} photos de vos réalisations.`,
      poids: 0.18,
      acquis: etat.nombrePhotos >= PHOTOS_ATTENDUES,
    },
    {
      cle: 'decennale',
      libelle: 'Assurance décennale',
      action: 'Renseigner votre assureur, le numéro de contrat et sa date d’échéance.',
      poids: 0.15,
      acquis: decennaleValide,
    },
    {
      cle: 'prestations',
      libelle: 'Prestations',
      action: 'Cocher les prestations que vous réalisez, pas seulement vos métiers.',
      poids: 0.12,
      acquis: etat.nombrePrestations > 0,
    },
    {
      cle: 'horaires',
      libelle: 'Horaires',
      action: 'Indiquer vos horaires d’ouverture.',
      poids: 0.1,
      // Un objet vide n'est pas un horaire : il faut au moins un créneau dans la semaine. Se
      // contenter de « le champ existe » donnerait le point à une fiche qui n'annonce rien.
      acquis: horairesUtiles(etat.horaires),
    },
    {
      cle: 'telephone',
      libelle: 'Téléphone',
      action: 'Indiquer le numéro où l’on vous joint.',
      poids: 0.07,
      acquis: rempli(etat.telephone),
    },
    {
      cle: 'logo',
      libelle: 'Logo',
      action: 'Téléverser votre logo.',
      poids: 0.06,
      acquis: rempli(etat.logoUrl),
    },
    {
      cle: 'atouts',
      libelle: 'Atouts',
      action: `Nommer au moins ${String(ATOUTS_ATTENDUS)} atouts — ce sont eux qui s’affichent dans les résultats.`,
      poids: 0.05,
      acquis: etat.atouts.filter((atout) => atout.trim() !== '').length >= ATOUTS_ATTENDUS,
    },
    {
      cle: 'couverture',
      libelle: 'Image de couverture',
      action: 'Choisir l’image qui ouvre votre fiche.',
      poids: 0.03,
      acquis: rempli(etat.couvertureUrl),
    },
    {
      cle: 'slogan',
      libelle: 'Slogan',
      action: 'Écrire une phrase qui vous résume.',
      poids: 0.02,
      acquis: rempli(etat.slogan),
    },
    {
      cle: 'site',
      libelle: 'Site internet',
      action: 'Indiquer l’adresse de votre site, si vous en avez un.',
      poids: 0.01,
      acquis: rempli(etat.siteWeb),
    },
    {
      cle: 'email',
      libelle: 'Adresse électronique',
      action: 'Indiquer l’adresse où vous recevez vos messages.',
      poids: 0.01,
      acquis: rempli(etat.email),
    },
  ];
}

/**
 * La complétude d'une fiche, entre 0 et 1.
 *
 * Arrondie au centième : la stocker avec dix-sept décimales ne dirait rien de plus, et un
 * écart de l'ordre du millième ne doit pas faire bouger un classement.
 */
export function completudeFiche(etat: EtatFiche, maintenant: Date = new Date()): number {
  const criteres = criteresFiche(etat, maintenant);
  const acquis = criteres
    .filter((critere) => critere.acquis)
    .reduce((somme, critere) => somme + critere.poids, 0);
  const total = criteres.reduce((somme, critere) => somme + critere.poids, 0);
  if (total === 0) return 0;
  return Math.round((acquis / total) * 100) / 100;
}

/**
 * Ce qu'il reste à faire, du plus utile au moins utile.
 *
 * L'ordre compte : un professionnel qui n'a dix minutes doit les passer sur ce qui lui
 * rapporte le plus, pas sur son slogan.
 */
export function manquesFiche(
  etat: EtatFiche,
  maintenant: Date = new Date(),
): readonly CritereFiche[] {
  return criteresFiche(etat, maintenant)
    .filter((critere) => !critere.acquis)
    .toSorted((a, b) => b.poids - a.poids);
}
