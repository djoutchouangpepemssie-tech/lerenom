import { PARAMETRES_PAR_DEFAUT } from '@lerenom/core';
import { prisma } from '@lerenom/db';

/**
 * Les réglages d'exploitation, vus du back-office.
 *
 * La chaîne était construite aux deux bouts et coupée au milieu. Le semis pose vingt et une
 * clés dans la table historisée ; `packages/distribution` en relit huit à chaque distribution,
 * et son commentaire promet qu'« un délai changé par Arcel s'applique à la prochaine demande,
 * sans déploiement ». Ce qui manquait, c'était **le moyen de les changer** : aucun écran,
 * aucune route, rien qu'un script de semis qui ne repose jamais une valeur déjà posée. La
 * promesse tenait en théorie et demandait, en pratique, une requête SQL à la main.
 *
 * **Seuls les huit réglages réellement relus sont affichés.** Les treize autres clés sont bien
 * en base, mais aucun code ne les consulte : les offrir à la modification donnerait un écran
 * où l'on change une valeur sans que rien ne bouge — le pire des écrans de réglages, parce
 * qu'on n'en découvre l'inutilité qu'après avoir compté dessus. Elles attendront le code qui
 * les lira, et la page dit laquelle est laquelle.
 *
 * **Chaque réglage porte ses bornes.** Un nombre de professionnels par demande à 10 000
 * n'est pas une faute de frappe qu'on rattrape ensuite : c'est une facture envoyée à des
 * entreprises qui n'ont rien demandé. Les bornes ne sont pas des conseils, elles refusent.
 *
 * **Rien n'est écrasé.** Modifier un réglage ferme la ligne en vigueur (`finitLe`) et en ouvre
 * une nouvelle. La table est historisée par construction, et c'est ce qui permet de répondre à
 * « depuis quand la cascade attend-elle deux heures ? » — question qui se pose toujours le
 * jour où quelque chose a changé sans qu'on s'en souvienne.
 */

export interface ReglageExploitation {
  readonly cle: string;
  readonly libelle: string;
  readonly explication: string;
  readonly unite: string;
  readonly minimum: number;
  readonly maximum: number;
  /** Le pas de saisie : certains réglages sont des entiers, d'autres des fractions. */
  readonly pas: number;
  readonly valeurParDefaut: number;
  /** La valeur en vigueur : celle de la base, ou le défaut du code quand rien n'est posé. */
  readonly valeur: number;
  readonly surDefaut: boolean;
  readonly modifieLe: Date | null;
  readonly modifiePar: string | null;
  readonly motif: string | null;
}

/**
 * Le catalogue des réglages modifiables.
 *
 * Cette liste est volontairement **plus courte** que l'interface `Parametres` : une clé n'y
 * figure que si `parametresEnVigueur()` la relit en base. Ajouter une ligne ici sans l'ajouter
 * là-bas fabriquerait un bouton qui ne fait rien.
 */
const CATALOGUE: readonly Omit<
  ReglageExploitation,
  'valeur' | 'surDefaut' | 'modifieLe' | 'modifiePar' | 'motif'
>[] = [
  {
    cle: 'distribution.prosMaxParDemande',
    libelle: 'Professionnels par demande',
    explication:
      'Combien de professionnels reçoivent une même demande partagée. Chaque envoi se paie, et chaque professionnel de plus est un concurrent de plus pour ceux qui l’ont déjà reçue.',
    unite: 'professionnels',
    minimum: 1,
    maximum: 5,
    pas: 1,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.prosMaxParDemande,
  },
  {
    cle: 'distribution.minutesExclusiviteExclusif',
    libelle: 'Exclusivité du partenaire Exclusif',
    explication:
      'Minutes pendant lesquelles le partenaire Exclusif de la zone reçoit la demande seul. C’est la contrepartie concrète de sa formule : l’allonger le favorise, la réduire fait attendre le client.',
    unite: 'minutes',
    minimum: 0,
    maximum: 120,
    pas: 5,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.minutesExclusiviteExclusif,
  },
  {
    cle: 'distribution.minutesReponseAutresPros',
    libelle: 'Délai de réponse laissé aux autres',
    explication:
      'Minutes ouvrées laissées à un professionnel pour répondre avant que la demande passe au suivant. Trop court, les sérieux sont écartés ; trop long, le client attend.',
    unite: 'minutes',
    minimum: 15,
    maximum: 1440,
    pas: 15,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.minutesReponseAutresPros,
  },
  {
    cle: 'distribution.minutesAvanceUrgence',
    libelle: 'Avance des abonnés sur une urgence',
    explication:
      'Minutes d’avance des professionnels abonnés sur une demande urgente. Sur une fuite d’eau, cinq minutes décident de qui décroche.',
    unite: 'minutes',
    minimum: 0,
    maximum: 30,
    pas: 1,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.minutesAvanceUrgence,
  },
  {
    cle: 'distribution.heuresFraicheurDemande',
    libelle: 'Péremption d’une demande',
    explication:
      'Heures au-delà desquelles une demande n’est plus jamais proposée. Passé ce délai, le client a trouvé ailleurs, et l’envoyer dérange tout le monde pour rien.',
    unite: 'heures',
    minimum: 6,
    maximum: 168,
    pas: 6,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.heuresFraicheurDemande,
  },
  {
    cle: 'distribution.rayonAgenceParDefautKm',
    libelle: 'Rayon d’intervention par défaut',
    explication:
      'Kilomètres autour d’une agence qui n’a pas réglé son rayon. S’applique à toute agence créée sans choix explicite.',
    unite: 'km',
    minimum: 2,
    maximum: 60,
    pas: 1,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.rayonAgenceParDefautKm,
  },
  {
    cle: 'classement.noteMinimale',
    libelle: 'Note minimale d’un emplacement payé',
    explication:
      'En dessous de cette note, une fiche payante perd son emplacement sponsorisé et sort de la distribution prioritaire. C’est ce qui empêche d’acheter la première place avec un mauvais travail.',
    unite: '/ 5',
    minimum: 1,
    maximum: 5,
    pas: 0.1,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.noteMinimale,
  },
  {
    cle: 'quotas.seuilAlerteForfait',
    libelle: 'Seuil d’alerte sur le forfait',
    explication:
      'Part du forfait mensuel à partir de laquelle le professionnel et l’administration sont prévenus. 0,8 signifie une alerte à 80 % des demandes consommées.',
    unite: 'part',
    minimum: 0.5,
    maximum: 1,
    pas: 0.05,
    valeurParDefaut: PARAMETRES_PAR_DEFAUT.seuilAlerteForfait,
  },
];

export interface CompteAdministration {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly role: string;
  readonly actif: boolean;
  readonly doubleAuthentification: boolean;
  readonly derniereConnexion: Date | null;
  readonly tentativesConnexion: number;
}

export interface LigneJournal {
  readonly id: string;
  readonly auteur: string;
  readonly action: string;
  readonly typeObjet: string;
  readonly objetId: string | null;
  readonly creeLe: Date;
  readonly avant: unknown;
  readonly apres: unknown;
}

export interface EtatReglages {
  readonly reglages: readonly ReglageExploitation[];
  readonly comptes: readonly CompteAdministration[];
  readonly journal: readonly LigneJournal[];
  readonly surDefaut: number;
}

export async function etatReglages(): Promise<EtatReglages> {
  const [lignes, comptes, journal] = await Promise.all([
    prisma.parametre.findMany({
      where: { finitLe: null },
      select: { cle: true, valeur: true, debuteLe: true, modifiePar: true, motif: true },
    }),
    prisma.admin.findMany({
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        totpActiveLe: true,
        derniereConnexion: true,
        tentativesConnexion: true,
      },
    }),
    prisma.journalAudit.findMany({
      orderBy: { creeLe: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        typeObjet: true,
        objetId: true,
        avant: true,
        apres: true,
        creeLe: true,
        admin: { select: { nom: true } },
      },
    }),
  ]);

  const posees = new Map(lignes.map((l) => [l.cle, l]));

  const reglages = CATALOGUE.map((modele): ReglageExploitation => {
    const posee = posees.get(modele.cle);
    const valeur = typeof posee?.valeur === 'number' ? posee.valeur : modele.valeurParDefaut;
    return {
      ...modele,
      valeur,
      surDefaut: posee === undefined,
      modifieLe: posee?.debuteLe ?? null,
      modifiePar: posee?.modifiePar ?? null,
      motif: posee?.motif ?? null,
    };
  });

  return {
    reglages,
    comptes: comptes.map((compte) => ({
      id: compte.id,
      nom: compte.nom,
      email: compte.email,
      role: compte.role,
      actif: compte.actif,
      doubleAuthentification: compte.totpActiveLe !== null,
      derniereConnexion: compte.derniereConnexion,
      tentativesConnexion: compte.tentativesConnexion,
    })),
    journal: journal.map((ligne) => ({
      id: ligne.id,
      // Un compte supprimé laisse ses lignes derrière lui : le journal ne s'efface pas quand
      // la personne s'en va, sinon il ne vaudrait rien le jour où elle part fâchée.
      auteur: ligne.admin?.nom ?? 'compte supprimé',
      action: ligne.action,
      typeObjet: ligne.typeObjet,
      objetId: ligne.objetId,
      creeLe: ligne.creeLe,
      avant: ligne.avant,
      apres: ligne.apres,
    })),
    surDefaut: reglages.filter((r) => r.surDefaut).length,
  };
}

export interface ResultatReglage {
  readonly ok: boolean;
  readonly message?: string;
  readonly avant?: unknown;
  readonly apres?: unknown;
}

/**
 * Change un réglage, en gardant l'ancien.
 *
 * La ligne en vigueur est **close**, jamais écrasée, et une nouvelle est ouverte. Les deux
 * écritures sont dans une transaction : deux lignes ouvertes sur la même clé rendraient le
 * réglage indéterminé, et aucune ligne ouverte le ferait retomber en silence sur le défaut du
 * code — deux façons différentes de ne plus savoir ce qui s'applique.
 *
 * Le motif est obligatoire. Un délai de cascade qui change modifie les revenus de tous les
 * professionnels de la plateforme ; dans six mois, « pourquoi deux heures et pas une ? » doit
 * avoir une réponse autre que le hasard.
 */
export async function changeLeReglage(
  cle: string,
  valeur: number,
  motif: string,
  adminNom: string,
): Promise<ResultatReglage> {
  const modele = CATALOGUE.find((r) => r.cle === cle);
  if (modele === undefined) {
    return { ok: false, message: 'Ce réglage n’existe pas, ou n’est pas modifiable.' };
  }

  if (!Number.isFinite(valeur)) {
    return { ok: false, message: 'Cette valeur n’est pas un nombre.' };
  }
  if (valeur < modele.minimum || valeur > modele.maximum) {
    return {
      ok: false,
      message: `${modele.libelle} doit rester entre ${modele.minimum} et ${modele.maximum} ${modele.unite}.`,
    };
  }
  if (modele.pas >= 1 && !Number.isInteger(valeur)) {
    return { ok: false, message: `${modele.libelle} s’exprime en nombre entier.` };
  }

  const propre = motif.trim();
  if (propre.length < 10) {
    return {
      ok: false,
      message:
        'Un réglage change le fonctionnement de la plateforme pour tout le monde : écrivez pourquoi, en une phrase au moins.',
    };
  }

  const enVigueur = await prisma.parametre.findFirst({
    where: { cle, finitLe: null },
    select: { id: true, valeur: true },
  });
  const ancienne =
    typeof enVigueur?.valeur === 'number' ? enVigueur.valeur : modele.valeurParDefaut;
  if (ancienne === valeur) {
    return { ok: false, message: 'Cette valeur est déjà celle en vigueur.' };
  }

  const maintenant = new Date();
  await prisma.$transaction(async (transaction) => {
    if (enVigueur !== null) {
      await transaction.parametre.update({
        where: { id: enVigueur.id },
        data: { finitLe: maintenant },
      });
    }
    await transaction.parametre.create({
      data: {
        cle,
        valeur,
        debuteLe: maintenant,
        modifiePar: adminNom,
        motif: propre,
      },
    });
  });

  return {
    ok: true,
    avant: { valeur: ancienne, surDefaut: enVigueur === null },
    apres: { valeur, motif: propre },
  };
}
