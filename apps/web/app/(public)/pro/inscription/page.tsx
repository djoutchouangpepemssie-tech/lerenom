import { prisma } from '@lerenom/db';
import { FormulaireInscription } from '@/composants/FormulaireInscription';

export const metadata = {
  title: 'Créer ou revendiquer ma fiche',
  description:
    'Référencez votre entreprise sur Le Renom : métiers, villes, fiche et formule. Votre fiche de base est gratuite.',
};

export default async function PageInscription() {
  const [univers, departements] = await Promise.all([
    prisma.univers.findMany({
      where: { masque: false },
      orderBy: { rang: 'asc' },
      include: {
        metiers: {
          where: { masque: false },
          orderBy: { rang: 'asc' },
          include: { prestations: { where: { masque: false }, orderBy: { rang: 'asc' } } },
        },
      },
    }),
    prisma.departement.findMany({
      orderBy: { code: 'asc' },
      include: {
        communes: {
          orderBy: [{ statut: 'asc' }, { population: 'desc' }],
          select: { code: true, nom: true, statut: true, population: true, codesPostaux: true },
        },
      },
    }),
  ]);

  return (
    <FormulaireInscription
      univers={univers.map((u) => ({
        slug: u.slug,
        nom: u.nom,
        couleur: u.couleur,
        icone: u.icone,
        metiers: u.metiers.map((m) => ({
          slug: m.slug,
          nom: m.nom,
          prestations: m.prestations.map((p) => ({ slug: p.slug, nom: p.nom })),
        })),
      }))}
      departements={departements.map((d) => ({
        code: d.code,
        nom: d.nom,
        communes: d.communes.map((c) => ({
          code: c.code,
          nom: c.nom.replace(/\s+Arrondissement$/i, ''),
          statut: c.statut,
          population: c.population,
          codePostal: c.codesPostaux[0] ?? null,
        })),
      }))}
    />
  );
}
