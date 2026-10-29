import { prisma } from '@lerenom/db';

/**
 * La croissance, vue du back-office.
 *
 * Trois tables de mesure existaient depuis le premier jour — `Affichage`, `Clic`, `Appel` —
 * et **aucune n'était écrite**. Un écran posé dessus aurait montré trois zéros, ce qui est
 * pire que pas d'écran : on en déduit que personne ne vient, alors que personne ne compte.
 * La mesure a donc été branchée avant (`lib/mesure.ts`), et cet écran la lit.
 *
 * ## Ce qu'il montre, et pour qui
 *
 * Le chiffre qui compte ici n'est pas le trafic : c'est **ce que chaque abonné reçoit pour son
 * argent**. Un Premium paie 79 € par mois une place en haut de page ; s'il ne peut pas voir
 * combien de fois elle lui a été montrée et combien de visiteurs ont ouvert sa fiche, il
 * résiliera au premier mois creux, et on n'aura rien à lui opposer.
 *
 * ## Ce qu'il ne montre pas
 *
 * **Les appels.** Ils supposent des numéros de suivi, donc un opérateur téléphonique, qui
 * n'est pas raccordé (`QUESTIONS.md` §Q36). L'écran le dit en toutes lettres plutôt que
 * d'afficher un zéro, qui se lirait comme « personne n'appelle ».
 *
 * **L'historique d'avant aujourd'hui.** La mesure commence le jour où elle a été posée ; les
 * semaines précédentes sont vides, et elles le resteront. Le dire évite de chercher une panne
 * là où il n'y a qu'un début.
 */

export interface LigneAudience {
  readonly entrepriseId: string;
  readonly entreprise: string;
  readonly slug: string;
  readonly formule: string;
  readonly affichages: number;
  readonly affichagesSponsorises: number;
  readonly ouverturesFiche: number;
  /** Part des affichages qui ont donné une ouverture de fiche. `null` sans affichage. */
  readonly tauxOuverture: number | null;
}

export interface JourAudience {
  readonly jour: string;
  readonly affichages: number;
  /** Ouvertures de fiche, et elles seules : le même compte que partout ailleurs. */
  readonly ouvertures: number;
}

export interface EtatCroissance {
  readonly lignes: readonly LigneAudience[];
  readonly jours: readonly JourAudience[];
  readonly indicateurs: {
    readonly affichages: number;
    readonly clics: number;
    readonly tauxOuverture: number | null;
    /** Jours écoulés depuis la première mesure. Zéro tant que rien n'est enregistré. */
    readonly joursMesures: number;
    /** Abonnés payants qui n'ont reçu aucun affichage : ils paient pour rien. */
    readonly payantsSansAudience: number;
  };
}

/** Les trente derniers jours, bornes comprises. */
function depuis(jours: number, maintenant = new Date()): string {
  const debut = new Date(maintenant.getTime() - jours * 86_400_000);
  return debut.toISOString().slice(0, 10);
}

export async function etatCroissance(maintenant = new Date()): Promise<EtatCroissance> {
  const debut = depuis(30, maintenant);

  const [affichages, clics, entreprises] = await Promise.all([
    prisma.affichage.groupBy({
      by: ['entrepriseId', 'sponsorise'],
      where: { jour: { gte: debut } },
      _sum: { nombre: true },
    }),
    prisma.clic.groupBy({
      by: ['entrepriseId', 'type'],
      where: { jour: { gte: debut } },
      _sum: { nombre: true },
    }),
    prisma.entreprise.findMany({
      where: { retireeLe: null },
      select: {
        id: true,
        nom: true,
        slug: true,
        abonnements: { where: { statut: 'actif' }, take: 1, select: { formule: true } },
      },
    }),
  ]);

  const [parJourAffichages, parJourClics] = await Promise.all([
    prisma.affichage.groupBy({
      by: ['jour'],
      where: { jour: { gte: debut } },
      _sum: { nombre: true },
      orderBy: { jour: 'asc' },
    }),
    // `type: 'fiche'`, comme partout ailleurs sur cet écran. Sans ce filtre, la ligne du jour
    // additionnait tous les clics — ouverture de fiche, téléphone — pendant que la carte et
    // le tableau ne comptaient que les ouvertures : deux chiffres portant le même nom et
    // affichant des valeurs différentes sur le même écran. C'est la capture qui l'a montré.
    prisma.clic.groupBy({
      by: ['jour'],
      where: { jour: { gte: debut }, type: 'fiche' },
      _sum: { nombre: true },
      orderBy: { jour: 'asc' },
    }),
  ]);

  const vues = new Map<string, { total: number; sponsorises: number }>();
  for (const ligne of affichages) {
    const compte = vues.get(ligne.entrepriseId) ?? { total: 0, sponsorises: 0 };
    const nombre = ligne._sum.nombre ?? 0;
    compte.total += nombre;
    if (ligne.sponsorise) compte.sponsorises += nombre;
    vues.set(ligne.entrepriseId, compte);
  }

  const ouvertures = new Map<string, number>();
  for (const ligne of clics) {
    if (ligne.type !== 'fiche') continue;
    ouvertures.set(
      ligne.entrepriseId,
      (ouvertures.get(ligne.entrepriseId) ?? 0) + (ligne._sum.nombre ?? 0),
    );
  }

  const lignes = entreprises
    .map((entreprise): LigneAudience => {
      const vue = vues.get(entreprise.id) ?? { total: 0, sponsorises: 0 };
      const ouverture = ouvertures.get(entreprise.id) ?? 0;
      return {
        entrepriseId: entreprise.id,
        entreprise: entreprise.nom,
        slug: entreprise.slug,
        formule: entreprise.abonnements[0]?.formule ?? 'gratuit',
        affichages: vue.total,
        affichagesSponsorises: vue.sponsorises,
        ouverturesFiche: ouverture,
        // Pas de taux sans affichage : écrire « 0 % » là où le dénominateur est nul dirait
        // que personne n'a cliqué, alors que rien n'a été montré.
        tauxOuverture: vue.total === 0 ? null : ouverture / vue.total,
      };
    })
    // Les abonnés payants d'abord, et parmi eux ceux qui reçoivent le moins : ce sont les
    // seuls dont l'absence d'audience coûte quelque chose à quelqu'un.
    .sort((a, b) => {
      const paye = (l: LigneAudience) => (l.formule === 'gratuit' ? 1 : 0);
      return paye(a) - paye(b) || a.affichages - b.affichages;
    });

  const clicsParJour = new Map(parJourClics.map((j) => [j.jour, j._sum.nombre ?? 0]));
  const jours = parJourAffichages.map((j): JourAudience => ({
    jour: j.jour,
    affichages: j._sum.nombre ?? 0,
    ouvertures: clicsParJour.get(j.jour) ?? 0,
  }));

  const totalAffichages = lignes.reduce((somme, l) => somme + l.affichages, 0);
  const totalClics = lignes.reduce((somme, l) => somme + l.ouverturesFiche, 0);

  return {
    lignes,
    jours,
    indicateurs: {
      affichages: totalAffichages,
      clics: totalClics,
      tauxOuverture: totalAffichages === 0 ? null : totalClics / totalAffichages,
      joursMesures: jours.length,
      payantsSansAudience: lignes.filter((l) => l.formule !== 'gratuit' && l.affichages === 0)
        .length,
    },
  };
}
