import type { Metadata } from 'next';
import { Carte, Conteneur, Section } from '@lerenom/ui';
import { LIBELLES_UNITE, formatEuros } from '@lerenom/core';
import { resoudLien } from '@lerenom/liens';
import { AccepterDevis } from '@/composants/AccepterDevis';
import { devisPourClient } from '@/lib/devis-client';
import { dateSeule, telephoneLisible } from '@/lib/affichage';

/**
 * Le devis, vu par le client qui le reçoit.
 *
 * Il n'a pas de compte : ce lien est sa seule clé, et cette page est tout ce qu'il a. Elle
 * doit donc porter le document **entier** — les lignes, les totaux, les mentions
 * obligatoires, et qui l'engage — et pas un résumé qui l'obligerait à réclamer le reste.
 *
 * Jamais indexée, jamais mise en cache : c'est le devis d'une personne.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre devis',
  robots: { index: false, follow: false, nocache: true },
};

/** Les écrans d'échec. Avares : ils ne disent jamais si un devis existe. */
function Impasse({ titre, texte }: { readonly titre: string; readonly texte: string }) {
  return (
    <Section fond="creme" className="py-16">
      <Conteneur>
        <Carte className="mx-auto max-w-[36rem] p-7 text-center">
          <h1 className="text-2xl">{titre}</h1>
          <p className="text-encre-70 mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed">{texte}</p>
          <p className="text-encre-55 mt-6 text-sm">
            Pour toute question, répondez au message reçu : l’entreprise vous répond.
          </p>
        </Carte>
      </Conteneur>
    </Section>
  );
}

export default async function PageDevisClient({
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
        texte="Il a peut-être été recopié partiellement. Ouvrez-le depuis le message reçu plutôt que de le retaper."
      />
    );
  }
  if (resolution.issue === 'expire' || resolution.issue === 'deja-utilise') {
    return (
      <Impasse
        titre="Ce lien n’est plus actif"
        texte="Demandez à l’entreprise de vous adresser à nouveau le devis : elle le fera en un clic."
      />
    );
  }
  if (resolution.lien.action !== 'signer_devis' || resolution.lien.cibleId === null) {
    return (
      <Impasse
        titre="Ce lien n’ouvre pas un devis"
        texte="Il porte autre chose. Vérifiez le message dont vous l’avez tiré."
      />
    );
  }

  const devis = await devisPourClient(resolution.lien.cibleId);
  if (devis === null) {
    return (
      <Impasse
        titre="Ce devis n’est plus disponible"
        texte="Demandez à l’entreprise de vous en adresser un nouveau."
      />
    );
  }

  return (
    <Section fond="creme" className="py-10 sm:py-14">
      <Conteneur>
        <div className="mx-auto max-w-[46rem]">
          <p className="text-encre-55 text-sm font-semibold">{devis.entreprise.nom}</p>
          <h1 className="mt-2 text-[clamp(1.7rem,4vw,2.4rem)]">Devis {devis.numero ?? ''}</h1>
          <p className="text-encre-70 mt-2">
            {devis.type === 'estimatif'
              ? 'Estimatif : les quantités réellement posées peuvent faire varier le total.'
              : 'Ferme et définitif : le total ne bougera pas.'}
            {devis.expireLe !== null && ` Valable jusqu’au ${dateSeule(devis.expireLe)}.`}
          </p>

          <Carte className="mt-7 p-5 sm:p-6">
            {devis.clientNom !== null && (
              <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                Pour {devis.clientNom}
              </p>
            )}

            <ul className="border-bordure mt-5 divide-y divide-[var(--color-bordure)] border-t border-b">
              {devis.lignes.map((ligne) => (
                <li
                  key={ligne.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <span
                    className={
                      ligne.type === 'section'
                        ? 'text-encre w-full font-bold'
                        : 'text-encre min-w-0 flex-1 text-sm'
                    }
                  >
                    {ligne.designation}
                    {ligne.detail !== undefined && (
                      <span className="text-encre-55 block text-xs">{ligne.detail}</span>
                    )}
                  </span>
                  {ligne.quantite !== undefined && ligne.prixUnitaireHT !== undefined && (
                    <span className="text-encre-70 shrink-0 text-sm">
                      {ligne.quantite}{' '}
                      {ligne.unite === undefined ? '' : LIBELLES_UNITE[ligne.unite]} ×{' '}
                      {formatEuros(ligne.prixUnitaireHT)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-encre-55">Total hors taxes</dt>
                <dd className="text-encre font-semibold">{formatEuros(devis.totaux.totalHT)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-encre-55">TVA</dt>
                <dd className="text-encre font-semibold">{formatEuros(devis.totaux.totalTVA)}</dd>
              </div>
              <div className="border-bordure flex justify-between gap-3 border-t pt-3">
                <dt className="text-encre font-bold">Total à payer</dt>
                <dd className="text-encre font-[family-name:var(--font-titre)] text-2xl">
                  {formatEuros(devis.totaux.totalTTC)}
                </dd>
              </div>
              {devis.acomptePourcent > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-encre-55">
                    Acompte à la signature · {devis.acomptePourcent} %
                  </dt>
                  <dd className="text-encre font-semibold">{formatEuros(devis.acompteTTC)}</dd>
                </div>
              )}
            </dl>
          </Carte>

          <AccepterDevis
            jeton={jeton}
            acceptable={devis.acceptable}
            raisonRefus={devis.raisonRefus}
            acompteTTC={devis.acomptePourcent > 0 ? devis.acompteTTC : null}
          />

          <Carte className="mt-6 p-5 sm:p-6">
            <p className="text-encre text-sm font-bold">Qui s’engage</p>
            <p className="text-encre mt-2 text-sm font-semibold">{devis.entreprise.nom}</p>
            {devis.entreprise.adresse !== null && (
              <p className="text-encre-70 mt-1 text-sm">{devis.entreprise.adresse}</p>
            )}
            {devis.entreprise.siret !== null && (
              <p className="text-encre-55 mt-1 font-mono text-xs">SIRET {devis.entreprise.siret}</p>
            )}
            {(devis.entreprise.telephone !== null || devis.entreprise.email !== null) && (
              <p className="text-encre-70 mt-2 text-sm">
                {[
                  // La base garde la forme internationale, qui sert à appeler ; personne ne
                  // lit « +33199000010 », et un devis se lit.
                  devis.entreprise.telephone === null
                    ? null
                    : telephoneLisible(devis.entreprise.telephone),
                  devis.entreprise.email,
                ]
                  .filter((valeur) => valeur !== null)
                  .join(' · ')}
              </p>
            )}

            <ul className="text-encre-55 mt-4 space-y-1 text-xs">
              <li>
                {devis.devisPayant
                  ? 'L’établissement de ce devis est payant ; son coût est déduit en cas d’acceptation.'
                  : 'L’établissement de ce devis est gratuit.'}
              </li>
              <li>
                {devis.piecesRemplaceesGardees
                  ? 'Les pièces remplacées restent à votre disposition.'
                  : 'Les pièces remplacées ne sont pas conservées.'}
              </li>
              {devis.mentionRetractation && (
                <li>
                  Vous disposez d’un délai de rétractation de quatorze jours, sauf exécution
                  immédiate demandée par vos soins.
                </li>
              )}
            </ul>
          </Carte>
        </div>
      </Conteneur>
    </Section>
  );
}
