import { prisma } from '@lerenom/db';
import { telephoneLisible } from '@/lib/affichage';
import {
  ATOUTS_MAXIMUM,
  LONGUEUR_PRESENTATION_UTILE,
  completudeFiche,
  criteresFiche,
  manquesFiche,
  type CritereFiche,
  type EtatFiche,
} from '@lerenom/core';

/**
 * La fiche d'un professionnel, vue depuis son espace.
 *
 * Un point mérite d'être dit : **la complétude est recalculée à chaque enregistrement**, et
 * elle n'est pas décorative. Elle alimente la composante « pertinence » du score de qualité,
 * donc le classement naturel. Jusqu'ici personne ne la calculait : le semis en écrivait une au
 * jugé, et le classement s'appuyait sur une constante inventée.
 *
 * Elle est stockée plutôt que recalculée à la lecture parce que le travail de nuit qui range
 * les entreprises la lit en masse, pour toutes les fiches à la fois.
 */

/** Ce que le professionnel peut modifier depuis son espace. */
export interface SaisieFiche {
  readonly description: string;
  readonly slogan: string;
  readonly telephone: string;
  readonly email: string;
  readonly siteWeb: string;
  readonly atouts: readonly string[];
  readonly decennaleNumero: string;
  readonly decennaleAssureur: string;
  /** Au format `AAAA-MM-JJ`, ou vide. */
  readonly decennaleExpireLe: string;
}

export interface FicheDuPro extends SaisieFiche {
  readonly nomEntreprise: string;
  readonly slug: string;
  readonly completude: number;
  readonly criteres: readonly CritereFiche[];
  readonly manques: readonly CritereFiche[];
  /** Ce qui ne se modifie pas depuis cet écran, mais compte dans la complétude. */
  readonly nombrePhotos: number;
  readonly nombrePrestations: number;
  readonly logoPose: boolean;
  readonly couverturePosee: boolean;
  readonly horairesPosees: boolean;
}

function texte(valeur: string | null | undefined): string {
  return valeur ?? '';
}

/** Une date `AAAA-MM-JJ` pour un champ de formulaire, ou une chaîne vide. */
function jour(date: Date | null): string {
  return date === null ? '' : (date.toISOString().slice(0, 10) ?? '');
}

export async function ficheDuPro(entrepriseId: string): Promise<FicheDuPro | null> {
  const entreprise = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: {
      nom: true,
      slug: true,
      fiche: { include: { _count: { select: { photos: true } } } },
      _count: { select: { prestations: true } },
    },
  });
  if (entreprise === null) return null;

  const fiche = entreprise.fiche;
  const etat = etatDepuisBase(fiche, fiche?._count.photos ?? 0, entreprise._count.prestations);

  return {
    nomEntreprise: entreprise.nom,
    slug: entreprise.slug,
    description: texte(fiche?.description),
    slogan: texte(fiche?.slogan),
    // Le numéro est présenté par paires de chiffres, comme partout ailleurs sur le site. Un
    // « +33199000010 » dans un champ qu'on vient modifier est une donnée brute montrée telle
    // quelle, et la base garde ensuite la forme lisible : c'est celle qui s'affiche au public.
    telephone: telephoneLisible(texte(fiche?.telephone)),
    email: texte(fiche?.email),
    siteWeb: texte(fiche?.siteWeb),
    atouts: fiche?.atouts ?? [],
    decennaleNumero: texte(fiche?.decennaleNumero),
    decennaleAssureur: texte(fiche?.decennaleAssureur),
    decennaleExpireLe: jour(fiche?.decennaleExpireLe ?? null),
    completude: completudeFiche(etat),
    criteres: criteresFiche(etat),
    manques: manquesFiche(etat),
    nombrePhotos: fiche?._count.photos ?? 0,
    nombrePrestations: entreprise._count.prestations,
    logoPose: texte(fiche?.logoUrl) !== '',
    couverturePosee: texte(fiche?.couvertureUrl) !== '',
    horairesPosees: fiche?.horaires !== null && fiche?.horaires !== undefined,
  };
}

/** Un problème de saisie, rattaché au champ qui le porte. */
export interface ProblemeFiche {
  readonly champ: string;
  readonly message: string;
}

export type ResultatFiche =
  | { readonly ok: true; readonly completude: number }
  | { readonly ok: false; readonly problemes: readonly ProblemeFiche[] };

/**
 * Les contrôles de saisie de la fiche.
 *
 * Peu nombreux à dessein. Une fiche à moitié remplie est permise — elle est simplement moins
 * bien classée. On ne refuse que ce qui serait faux : une date d'échéance illisible, une
 * adresse de site qui n'en est pas une.
 */
export function valideFiche(saisie: SaisieFiche): readonly ProblemeFiche[] {
  const problemes: ProblemeFiche[] = [];

  const description = saisie.description.trim();
  if (description !== '' && description.length < LONGUEUR_PRESENTATION_UTILE) {
    problemes.push({
      champ: 'description',
      message: `Une présentation de moins de ${String(LONGUEUR_PRESENTATION_UTILE)} caractères n’apprend rien : complétez-la, ou laissez-la vide.`,
    });
  }
  if (description.length > 1200) {
    problemes.push({
      champ: 'description',
      message: 'Votre présentation ne peut pas dépasser 1 200 caractères.',
    });
  }

  const site = saisie.siteWeb.trim();
  if (site !== '' && !/^https?:\/\/[^\s.]+\.[^\s]+$/.test(site)) {
    problemes.push({
      champ: 'siteWeb',
      message: 'L’adresse de votre site doit commencer par « https:// ».',
    });
  }

  const courriel = saisie.email.trim();
  if (courriel !== '' && !/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(courriel)) {
    problemes.push({ champ: 'email', message: 'Cette adresse électronique ne semble pas valide.' });
  }

  if (saisie.atouts.filter((atout) => atout.trim() !== '').length > ATOUTS_MAXIMUM) {
    problemes.push({
      champ: 'atouts',
      message: `Pas plus de ${String(ATOUTS_MAXIMUM)} atouts : au-delà, ce n’est plus une mise en avant.`,
    });
  }

  const echeance = saisie.decennaleExpireLe.trim();
  if (echeance !== '') {
    const date = new Date(`${echeance}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      problemes.push({
        champ: 'decennaleExpireLe',
        message: 'Cette date d’échéance est illisible.',
      });
    }
  }

  return problemes;
}

/**
 * Enregistre la fiche et recalcule sa complétude.
 *
 * `upsert` plutôt que `update` : une entreprise reprise de la base SIRENE peut n'avoir jamais
 * eu de fiche, et son premier enregistrement doit la créer plutôt que d'échouer.
 */
export async function enregistreFiche(
  entrepriseId: string,
  saisie: SaisieFiche,
): Promise<ResultatFiche> {
  const problemes = valideFiche(saisie);
  if (problemes.length > 0) return { ok: false, problemes };

  const echeance = saisie.decennaleExpireLe.trim();
  const decennaleExpireLe = echeance === '' ? null : new Date(`${echeance}T00:00:00Z`);
  const atouts = saisie.atouts.map((atout) => atout.trim()).filter((atout) => atout !== '');

  const champs = {
    description: vide(saisie.description),
    slogan: vide(saisie.slogan),
    telephone: vide(saisie.telephone),
    email: vide(saisie.email),
    siteWeb: vide(saisie.siteWeb),
    atouts,
    decennaleNumero: vide(saisie.decennaleNumero),
    decennaleAssureur: vide(saisie.decennaleAssureur),
    decennaleExpireLe,
  };

  const enregistree = await prisma.fiche.upsert({
    where: { entrepriseId },
    create: { entrepriseId, ...champs },
    update: champs,
    include: { _count: { select: { photos: true } } },
  });

  const nombrePrestations = await prisma.prestationPro.count({ where: { entrepriseId } });
  const completude = completudeFiche(
    etatDepuisBase(enregistree, enregistree._count.photos, nombrePrestations),
  );

  // Écrit à part : la complétude dépend de ce qui vient d'être enregistré, y compris du nombre
  // de photos et de prestations, que cette requête ne touche pas.
  await prisma.fiche.update({ where: { entrepriseId }, data: { completude } });

  return { ok: true, completude };
}

/** Une chaîne vide vaut « non renseigné » : la base garde `null`, pas une chaîne blanche. */
function vide(valeur: string): string | null {
  const propre = valeur.trim();
  return propre === '' ? null : propre;
}

/**
 * Les champs de la base, traduits dans la forme qu'attend `@lerenom/core`.
 *
 * Une seule traduction pour la lecture et pour l'écriture : si les deux divergeaient, la
 * complétude affichée ne serait pas celle qui classe.
 */
function etatDepuisBase(
  fiche: {
    readonly description: string | null;
    readonly slogan: string | null;
    readonly logoUrl: string | null;
    readonly couvertureUrl: string | null;
    readonly telephone: string | null;
    readonly email: string | null;
    readonly siteWeb: string | null;
    readonly horaires: unknown;
    readonly atouts: readonly string[];
    readonly decennaleNumero: string | null;
    readonly decennaleAssureur: string | null;
    readonly decennaleExpireLe: Date | null;
  } | null,
  nombrePhotos: number,
  nombrePrestations: number,
): EtatFiche {
  return {
    description: fiche?.description ?? null,
    slogan: fiche?.slogan ?? null,
    logoUrl: fiche?.logoUrl ?? null,
    couvertureUrl: fiche?.couvertureUrl ?? null,
    telephone: fiche?.telephone ?? null,
    email: fiche?.email ?? null,
    siteWeb: fiche?.siteWeb ?? null,
    horaires: fiche?.horaires ?? null,
    atouts: fiche?.atouts ?? [],
    nombrePhotos,
    decennaleNumero: fiche?.decennaleNumero ?? null,
    decennaleAssureur: fiche?.decennaleAssureur ?? null,
    decennaleExpireLe: fiche?.decennaleExpireLe ?? null,
    nombrePrestations,
  };
}
