import { prisma } from '@lerenom/db';
import { nomVille } from '@/lib/affichage';
import {
  calculeTotaux,
  echeanceDe,
  factureConforme,
  type AdressePostale,
  type CategorieOperation,
  type ConformiteFacture,
  type Destinataire,
  type Emetteur,
  type LigneDocument,
  type MentionsFacture,
  type TauxPenalites,
  type TauxTva,
  type Totaux,
} from '@lerenom/core';

/**
 * Le document tel qu'il s'imprime : devis, facture ou avoir.
 *
 * **Un seul assemblage pour l'écran et pour le PDF.** C'est la raison d'être de ce fichier.
 * Une page qui lit la base d'un côté et un générateur de PDF qui la relit de l'autre finissent
 * par ne plus dire la même chose, et l'écart se découvre chez le client. Le PDF sera imprimé
 * depuis cette page, pas reconstruit à côté d'elle — même assemblage, même mise en page, mêmes
 * mentions.
 *
 * Deux choses sont volontairement absentes.
 *
 * **Le document n'est pas stocké.** Il est une fonction de la facture, et une facture émise est
 * immuable — la base l'interdit par déclencheur. Le garder en double créerait une seconde
 * source de vérité, donc un jour un désaccord. Il est recalculé à chaque demande.
 *
 * **Les totaux ne sont pas relus.** Ils sont recalculés par `calculeTotaux` à partir des
 * lignes, comme partout ailleurs : les colonnes de la base servent au classement et aux
 * recherches, pas à l'impression. Une seule arithmétique, un seul résultat possible.
 */

export type TypeDocument = 'devis' | 'facture' | 'avoir';

/**
 * Les mentions obligatoires du devis de dépannage, de réparation et d'entretien à domicile
 * (arrêté du 24 janvier 2017). Elles sont déjà vérifiées avant l'envoi par `devisConforme` ;
 * ici, elles s'impriment. Les vérifier sans les imprimer n'aurait servi à rien.
 */
export interface MentionsDevisImprimees {
  readonly validiteJours: number;
  /** Les frais de déplacement, **même nuls** : « offerts » est une information. */
  readonly fraisDeplacementTTC: number | null;
  readonly devisPayant: boolean;
  readonly piecesRemplaceesGardees: boolean;
  readonly mentionRetractation: boolean;
  readonly acomptePourcent: number;
  readonly signeLe: Date | null;
  /** Le mobile qui a validé le code, masqué : il prouve la signature sans l'exposer. */
  readonly signeParTelephoneMasque: string | null;
}

export interface DocumentAImprimer {
  readonly type: TypeDocument;
  /** « Facture », « Facture d'acompte », « Devis », « Avoir » — le titre imprimé. */
  readonly intitule: string;
  readonly numero: string | null;
  readonly emiseLe: Date | null;
  readonly echeanceLe: Date | null;
  readonly prestationLe: Date | null;
  readonly emetteur: Emetteur;
  readonly destinataire: Destinataire;
  readonly lignes: readonly (LigneDocument & { readonly rang: number })[];
  readonly totaux: Totaux;
  /** Acompte déjà facturé, à retrancher du solde. Zéro ailleurs. */
  readonly acompteDejaFactureTTC: number;
  /**
   * Facture d'acompte : le net à payer ne découle pas du total affiché, et le document doit le
   * dire. Un client qui lit « Total TTC 1 234,20 € » puis « Net à payer 370,26 € » sans
   * explication croit à une erreur — et appelle.
   */
  readonly acompte: boolean;
  readonly montantAPayerTTC: number;
  readonly tauxPenalites: TauxPenalites;
  readonly escompte: string | null;
  readonly categorieOperation: CategorieOperation;
  readonly adresseLivraison: AdressePostale | null;
  readonly autoliquidation: boolean;
  readonly rib: {
    readonly titulaire: string;
    readonly iban: string;
    readonly banque: string | null;
  } | null;
  readonly conditionsGenerales: string | null;
  readonly piedDePage: string | null;
  readonly couleur: string;
  readonly devisNumero: string | null;
  /** Le motif, pour un avoir seulement. */
  readonly motif: string | null;
  /** Les mentions propres au devis. `null` sur une facture et sur un avoir. */
  readonly devis: MentionsDevisImprimees | null;
  /** La facture qu'un avoir annule ou corrige. `null` ailleurs. */
  readonly factureCreditee: {
    readonly numero: string | null;
    readonly emiseLe: Date | null;
  } | null;
  /** Ce qui manque pour que le document soit conforme. Vide quand il l'est. */
  readonly conformite: ConformiteFacture;
}

function nombre(valeur: unknown): number {
  return Number(valeur ?? 0);
}

/** Une chaîne vide n'est pas une valeur : un champ rempli d'espaces ne prouve rien. */
function texteOuNull(valeur: string | null | undefined): string | null {
  if (valeur === null || valeur === undefined) return null;
  const propre = valeur.trim();
  return propre === '' ? null : propre;
}

function adresse(
  voie: string | null | undefined,
  codePostal: string | null | undefined,
  commune: string | null | undefined,
): AdressePostale | null {
  const v = texteOuNull(voie);
  const cp = texteOuNull(codePostal);
  const c = texteOuNull(commune);
  if (v === null || cp === null || c === null) return null;
  return { voie: v, codePostal: cp, commune: c };
}

/**
 * La catégorie de l'opération, déduite des lignes.
 *
 * C'est l'une des quatre mentions du décret n° 2022-1299. On la déduit plutôt que de la
 * demander : le professionnel qui facture une main-d'œuvre et des pièces n'a pas à cocher une
 * case pour le dire, ses lignes le disent déjà. Les fournitures se reconnaissent à leur unité
 * — une quantité en m², en mètre linéaire ou à l'unité est un bien ; une heure, un jour ou un
 * forfait est un service.
 */
export function categorieDesLignes(
  lignes: readonly Pick<LigneDocument, 'type' | 'unite'>[],
): CategorieOperation {
  let biens = false;
  let services = false;
  for (const ligne of lignes) {
    if (ligne.type !== 'prestation') continue;
    if (ligne.unite === 'unite' || ligne.unite === 'm2' || ligne.unite === 'ml') biens = true;
    else services = true;
  }
  if (biens && services) return 'mixte';
  if (biens) return 'biens';
  // Faute de ligne chiffrée, « prestation de services » est le défaut prudent : c'est
  // l'essentiel de ce qui se facture ici, et la mention doit figurer même sur un document
  // encore en préparation.
  return 'services';
}

interface Parametres {
  readonly formeJuridique: string | null;
  readonly capitalSocialEuros: unknown;
  readonly immatriculationRegistre: string | null;
  readonly immatriculationLieu: string | null;
  readonly numeroTva: string | null;
  readonly franchiseTva: boolean;
  readonly assuranceAssureur: string | null;
  readonly assuranceContrat: string | null;
  readonly assuranceCouverture: string | null;
  readonly mediateurNom: string | null;
  readonly mediateurUrl: string | null;
  readonly penalitesTauxAnnuel: unknown;
  readonly delaiPaiementJours: number;
  readonly escompte: string | null;
  readonly conditionsGenerales: string | null;
  readonly piedDePage: string | null;
  readonly couleur: string;
}

/** Les réglages d'un professionnel qui n'a rien rempli : tout manquant, rien d'inventé. */
const PARAMETRES_VIDES: Parametres = {
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
  couleur: '#16181D',
};

function emetteurDe(
  entreprise: {
    readonly nom: string;
    readonly siret: string | null;
    readonly agences: readonly {
      readonly adresse: string;
      readonly codePostal: string;
      readonly commune: { readonly nom: string };
    }[];
    readonly metiers: readonly {
      readonly metier: { readonly univers: { readonly batiment: boolean } };
    }[];
  },
  parametres: Parametres,
): Emetteur {
  const siege = entreprise.agences[0];
  const registre = parametres.immatriculationRegistre;
  const assureur = texteOuNull(parametres.assuranceAssureur);
  const couverture = texteOuNull(parametres.assuranceCouverture);
  const contrat = texteOuNull(parametres.assuranceContrat);
  const mediateurNom = texteOuNull(parametres.mediateurNom);
  const mediateurUrl = texteOuNull(parametres.mediateurUrl);

  // Une société se reconnaît à sa forme juridique : l'entreprise individuelle et la
  // micro-entreprise n'ont pas de capital social, et le réclamer les bloquerait pour rien.
  const forme = texteOuNull(parametres.formeJuridique);
  const societe = forme !== null && !/^(EI|micro|auto)/i.test(forme);

  return {
    nom: entreprise.nom,
    formeJuridique: forme,
    // `nomVille` plutôt que le nom brut : l'INSEE écrit « Paris 11e Arrondissement », ce qui
    // n'est l'adresse de personne. Une facture se lit, et parfois se recopie à la main.
    adresse:
      siege === undefined
        ? null
        : adresse(siege.adresse, siege.codePostal, nomVille(siege.commune.nom)),
    siret: texteOuNull(entreprise.siret),
    numeroTva: texteOuNull(parametres.numeroTva),
    franchiseTva: parametres.franchiseTva,
    immatriculation:
      registre === 'rcs' || registre === 'rm'
        ? { registre, lieu: texteOuNull(parametres.immatriculationLieu) ?? '' }
        : null,
    capitalSocialEuros:
      parametres.capitalSocialEuros === null ? null : nombre(parametres.capitalSocialEuros),
    assurance:
      assureur === null && couverture === null
        ? null
        : {
            assureur: assureur ?? '',
            couverture: couverture ?? '',
            ...(contrat !== null ? { contrat } : {}),
          },
    mediateur:
      mediateurNom === null || mediateurUrl === null
        ? null
        : { nom: mediateurNom, url: mediateurUrl },
    // L'assurance professionnelle ne s'impose qu'aux métiers du bâtiment. La qualification vit
    // sur l'univers, en base : l'écrire ici en dur ferait d'une règle de droit une liste
    // enfouie dans un composant.
    batiment: entreprise.metiers.some((lien) => lien.metier.univers.batiment),
    societe,
  };
}

function destinataireDe(
  client: {
    readonly nom: string;
    readonly adresse: string | null;
    readonly codePostal: string | null;
    readonly ville: string | null;
    readonly professionnel: boolean;
    readonly siren: string | null;
  } | null,
): Destinataire {
  if (client === null) {
    return { nom: '', adresse: null, siren: null, professionnel: false };
  }
  return {
    nom: client.nom,
    adresse: adresse(client.adresse, client.codePostal, client.ville),
    siren: texteOuNull(client.siren),
    professionnel: client.professionnel,
  };
}

const SELECTION_ENTREPRISE = {
  nom: true,
  siret: true,
  agences: {
    where: { principale: true },
    take: 1,
    select: { adresse: true, codePostal: true, commune: { select: { nom: true } } },
  },
  metiers: { select: { metier: { select: { univers: { select: { batiment: true } } } } } },
  parametresDocuments: true,
} as const;

const SELECTION_CLIENT = {
  nom: true,
  adresse: true,
  codePostal: true,
  ville: true,
  professionnel: true,
  siren: true,
} as const;

const SELECTION_LIGNES = {
  orderBy: { rang: 'asc' },
  select: {
    id: true,
    rang: true,
    type: true,
    designation: true,
    detail: true,
    unite: true,
    quantite: true,
    prixUnitaireHT: true,
    tauxTva: true,
  },
} as const;

type LigneBrute = {
  readonly id: string;
  readonly rang: number;
  readonly type: string;
  readonly designation: string;
  readonly detail: string | null;
  readonly unite: string | null;
  readonly quantite: unknown;
  readonly prixUnitaireHT: unknown;
  readonly tauxTva: unknown;
};

function lignesDe(brutes: readonly LigneBrute[]): (LigneDocument & { rang: number })[] {
  return brutes.map((ligne) => ({
    id: ligne.id,
    rang: ligne.rang,
    type: ligne.type as LigneDocument['type'],
    designation: ligne.designation,
    ...(ligne.detail !== null ? { detail: ligne.detail } : {}),
    ...(ligne.unite !== null ? { unite: ligne.unite as NonNullable<LigneDocument['unite']> } : {}),
    ...(ligne.quantite !== null ? { quantite: nombre(ligne.quantite) } : {}),
    ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: nombre(ligne.prixUnitaireHT) } : {}),
    ...(ligne.tauxTva !== null ? { tauxTva: nombre(ligne.tauxTva) as TauxTva } : {}),
  }));
}

function tauxPenalitesDe(parametres: Parametres): TauxPenalites {
  const taux = parametres.penalitesTauxAnnuel;
  if (taux === null || taux === undefined) return { mode: 'legal' };
  const valeur = nombre(taux);
  return valeur > 0 ? { mode: 'stipule', tauxAnnuel: valeur } : { mode: 'legal' };
}

/**
 * La facture d'un professionnel, prête à imprimer.
 *
 * Rend `null` quand la facture n'est pas la sienne : la fonction ne distingue pas « absente »
 * de « à quelqu'un d'autre », de façon qu'un identifiant deviné n'apprenne rien.
 */
export async function factureAImprimer(
  entrepriseId: string,
  factureId: string,
  maintenant: Date = new Date(),
): Promise<DocumentAImprimer | null> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    select: {
      numero: true,
      type: true,
      emiseLe: true,
      echeanceLe: true,
      creeLe: true,
      montantAPayerTTC: true,
      acompteDejaFactureTTC: true,
      lignes: SELECTION_LIGNES,
      client: { select: SELECTION_CLIENT },
      devis: { select: { numero: true } },
      rib: { select: { titulaire: true, iban: true, banque: true } },
      entreprise: { select: SELECTION_ENTREPRISE },
    },
  });
  if (facture === null) return null;

  const parametres = facture.entreprise.parametresDocuments ?? PARAMETRES_VIDES;
  const lignes = lignesDe(facture.lignes);
  const destinataire = destinataireDe(facture.client);
  const emetteur = emetteurDe(facture.entreprise, parametres);
  const totaux = calculeTotaux({ lignes });

  // Tant que la facture n'est pas émise, on montre le RIB actif du jour : c'est celui qui sera
  // figé. Une fois émise, celui qui l'a été, et lui seul — un client qui paie une facture de
  // l'an dernier ne doit pas payer sur un compte fermé.
  const rib =
    facture.rib ??
    (facture.emiseLe === null
      ? await prisma.rib.findFirst({
          where: { entrepriseId, actif: true },
          select: { titulaire: true, iban: true, banque: true },
        })
      : null);

  const emiseLe = facture.emiseLe;
  // L'échéance stockée est celle qui a été figée à l'émission ; avant, on montre celle qui le
  // sera. Même partage que pour le RIB : une facture émise ne change plus d'échéance, et une
  // facture en préparation doit tout de même en afficher une.
  const echeanceLe =
    facture.echeanceLe ??
    (emiseLe === null ? null : echeanceDe(emiseLe, parametres.delaiPaiementJours));
  // La date de la prestation : celle du rendez-vous honoré s'il y en a un, sinon la date
  // d'émission. Le devis porte la date d'intervention prévue, la facture celle réalisée.
  const prestationLe = emiseLe;
  const categorieOperation = categorieDesLignes(lignes);
  const tauxPenalites = tauxPenalitesDe(parametres);

  // Le contrôle porte sur la facture **telle qu'elle sera émise**, pas telle qu'elle est.
  // Le numéro, la date d'émission, celle de la prestation et l'échéance sont posés par
  // l'émission elle-même : les signaler comme manquants ferait quatre lignes rouges que le
  // professionnel ne peut pas corriger, noyant les cinq qui le concernent vraiment. La
  // question à laquelle il a besoin d'une réponse est « cette facture sera-t-elle en règle
  // quand je l'émettrai ? ».
  const aLEmission = emiseLe ?? maintenant;
  const mentions: MentionsFacture = {
    numero: facture.numero ?? 'à attribuer',
    emiseLe: aLEmission,
    prestationLe: prestationLe ?? aLEmission,
    emetteur,
    destinataire,
    reglement: {
      echeanceLe: echeanceLe ?? echeanceDe(aLEmission, parametres.delaiPaiementJours),
      tauxPenalites,
      escompte: texteOuNull(parametres.escompte),
    },
    categorieOperation,
    adresseLivraison: null,
    tvaSurLesDebits: false,
    autoliquidation: false,
  };

  return {
    type: 'facture',
    intitule: facture.type === 'acompte' ? 'Facture d’acompte' : 'Facture',
    numero: facture.numero,
    emiseLe,
    echeanceLe,
    prestationLe,
    emetteur,
    destinataire,
    lignes,
    totaux,
    acompteDejaFactureTTC: nombre(facture.acompteDejaFactureTTC),
    acompte: facture.type === 'acompte',
    montantAPayerTTC: nombre(facture.montantAPayerTTC),
    tauxPenalites,
    escompte: texteOuNull(parametres.escompte),
    categorieOperation,
    adresseLivraison: null,
    autoliquidation: false,
    rib,
    conditionsGenerales: texteOuNull(parametres.conditionsGenerales),
    piedDePage: texteOuNull(parametres.piedDePage),
    couleur: parametres.couleur,
    devisNumero: facture.devis?.numero ?? null,
    motif: null,
    devis: null,
    factureCreditee: null,
    // Une facture non émise se vérifie avant de l'être : c'est le moment utile pour dire ce
    // qui manque, parce qu'après, elle ne se modifie plus.
    conformite: factureConforme(mentions),
  };
}

/** Un mobile masqué : « 06 •• •• •• 12 ». Il prouve la signature sans l'exposer. */
function mobileMasque(numero: string | null): string | null {
  if (numero === null) return null;
  const chiffres = numero.replace(/\D/g, '');
  if (chiffres.length < 4) return null;
  return `${chiffres.slice(0, 2)} •• •• •• ${chiffres.slice(-2)}`;
}

/**
 * Le devis d'un professionnel, prêt à imprimer.
 *
 * Le devis n'est pas une facture en attente : il porte ses propres mentions obligatoires —
 * frais de déplacement même nuls, durée de validité, caractère gratuit ou payant, sort des
 * pièces remplacées — imposées par l'arrêté du 24 janvier 2017 pour le dépannage à domicile.
 * `devisConforme` les vérifie avant l'envoi ; cette fonction les imprime. Vérifier sans
 * imprimer n'aurait protégé personne.
 */
export async function devisAImprimer(
  entrepriseId: string,
  devisId: string,
  maintenant: Date = new Date(),
): Promise<DocumentAImprimer | null> {
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    select: {
      numero: true,
      type: true,
      statut: true,
      envoyeLe: true,
      signeLe: true,
      signeParTelephone: true,
      creeLe: true,
      validiteJours: true,
      remisePourcent: true,
      acomptePourcent: true,
      fraisDeplacementTTC: true,
      devisPayant: true,
      piecesRemplaceesGardees: true,
      mentionRetractation: true,
      lignes: SELECTION_LIGNES,
      client: { select: SELECTION_CLIENT },
      entreprise: { select: SELECTION_ENTREPRISE },
    },
  });
  if (devis === null) return null;

  const parametres = devis.entreprise.parametresDocuments ?? PARAMETRES_VIDES;
  const lignes = lignesDe(devis.lignes);
  const destinataire = destinataireDe(devis.client);
  const emetteur = emetteurDe(devis.entreprise, parametres);
  const totaux = calculeTotaux({
    lignes,
    remisePourcent: nombre(devis.remisePourcent),
    acomptePourcent: devis.acomptePourcent as 0 | 30 | 40,
  });
  const emisLe = devis.envoyeLe;
  const categorieOperation = categorieDesLignes(lignes);
  const tauxPenalites = tauxPenalitesDe(parametres);

  // Un devis n'est pas une facture : son échéance n'est pas un délai de paiement mais la fin
  // de sa validité. On ne lui applique donc pas `echeanceDe`, qui compterait trente jours de
  // règlement sur un document qui n'en réclame aucun.
  const base = emisLe ?? maintenant;
  const finDeValidite = new Date(base.getTime());
  finDeValidite.setDate(finDeValidite.getDate() + devis.validiteJours);

  const mentions: MentionsFacture = {
    numero: devis.numero ?? 'à attribuer',
    emiseLe: base,
    prestationLe: base,
    emetteur,
    destinataire,
    reglement: {
      echeanceLe: finDeValidite,
      tauxPenalites,
      escompte: texteOuNull(parametres.escompte),
    },
    categorieOperation,
    adresseLivraison: null,
    tvaSurLesDebits: false,
    autoliquidation: false,
  };

  return {
    type: 'devis',
    intitule: devis.type === 'estimatif' ? 'Devis estimatif' : 'Devis',
    numero: devis.numero,
    emiseLe: emisLe,
    echeanceLe: finDeValidite,
    prestationLe: null,
    emetteur,
    destinataire,
    lignes,
    totaux,
    acompteDejaFactureTTC: 0,
    acompte: false,
    montantAPayerTTC: totaux.totalTTC,
    tauxPenalites,
    escompte: texteOuNull(parametres.escompte),
    categorieOperation,
    adresseLivraison: null,
    autoliquidation: false,
    rib: null,
    conditionsGenerales: texteOuNull(parametres.conditionsGenerales),
    piedDePage: texteOuNull(parametres.piedDePage),
    couleur: parametres.couleur,
    devisNumero: null,
    motif: null,
    devis: {
      validiteJours: devis.validiteJours,
      fraisDeplacementTTC:
        devis.fraisDeplacementTTC === null ? null : nombre(devis.fraisDeplacementTTC),
      devisPayant: devis.devisPayant,
      piecesRemplaceesGardees: devis.piecesRemplaceesGardees,
      mentionRetractation: devis.mentionRetractation,
      acomptePourcent: devis.acomptePourcent,
      signeLe: devis.signeLe,
      signeParTelephoneMasque: mobileMasque(devis.signeParTelephone),
    },
    factureCreditee: null,
    // Le contrôle des mentions de l'émetteur vaut aussi pour un devis : il porte la même
    // identité, et un devis signé devient une facture sans qu'on repose la question.
    conformite: factureConforme(mentions),
  };
}

/**
 * L'avoir d'un professionnel, prêt à imprimer.
 *
 * Un avoir n'a pas de lignes : il porte un montant et un motif. C'est voulu — le détail est
 * dans la facture qu'il corrige, et le recopier créerait deux versions d'un même décompte.
 * Le document désigne donc la facture créditée, en toutes lettres : un avoir qui ne dit pas
 * ce qu'il annule n'est pas opposable.
 *
 * Il n'est jamais « à compléter » : un avoir ne se prépare pas, il est émis d'emblée. Ses
 * mentions sont celles de sa facture, qui les portait déjà.
 */
export async function avoirAImprimer(
  entrepriseId: string,
  avoirId: string,
): Promise<DocumentAImprimer | null> {
  const avoir = await prisma.avoir.findFirst({
    where: { id: avoirId, entrepriseId },
    select: {
      numero: true,
      motif: true,
      montantTTC: true,
      emisLe: true,
      facture: {
        select: {
          numero: true,
          emiseLe: true,
          client: { select: SELECTION_CLIENT },
        },
      },
      entreprise: { select: SELECTION_ENTREPRISE },
    },
  });
  if (avoir === null) return null;

  const parametres = avoir.entreprise.parametresDocuments ?? PARAMETRES_VIDES;
  const destinataire = destinataireDe(avoir.facture.client);
  const emetteur = emetteurDe(avoir.entreprise, parametres);
  const montant = nombre(avoir.montantTTC);

  const mentions: MentionsFacture = {
    numero: avoir.numero,
    emiseLe: avoir.emisLe,
    prestationLe: avoir.facture.emiseLe ?? avoir.emisLe,
    emetteur,
    destinataire,
    reglement: {
      echeanceLe: avoir.emisLe,
      tauxPenalites: tauxPenalitesDe(parametres),
      escompte: null,
    },
    categorieOperation: 'services',
    adresseLivraison: null,
    tvaSurLesDebits: false,
    autoliquidation: false,
  };

  return {
    type: 'avoir',
    intitule: 'Avoir',
    numero: avoir.numero,
    emiseLe: avoir.emisLe,
    echeanceLe: null,
    prestationLe: null,
    emetteur,
    destinataire,
    lignes: [],
    // Un avoir ne détaille pas : il crédite un montant. Les totaux sont donc tous ce montant,
    // et la TVA n'est pas reventilée — elle l'a été sur la facture d'origine.
    totaux: {
      totalBrutHT: 0,
      remiseHT: 0,
      totalHT: 0,
      tva: [],
      totalTVA: 0,
      totalTTC: montant,
      acompteTTC: 0,
      soldeTTC: montant,
    },
    acompteDejaFactureTTC: 0,
    acompte: false,
    montantAPayerTTC: montant,
    tauxPenalites: { mode: 'legal' },
    escompte: null,
    categorieOperation: 'services',
    adresseLivraison: null,
    autoliquidation: false,
    rib: null,
    conditionsGenerales: null,
    piedDePage: texteOuNull(parametres.piedDePage),
    couleur: parametres.couleur,
    devisNumero: null,
    motif: avoir.motif,
    devis: null,
    factureCreditee: { numero: avoir.facture.numero, emiseLe: avoir.facture.emiseLe },
    conformite: factureConforme(mentions),
  };
}
