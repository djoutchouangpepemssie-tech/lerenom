import type { Metadata } from 'next';
import { Carte, Conteneur, Section } from '@lerenom/ui';
import { heureDe } from '@lerenom/core';
import { resoudLien } from '@lerenom/liens';
import { ReponseRendezVous } from '@/composants/ReponseRendezVous';
import { rendezVousPourClient } from '@/lib/rendez-vous-client';
import { telephoneLisible } from '@/lib/affichage';

/**
 * Le rendez-vous proposé, vu par le client.
 *
 * Une seule question, deux réponses possibles, et de quoi joindre l'entreprise si aucune des
 * deux ne convient. Un client qui reçoit un SMS et ouvre ce lien doit pouvoir répondre en
 * trois secondes, debout.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre rendez-vous',
  robots: { index: false, follow: false, nocache: true },
};

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function jourLisible(date: Date): string {
  const quantieme = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${JOURS[date.getDay()] ?? ''} ${quantieme} ${MOIS[date.getMonth()] ?? ''}`;
}

/** Les écrans d'échec. Avares : ils ne disent jamais si un rendez-vous existe. */
function Impasse({ titre, texte }: { readonly titre: string; readonly texte: string }) {
  return (
    <Section fond="creme" className="py-16">
      <Conteneur>
        <Carte className="mx-auto max-w-[36rem] p-7 text-center">
          <h1 className="text-2xl">{titre}</h1>
          <p className="text-encre-70 mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed">{texte}</p>
        </Carte>
      </Conteneur>
    </Section>
  );
}

export default async function PageRendezVous({
  params,
}: {
  readonly params: Promise<{ readonly jeton: string }>;
}) {
  const { jeton } = await params;
  const resolution = await resoudLien(jeton);

  if (resolution.issue === 'inconnu') {
    return (
      <Impasse
        titre="Ce lien n’est pas valide"
        texte="Ouvrez-le depuis le message reçu plutôt que de le retaper."
      />
    );
  }
  if (resolution.issue === 'expire' || resolution.issue === 'deja-utilise') {
    return (
      <Impasse
        titre="Ce lien n’est plus actif"
        texte="Vous y avez peut-être déjà répondu. Contactez l’entreprise si vous avez un doute."
      />
    );
  }
  if (resolution.lien.action !== 'choisir_creneau' || resolution.lien.cibleId === null) {
    return (
      <Impasse
        titre="Ce lien n’ouvre pas un rendez-vous"
        texte="Vérifiez le message dont vous l’avez tiré."
      />
    );
  }

  const rendezVous = await rendezVousPourClient(resolution.lien.cibleId);
  if (rendezVous === null) {
    return (
      <Impasse
        titre="Ce rendez-vous n’existe plus"
        texte="Contactez l’entreprise : elle vous proposera une autre date."
      />
    );
  }

  return (
    <Section fond="creme" className="py-10 sm:py-14">
      <Conteneur>
        <div className="mx-auto max-w-[36rem]">
          <p className="text-encre-55 text-sm font-semibold">{rendezVous.entrepriseNom}</p>
          <h1 className="mt-2 text-[clamp(1.7rem,4vw,2.4rem)]">
            {rendezVous.statut === 'confirme'
              ? 'Votre rendez-vous est confirmé'
              : 'Proposition de rendez-vous'}
          </h1>

          <Carte className="mt-7 p-5 sm:p-6">
            <p className="text-encre font-[family-name:var(--font-titre)] text-2xl">
              {jourLisible(rendezVous.debut)}
            </p>
            <p className="text-encre-70 mt-1">
              de {heureDe(rendezVous.debut)} à {heureDe(rendezVous.fin)}
            </p>
            {rendezVous.expireLe !== null && rendezVous.repondable && (
              <p className="text-encre-55 mt-4 text-sm">
                {rendezVous.expireLe.getTime() >= rendezVous.debut.getTime()
                  ? // L'échéance ne dépasse jamais le début du créneau : quand les deux
                    // coïncident, annoncer une date reviendrait à répéter celle du
                    // rendez-vous, ce qui se lit mal.
                    'Répondez avant le début du rendez-vous, sans quoi le créneau sera remis à disposition.'
                  : `Sans réponse de votre part, ce créneau sera remis à disposition le ${jourLisible(rendezVous.expireLe)}.`}
              </p>
            )}
          </Carte>

          <ReponseRendezVous
            jeton={jeton}
            repondable={rendezVous.repondable}
            raisonRefus={rendezVous.raisonRefus}
          />

          <Carte className="mt-6 p-5 sm:p-6">
            <p className="text-encre text-sm font-bold">Aucune des deux réponses ne convient ?</p>
            <p className="text-encre-70 mt-2 text-sm">
              Déclinez, puis appelez {rendezVous.entrepriseNom}
              {rendezVous.entrepriseTelephone !== null &&
                ` au ${telephoneLisible(rendezVous.entrepriseTelephone)}`}{' '}
              : le créneau sera libéré et vous en conviendrez d’un autre de vive voix.
            </p>
          </Carte>
        </div>
      </Conteneur>
    </Section>
  );
}
