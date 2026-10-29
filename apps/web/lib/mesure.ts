import { prisma } from '@lerenom/db';

/**
 * La mesure de l'audience : affichages et clics.
 *
 * Trois tables existaient depuis le premier jour — `Affichage`, `Clic`, `Appel` — et **aucune
 * n'était jamais écrite**. La conséquence était commerciale avant d'être technique : un
 * professionnel paie 79 € par mois pour une place en haut de page, et rien ne comptait
 * combien de fois cette place lui a été montrée. Impossible de lui rendre compte, impossible
 * de justifier le prix, impossible de voir une zone qui ne rapporte rien à celui qui l'achète.
 *
 * ## Ce qui est enregistré, et ce qui ne l'est pas
 *
 * **Des compteurs par jour, jamais des visiteurs.** Le modèle agrège sur
 * `entreprise × métier × commune × jour` : il n'y a ni identifiant de visiteur, ni adresse IP,
 * ni horodatage à la seconde. On ne peut pas reconstituer le parcours de quelqu'un à partir de
 * ces lignes, et c'est délibéré — mesurer l'audience d'une fiche ne demande pas de suivre les
 * gens.
 *
 * **Les appels ne sont pas mesurés.** Ils supposent des numéros de suivi, donc un opérateur
 * téléphonique, qui n'est pas raccordé (voir `QUESTIONS.md` §Q36). La table reste vide, et
 * l'écran le dit plutôt que d'afficher un zéro qui ressemblerait à une absence d'appels.
 */

export type TypeClic = 'fiche' | 'appel' | 'site_web' | 'whatsapp' | 'devis' | 'mise_en_avant';

export interface AffichageAEnregistrer {
  readonly entrepriseId: string;
  readonly rang: number;
  readonly sponsorise: boolean;
}

function aujourdhui(maintenant = new Date()): string {
  return maintenant.toISOString().slice(0, 10);
}

/**
 * Enregistre les affichages d'une page de résultats.
 *
 * **Une seule requête pour toute la page.** Dix professionnels affichés feraient dix
 * `upsert` Prisma, donc dix allers-retours, sur un chemin que chaque visiteur emprunte. Un
 * `INSERT ... ON CONFLICT DO UPDATE` en une passe fait le même travail en un aller-retour, et
 * l'incrément est atomique — deux visiteurs simultanés comptent pour deux, ce qu'un
 * lire-puis-écrire ne garantit pas.
 *
 * Le rang n'est enregistré que la première fois : il entre dans la clé d'unicité par
 * `sponsorise`, et le mettre à jour à chaque affichage écraserait la rotation des Premium par
 * le dernier rang servi. Ce qui se compte ici est le nombre d'affichages, pas la position du
 * moment.
 */
export async function enregistreLesAffichages(
  metierId: string,
  communeId: string,
  lignes: readonly AffichageAEnregistrer[],
  maintenant = new Date(),
): Promise<void> {
  if (lignes.length === 0) return;
  const jour = aujourdhui(maintenant);

  const valeurs = lignes.map(
    (ligne) =>
      `(gen_random_uuid()::text, '${echappe(ligne.entrepriseId)}', '${echappe(metierId)}', '${echappe(communeId)}', ${ligne.rang}, ${ligne.sponsorise}, '${jour}', 1)`,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO affichages (id, entreprise_id, metier_id, commune_id, rang, sponsorise, jour, nombre)
     VALUES ${valeurs.join(', ')}
     ON CONFLICT (entreprise_id, metier_id, commune_id, sponsorise, jour)
     DO UPDATE SET nombre = affichages.nombre + 1`,
  );
}

/**
 * N'accepte qu'un identifiant, et le prouve.
 *
 * Les valeurs sont interpolées dans le SQL — c'est le prix de l'insertion groupée — donc rien
 * ne doit y entrer qui ne soit un identifiant. Les `cuid` et les codes INSEE ne contiennent
 * que des lettres, des chiffres et des tirets ; tout le reste est refusé net plutôt
 * qu'échappé, parce qu'un échappement qu'on croit correct est une supposition, et un refus
 * n'en est pas une.
 */
function echappe(identifiant: string): string {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(identifiant)) {
    throw new Error(
      `Identifiant inattendu dans la mesure d’audience : ${identifiant.slice(0, 20)}`,
    );
  }
  return identifiant;
}

/**
 * Enregistre un clic.
 *
 * **Deux requêtes au lieu d'un `upsert`, et ce n'est pas un oubli.** La clé d'unicité porte
 * sur `métier` et `commune`, qui peuvent être nuls — un clic depuis la fiche d'une entreprise
 * n'a ni l'un ni l'autre. Or Prisma ne sait pas interroger une clé composée dont un membre
 * est nul : le type lui-même refuse `null`. Forcer une valeur de remplacement (« inconnu »)
 * pour contourner la limite fausserait les comptes par zone, puisqu'une ligne sans zone s'y
 * mélangerait.
 *
 * Le petit risque de ce choix est une course : deux clics simultanés sur la même fiche, le
 * même jour, peuvent créer deux lignes au lieu d'en incrémenter une. Les comptes restent
 * justes à la somme près — c'est ce que l'écran additionne — et la contrainte d'unicité
 * continue de protéger le cas où les deux colonnes sont renseignées.
 */
export async function enregistreUnClic(
  entrepriseId: string,
  type: TypeClic,
  metierId: string | null,
  communeId: string | null,
  maintenant = new Date(),
): Promise<void> {
  const jour = aujourdhui(maintenant);
  const existant = await prisma.clic.findFirst({
    where: { entrepriseId, type, metierId, communeId, jour },
    select: { id: true },
  });

  if (existant === null) {
    await prisma.clic.create({
      data: { entrepriseId, type, metierId, communeId, jour, nombre: 1 },
    });
    return;
  }
  await prisma.clic.update({
    where: { id: existant.id },
    data: { nombre: { increment: 1 } },
  });
}
