import type { Metadata } from 'next';
import { prisma } from '@lerenom/db';
import { resoudLienPourLecture } from '@lerenom/liens';
import { DocumentImprimable } from '@/composants/DocumentImprimable';
import { BarreImpression } from '@/composants/BarreImpression';
import { devisAImprimer } from '@/lib/document-a-imprimer';

/**
 * Le devis imprimable, vu par le client, par son lien signé.
 *
 * C'est l'usage principal du document : le client est celui qui garde le devis, le compare,
 * le montre à son conjoint et le ressort six mois plus tard. Le professionnel, lui, l'a déjà
 * dans son espace.
 *
 * **Le lien n'est ni consommé ni refusé une fois consommé.** `resoudLienPourLecture` rend la
 * cible même après signature, et jamais après expiration. Un client qui ouvre son devis pour
 * le relire ne doit pas découvrir, en revenant, qu'il ne peut plus le lire — ni qu'il ne peut
 * plus le signer parce qu'il l'a regardé deux fois.
 *
 * La page ne dit jamais ce qui manque : les mentions à compléter concernent le professionnel,
 * et les afficher au client reviendrait à lui signaler que son artisan est en infraction, ce
 * qui n'est ni notre rôle ni notre information à donner.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre devis',
  robots: { index: false, follow: false, nocache: true },
};

function Impasse({ titre, texte }: { readonly titre: string; readonly texte: string }) {
  return (
    <div className="lr-document mx-auto bg-white text-black">
      <h1 className="font-[family-name:var(--font-titre)] text-2xl">{titre}</h1>
      <p className="mt-3 max-w-[48ch] text-sm leading-relaxed">{texte}</p>
    </div>
  );
}

export default async function PageDevisClientImprimable({
  params,
}: {
  readonly params: Promise<{ readonly jeton: string }>;
}) {
  const { jeton } = await params;
  const resolution = await resoudLienPourLecture(jeton);

  if (resolution.issue !== 'valide') {
    return (
      <Impasse
        titre="Ce lien n’est plus actif"
        texte="Ouvrez-le depuis le message reçu plutôt que de le retaper, ou contactez l’entreprise : elle vous en renverra un."
      />
    );
  }
  if (resolution.lien.action !== 'signer_devis' || resolution.lien.cibleId === null) {
    return (
      <Impasse
        titre="Ce lien n’ouvre pas un devis"
        texte="Vérifiez le message dont vous l’avez tiré."
      />
    );
  }

  // Le lien désigne un devis, pas une entreprise : on retrouve la sienne pour que
  // `devisAImprimer` applique le même filtre que partout ailleurs, plutôt que d'ouvrir une
  // seconde voie d'accès sans contrôle de propriétaire.
  const appartenance = await prisma.devis.findUnique({
    where: { id: resolution.lien.cibleId },
    select: { entrepriseId: true },
  });
  const document =
    appartenance === null
      ? null
      : await devisAImprimer(appartenance.entrepriseId, resolution.lien.cibleId);

  if (document === null) {
    return (
      <Impasse
        titre="Ce devis n’existe plus"
        texte="Contactez l’entreprise : elle vous en établira un autre."
      />
    );
  }

  return (
    <>
      <BarreImpression retour={`/devis/${jeton}`} manquants={[]} emise />
      <DocumentImprimable document={document} />
    </>
  );
}
