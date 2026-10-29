import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfessionnelsAdministration } from '@/composants/ProfessionnelsAdministration';
import { etatProfessionnels, type FileProfessionnels } from '@/lib/administration-professionnels';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Les professionnels.
 *
 * L'écran qui débloque l'inscription : une entreprise naît non vérifiée, et une fiche non
 * vérifiée ne reçoit **aucune** demande. Sans cet écran, un artisan pouvait s'inscrire,
 * remplir sa fiche, choisir ses zones — et attendre indéfiniment.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Professionnels',
  robots: { index: false, follow: false, nocache: true },
};

const FILES = new Set<string>(['a-verifier', 'actives', 'ecartees']);

export default async function PageProfessionnels({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly file?: string; readonly q?: string }>;
}) {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const parametres = await searchParams;
  const file: FileProfessionnels = FILES.has(parametres.file ?? '')
    ? (parametres.file as FileProfessionnels)
    : 'a-verifier';
  const recherche = parametres.q ?? '';

  const etat = await etatProfessionnels(file, recherche);

  return (
    <>
      <h1 className="text-2xl font-bold">Professionnels</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        Une fiche revendiquée reste <strong>hors distribution</strong> jusqu’à ce qu’un humain l’ait
        vérifiée : elle apparaît dans l’annuaire, mais ne reçoit aucune demande. C’est la
        contrepartie de la revendication libre — n’importe qui peut réclamer une fiche, personne ne
        reçoit de client avant qu’on ait regardé.
      </p>

      <ProfessionnelsAdministration etat={etat} file={file} recherche={recherche} />
    </>
  );
}
