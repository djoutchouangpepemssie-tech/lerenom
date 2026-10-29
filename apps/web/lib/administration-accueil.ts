import { prisma } from '@lerenom/db';

/**
 * L'état de la plateforme, pour l'accueil du back-office.
 *
 * Quatre indicateurs, pas davantage : c'est la règle de mise en page du cahier des charges, et
 * c'est aussi la bonne. Un tableau de bord qui affiche vingt chiffres n'en fait regarder
 * aucun.
 *
 * **Les quatre retenus disent ce qui ne va pas, pas ce qui va.** Le nombre d'entreprises
 * inscrites est flatteur et inutile : il ne demande aucune décision. Les demandes sans
 * preneur, les messages bloqués, les contestations en attente et le catalogue non validé
 * appellent chacun une action, et c'est le seul critère qui ait servi à les choisir.
 *
 * Les alertes dessous sont volontairement **désagréables**. Un back-office qui cache que rien
 * ne part est un back-office qui ment à celui qui le consulte.
 */

export interface IndicateurAccueil {
  readonly cle: string;
  readonly libelle: string;
  readonly valeur: number;
  /** Une phrase qui dit quoi en faire. Un chiffre sans suite est un chiffre inutile. */
  readonly explication: string;
  /** `true` quand le chiffre appelle une action maintenant. */
  readonly alerte: boolean;
  readonly lien: string;
}

export interface EtatPlateforme {
  readonly indicateurs: readonly IndicateurAccueil[];
  readonly messagesEnAttente: number;
  readonly plusVieuxMessage: Date | null;
  readonly catalogueAValider: {
    readonly univers: number;
    readonly metiers: number;
    readonly prestations: number;
  };
  readonly entreprises: number;
  readonly entreprisesVerifiees: number;
}

export async function etatPlateforme(maintenant: Date = new Date()): Promise<EtatPlateforme> {
  const depuisUneSemaine = new Date(maintenant.getTime() - 7 * 86_400_000);

  const [
    messagesEnAttente,
    plusVieux,
    demandesSansPreneur,
    contestationsEnAttente,
    universAValider,
    metiersAValider,
    prestationsAValider,
    entreprises,
    entreprisesVerifiees,
  ] = await Promise.all([
    prisma.messageSortant.count({ where: { statut: 'en_attente' } }),
    prisma.messageSortant.findFirst({
      where: { statut: 'en_attente' },
      orderBy: { creeLe: 'asc' },
      select: { creeLe: true },
    }),
    // Une demande déposée depuis plus d'une semaine que personne n'a acceptée : un client
    // déçu, et la seule mesure qui dise si la cascade sert à quelque chose. On compte depuis
    // le **dépôt**, pas la création : un brouillon jamais déposé n'a laissé personne en plan.
    prisma.demande.count({
      where: {
        deposeeLe: { lt: depuisUneSemaine },
        annuleeLe: null,
        distributions: { none: { statut: 'acceptee' } },
      },
    }),
    prisma.contestation.count({ where: { statut: 'en_attente' } }),
    prisma.univers.count({ where: { aValider: true } }),
    prisma.metier.count({ where: { aValider: true } }),
    prisma.prestation.count({ where: { aValider: true } }),
    prisma.entreprise.count({ where: { retireeLe: null } }),
    prisma.entreprise.count({ where: { retireeLe: null, verifiee: true } }),
  ]);

  const catalogueAValider = {
    univers: universAValider,
    metiers: metiersAValider,
    prestations: prestationsAValider,
  };
  const totalCatalogue = universAValider + metiersAValider + prestationsAValider;

  const indicateurs: IndicateurAccueil[] = [
    {
      cle: 'messages',
      libelle: 'Messages en attente',
      valeur: messagesEnAttente,
      explication:
        messagesEnAttente === 0
          ? 'La file est vide : tout est parti.'
          : 'Aucun opérateur n’est raccordé : rien ne part. Les messages périmés sont abandonnés plutôt qu’envoyés en retard.',
      alerte: messagesEnAttente > 0,
      lien: '/administration/reglages',
    },
    {
      cle: 'sans-preneur',
      libelle: 'Demandes sans preneur',
      valeur: demandesSansPreneur,
      explication:
        demandesSansPreneur === 0
          ? 'Toute demande de plus d’une semaine a trouvé un professionnel.'
          : 'Déposées il y a plus d’une semaine, jamais acceptées. Chacune est un client déçu.',
      alerte: demandesSansPreneur > 0,
      lien: '/administration/demandes',
    },
    {
      cle: 'contestations',
      libelle: 'Contestations ouvertes',
      valeur: contestationsEnAttente,
      explication:
        contestationsEnAttente === 0
          ? 'Rien à arbitrer.'
          : 'Un professionnel attend une décision. Le délai court pour lui, pas pour nous.',
      alerte: contestationsEnAttente > 0,
      lien: '/administration/confiance',
    },
    {
      cle: 'catalogue',
      libelle: 'Catalogue à valider',
      valeur: totalCatalogue,
      explication:
        totalCatalogue === 0
          ? 'Le catalogue est validé.'
          : 'Reconstruit faute des fichiers d’origine. Tant qu’il n’est pas relu, le site propose des métiers que personne n’a confirmés.',
      alerte: totalCatalogue > 0,
      lien: '/administration/catalogue',
    },
  ];

  return {
    indicateurs,
    messagesEnAttente,
    plusVieuxMessage: plusVieux?.creeLe ?? null,
    catalogueAValider,
    entreprises,
    entreprisesVerifiees,
  };
}
