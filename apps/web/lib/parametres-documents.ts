import { prisma } from '@lerenom/db';

/**
 * Les réglages des documents d'un professionnel.
 *
 * Ce sont les mentions que SIRENE ne contient pas et que nous ne pouvons donc pas deviner : la
 * forme juridique, le numéro de TVA, l'assurance, le médiateur de la consommation. Leur
 * absence ferme le bouton « Émettre », et cet écran est le seul endroit où elles se remplissent.
 *
 * **Rien n'est obligatoire ici.** Un professionnel qui découvre l'espace et veut d'abord
 * regarder ne doit pas se heurter à un formulaire qui refuse de l'enregistrer parce qu'il ne
 * connaît pas encore son numéro de médiateur. Le contrôle de conformité, lui, se fait au
 * moment qui compte : avant l'émission d'une facture, où il dit précisément ce qui manque.
 *
 * Le taux de pénalités est le seul champ dont le vide a un sens : `null` veut dire « taux
 * légal », et le document imprime alors la formule de la BCE. Un zéro, lui, est refusé — on ne
 * renonce pas d'avance aux pénalités de retard.
 */

export interface SaisieParametresDocuments {
  readonly formeJuridique: string | null;
  readonly capitalSocialEuros: number | null;
  readonly immatriculationRegistre: 'rcs' | 'rm' | null;
  readonly immatriculationLieu: string | null;
  readonly numeroTva: string | null;
  readonly franchiseTva: boolean;
  readonly assuranceAssureur: string | null;
  readonly assuranceContrat: string | null;
  readonly assuranceCouverture: string | null;
  readonly mediateurNom: string | null;
  readonly mediateurUrl: string | null;
  readonly penalitesTauxAnnuel: number | null;
  readonly delaiPaiementJours: number;
  readonly escompte: string | null;
  readonly conditionsGenerales: string | null;
  readonly piedDePage: string | null;
}

export interface ParametresDocumentsAffiches extends SaisieParametresDocuments {
  readonly couleur: string;
  readonly prefixeDevis: string;
  readonly prefixeFacture: string;
  readonly prefixeAvoir: string;
  /** Un métier du bâtiment rend l'assurance obligatoire sur les documents. */
  readonly batiment: boolean;
}

/** Les réglages d'un professionnel qui n'a rien rempli. Rien d'inventé : tout vide. */
const VIDES: SaisieParametresDocuments = {
  formeJuridique: null,
  capitalSocialEuros: null,
  immatriculationRegistre: null,
  immatriculationLieu: null,
  numeroTva: null,
  franchiseTva: false,
  assuranceAssureur: null,
  assuranceContrat: null,
  assuranceCouverture: null,
  mediateurNom: null,
  mediateurUrl: null,
  penalitesTauxAnnuel: null,
  delaiPaiementJours: 30,
  escompte: null,
  conditionsGenerales: null,
  piedDePage: null,
};

function nombreOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined) return null;
  return Number(valeur);
}

function registre(valeur: string | null): 'rcs' | 'rm' | null {
  return valeur === 'rcs' || valeur === 'rm' ? valeur : null;
}

export async function parametresDocuments(
  entrepriseId: string,
): Promise<ParametresDocumentsAffiches> {
  const [enregistres, batiment] = await Promise.all([
    prisma.parametresDocuments.findUnique({ where: { entrepriseId } }),
    prisma.metierPro.findFirst({
      where: { entrepriseId, metier: { univers: { batiment: true } } },
      select: { id: true },
    }),
  ]);

  if (enregistres === null) {
    return {
      ...VIDES,
      couleur: '#16181D',
      prefixeDevis: 'DV',
      prefixeFacture: 'FA',
      prefixeAvoir: 'AV',
      batiment: batiment !== null,
    };
  }

  return {
    formeJuridique: enregistres.formeJuridique,
    capitalSocialEuros: nombreOuNull(enregistres.capitalSocialEuros),
    immatriculationRegistre: registre(enregistres.immatriculationRegistre),
    immatriculationLieu: enregistres.immatriculationLieu,
    numeroTva: enregistres.numeroTva,
    franchiseTva: enregistres.franchiseTva,
    assuranceAssureur: enregistres.assuranceAssureur,
    assuranceContrat: enregistres.assuranceContrat,
    assuranceCouverture: enregistres.assuranceCouverture,
    mediateurNom: enregistres.mediateurNom,
    mediateurUrl: enregistres.mediateurUrl,
    penalitesTauxAnnuel: nombreOuNull(enregistres.penalitesTauxAnnuel),
    delaiPaiementJours: enregistres.delaiPaiementJours,
    escompte: enregistres.escompte,
    conditionsGenerales: enregistres.conditionsGenerales,
    piedDePage: enregistres.piedDePage,
    couleur: enregistres.couleur,
    prefixeDevis: enregistres.prefixeDevis,
    prefixeFacture: enregistres.prefixeFacture,
    prefixeAvoir: enregistres.prefixeAvoir,
    batiment: batiment !== null,
  };
}

/**
 * Enregistre les réglages.
 *
 * `upsert` plutôt que `update` : la ligne n'existe pas pour un professionnel qui n'a jamais
 * ouvert cet écran, et exiger un enregistrement préalable ferait échouer le premier.
 */
export async function enregistreParametresDocuments(
  entrepriseId: string,
  saisie: SaisieParametresDocuments,
): Promise<void> {
  const donnees = {
    formeJuridique: saisie.formeJuridique,
    capitalSocialEuros: saisie.capitalSocialEuros,
    immatriculationRegistre: saisie.immatriculationRegistre,
    immatriculationLieu: saisie.immatriculationLieu,
    numeroTva: saisie.numeroTva,
    franchiseTva: saisie.franchiseTva,
    assuranceAssureur: saisie.assuranceAssureur,
    assuranceContrat: saisie.assuranceContrat,
    assuranceCouverture: saisie.assuranceCouverture,
    mediateurNom: saisie.mediateurNom,
    mediateurUrl: saisie.mediateurUrl,
    penalitesTauxAnnuel: saisie.penalitesTauxAnnuel,
    delaiPaiementJours: saisie.delaiPaiementJours,
    escompte: saisie.escompte,
    conditionsGenerales: saisie.conditionsGenerales,
    piedDePage: saisie.piedDePage,
  };

  await prisma.parametresDocuments.upsert({
    where: { entrepriseId },
    update: donnees,
    create: { entrepriseId, ...donnees },
  });
}
