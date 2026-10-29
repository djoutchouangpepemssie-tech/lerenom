import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConfianceAdministration } from '@/composants/ConfianceAdministration';
import { etatConfiance } from '@/lib/administration-confiance';
import { adminConnecte } from '@/lib/session-admin';

/**
 * La confiance.
 *
 * L'écran qui débloque les avis : jusqu'ici, un client pouvait en déposer un, il était bien
 * enregistré, et personne ne pouvait le publier. Du point de vue du client comme du
 * professionnel, la fonctionnalité n'existait pas.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confiance',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageConfiance() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatConfiance();
  const { indicateurs } = etat;

  const cartes = [
    {
      cle: 'avis',
      libelle: 'Avis à relire',
      valeur: indicateurs.avis,
      explication:
        indicateurs.avis === 0
          ? 'Rien n’attend. Les clients qui ont écrit ont été lus.'
          : 'Chacun est un client qui a écrit et un professionnel dont la note ne bouge pas.',
      alerte: indicateurs.avis > 0,
    },
    {
      cle: 'contestations',
      libelle: 'Contestations',
      valeur: indicateurs.contestations,
      explication: 'Un professionnel conteste une demande facturée. Le Renom a 48 heures.',
      alerte: false,
    },
    {
      cle: 'retard',
      libelle: 'Hors délai',
      valeur: indicateurs.contestationsEnRetard,
      explication:
        indicateurs.contestationsEnRetard === 0
          ? 'Aucune contestation n’a dépassé ses 48 heures.'
          : 'Les 48 heures sont passées. Le professionnel attend une réponse qu’on lui a promise.',
      alerte: indicateurs.contestationsEnRetard > 0,
    },
    {
      cle: 'signalements',
      libelle: 'Signalements',
      valeur: indicateurs.signalements,
      explication: 'Contenus signalés au titre du DSA : fiche, photo, texte.',
      alerte: indicateurs.signalements > 0,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Confiance</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        Publier un avis, c’est afficher le jugement d’un client sur le travail de quelqu’un et faire
        bouger la note qui le classe. Le refuser, c’est écarter la parole d’un client. Les deux se
        font ici, un avis à la fois, et chacun laisse une trace.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartes.map((carte) => (
          <div
            key={carte.cle}
            className={`rounded-[12px] border bg-white p-4 ${
              carte.alerte ? 'border-[#e4c9c9]' : 'border-[#dcdcd8]'
            }`}
          >
            <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
              {carte.libelle}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums ${
                carte.alerte ? 'text-[#8c1c1c]' : 'text-[#16181D]'
              }`}
            >
              {carte.valeur.toLocaleString('fr-FR')}
            </p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
              {carte.explication}
            </p>
          </div>
        ))}
      </div>

      <ConfianceAdministration etat={etat} />
    </>
  );
}
