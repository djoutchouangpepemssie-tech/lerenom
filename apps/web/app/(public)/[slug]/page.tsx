import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@lerenom/db';
import { PageMetier } from '@/composants/pages/PageMetier';
import { PageVille } from '@/composants/pages/PageVille';
import { PageDepartement } from '@/composants/pages/PageDepartement';
import { aLaVille } from '@/lib/affichage';
import { partage } from '@/lib/referencement';

interface Parametres {
  readonly params: Promise<{ readonly slug: string }>;
}

/**
 * Une seule adresse de premier niveau pour trois sortes de pages : un métier (`/plombier`),
 * une ville (`/montreuil-93100`, `/paris-11`) ou un département (`/seine-saint-denis-93`).
 *
 * Les slugs sont vérifiés uniques à la construction des données : un slug ne peut désigner
 * qu'une seule chose, donc l'ordre de résolution ci-dessous n'arbitre jamais de conflit.
 */
async function resout(slug: string) {
  const [metier, commune, departement] = await Promise.all([
    prisma.metier.findUnique({ where: { slug }, select: { id: true } }),
    prisma.commune.findUnique({ where: { slug }, select: { code: true } }),
    prisma.departement.findUnique({ where: { slug }, select: { code: true } }),
  ]);

  if (metier !== null) return { genre: 'metier' as const };
  if (commune !== null) return { genre: 'ville' as const };
  if (departement !== null) return { genre: 'departement' as const };
  return null;
}

export async function generateMetadata({ params }: Parametres): Promise<Metadata> {
  const { slug } = await params;
  const cible = await resout(slug);
  if (cible === null) return {};

  if (cible.genre === 'metier') {
    const metier = await prisma.metier.findUnique({ where: { slug } });
    if (metier === null) return {};
    const description = `${metier.nom} en Île-de-France : prestations, prix constatés, avis vérifiés et jusqu’à 3 devis gratuits.`;
    return {
      title: metier.nom,
      description,
      ...partage({ titre: metier.nom, description, chemin: `/${slug}` }),
    };
  }

  if (cible.genre === 'ville') {
    const commune = await prisma.commune.findUnique({ where: { slug } });
    if (commune === null) return {};
    const titre = `Artisans et professionnels ${aLaVille(commune.nom)}`;
    const description = `Trouvez un professionnel vérifié ${aLaVille(commune.nom)} : avis, prix constatés et jusqu’à 3 devis gratuits.`;
    return { title: titre, description, ...partage({ titre, description, chemin: `/${slug}` }) };
  }

  const departement = await prisma.departement.findUnique({ where: { slug } });
  if (departement === null) return {};
  const titre = `Professionnels en ${departement.nom}`;
  const description = `Toutes les communes du département ${departement.code} et les professionnels qui y interviennent.`;
  return { title: titre, description, ...partage({ titre, description, chemin: `/${slug}` }) };
}

export default async function PageSlug({ params }: Parametres) {
  const { slug } = await params;
  const cible = await resout(slug);
  if (cible === null) notFound();

  if (cible.genre === 'metier') return <PageMetier slug={slug} />;
  if (cible.genre === 'ville') return <PageVille slug={slug} />;
  return <PageDepartement slug={slug} />;
}
