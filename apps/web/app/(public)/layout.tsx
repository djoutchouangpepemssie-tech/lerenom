import { EnTete } from '@/composants/EnTete';
import { PiedDePage } from '@/composants/PiedDePage';
import { catalogue, communesLesPlusPeuplees, communesOuvertes, departements } from '@/lib/donnees';
import { nomVille } from '@/lib/affichage';

/**
 * Le socle du site public : en-tête collant avec ses deux méga-menus, et pied de page sombre.
 *
 * Les menus sont construits à partir du catalogue et de la géographie réels : il n'y a aucune
 * liste écrite en dur, donc aucun lien mort quand Arcel ajoute un métier ou ouvre une ville.
 */

/**
 * Tout le site public se rend à l'exécution, et c'est une décision d'infrastructure, pas une
 * préférence de rendu.
 *
 * Le réseau privé de l'hébergeur n'existe qu'à l'exécution : pendant la construction, la base
 * n'est joignable que par un proxy public. Pré-rendre les pages obligerait donc à exposer la
 * base sur Internet et à y faire voyager son mot de passe — pour ne lire que des référentiels
 * que le dépôt contient déjà. Entre une base sans aucune porte publique et quelques
 * millisecondes de rendu, le choix n'est pas difficile.
 *
 * Ce que cela coûte, et qu'il faut dire : les pages ville et métier ne sont plus mises en
 * cache entre deux visiteurs. Les remettre en cache demande des objets de transfert
 * sérialisables — les `Decimal` de Prisma n'en sont pas — et c'est noté dans
 * `docs/QUESTIONS.md` plutôt que bricolé ici.
 */
export const dynamic = 'force-dynamic';
export default async function DispositionPublique({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [cat, deps, ouvertes, peuplees] = await Promise.all([
    catalogue(),
    departements(),
    communesOuvertes(),
    communesLesPlusPeuplees(8),
  ]);

  const universMenu = cat.univers.map((u) => ({
    slug: u.slug,
    nom: u.nom,
    couleur: u.couleur,
    icone: u.icone,
    nombreMetiers: u.metiers.length,
    nombrePrestations: u.metiers.reduce((s, m) => s + m.prestations.length, 0),
    metiers: u.metiers.map((m) => ({ slug: m.slug, nom: m.nom })),
  }));

  const prestationsPhares = cat.univers
    .flatMap((u) => u.metiers.flatMap((m) => m.prestations.map((p) => ({ ...p, metier: m }))))
    .filter((p) => p.tresDemande)
    .slice(0, 7)
    .map((p) => ({
      slug: p.slug,
      nom: p.nom,
      metierSlug: p.metier.slug,
      prixMin: null,
      prixMax: null,
    }));

  return (
    <>
      <EnTete
        univers={universMenu}
        prestationsPhares={prestationsPhares}
        departements={deps.map((d) => ({
          code: d.code,
          nom: d.nom,
          slug: d.slug,
          nombreCommunes: d._count.communes,
        }))}
        villesRecherchees={peuplees.map((c) => ({
          slug: c.slug,
          nom: nomVille(c.nom),
          statut: c.statut,
        }))}
        villesOuvertes={ouvertes.map((c) => ({
          slug: c.slug,
          nom: nomVille(c.nom),
          statut: c.statut,
        }))}
      />
      <main>{children}</main>
      <PiedDePage
        comptes={cat.comptes}
        departements={deps.map((d) => ({ nom: d.nom, slug: d.slug }))}
      />
    </>
  );
}
