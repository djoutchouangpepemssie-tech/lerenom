import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CatalogueAdministration } from '@/composants/CatalogueAdministration';
import { etatCatalogue } from '@/lib/administration-catalogue';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Le catalogue : dix-huit univers, soixante-neuf métiers, quatre cent soixante-dix-neuf
 * prestations, tous reconstruits faute des fichiers d'origine (`QUESTIONS.md` §Q1).
 *
 * C'est le module qui lève le plus de décisions en attente, et c'est pour cela qu'il vient en
 * premier après l'accueil : tant que personne n'a relu ces lignes, le site propose des métiers
 * que personne n'a confirmés.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Catalogue',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageCatalogue() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatCatalogue();
  const total = etat.aValider.univers + etat.aValider.metiers + etat.aValider.prestations;

  return (
    <>
      <h1 className="text-2xl font-bold">Catalogue</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        {total === 0 ? (
          <>Tout est relu. Les corrections restent possibles : décochez le filtre pour les voir.</>
        ) : (
          <>
            <strong>{total.toLocaleString('fr-FR')} lignes attendent une relecture.</strong> Le
            catalogue a été reconstruit à partir du cahier des charges, faute des fichiers annoncés
            : rien de ce qu’il contient n’a encore été confirmé par vous, et le site s’en sert déjà.
          </>
        )}
      </p>
      <p className="mt-2 max-w-[72ch] text-[0.8rem] leading-relaxed text-[#6b6b66]">
        L’identifiant d’adresse ne se modifie pas : il vit dans des pages déjà indexées, et le
        changer casserait des liens sans prévenir. Masquer n’efface rien — demandes passées et
        professionnels rattachés restent en place.
      </p>

      <CatalogueAdministration etat={etat} />
    </>
  );
}
