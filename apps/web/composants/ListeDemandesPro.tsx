'use client';

import { useRouter } from 'next/navigation';
import { Carte, Onglets } from '@lerenom/ui';
import { CarteDemandePro } from '@/composants/CarteDemandePro';
import type { DemandeAcceptee, DemandeEnAttente } from '@/lib/espace-pro';

/**
 * La boîte de réception d'un professionnel.
 *
 * Deux listes, pas une : ce qui attend une réponse — avec son minuteur — et ce qui a été
 * accepté, avec les coordonnées. Les mélanger ferait perdre de vue l'urgent.
 */
export function ListeDemandesPro({
  enAttente,
  acceptees,
}: {
  readonly enAttente: readonly DemandeEnAttente[];
  readonly acceptees: readonly DemandeAcceptee[];
}) {
  const routeur = useRouter();
  const rafraichit = () => routeur.refresh();

  return (
    <Onglets
      etiquette="Vos demandes"
      onglets={[
        {
          cle: 'attente',
          libelle: 'À répondre',
          compte: enAttente.length,
          contenu:
            enAttente.length === 0 ? (
              <Vide
                titre="Aucune demande en attente"
                texte="Dès qu’une demande correspond à vos métiers et à vos zones, elle apparaît ici et vous recevez un SMS."
              />
            ) : (
              <div className="space-y-4">
                {enAttente.map((demande) => (
                  <CarteDemandePro
                    key={demande.distributionId}
                    demande={demande}
                    acceptee={false}
                    surChangement={rafraichit}
                  />
                ))}
              </div>
            ),
        },
        {
          cle: 'acceptees',
          libelle: 'Acceptées',
          compte: acceptees.length,
          contenu:
            acceptees.length === 0 ? (
              <Vide
                titre="Aucune demande acceptée pour l’instant"
                texte="Les coordonnées de vos clients apparaîtront ici, dès votre première acceptation."
              />
            ) : (
              <div className="space-y-4">
                {acceptees.map((demande) => (
                  <CarteDemandePro
                    key={demande.distributionId}
                    demande={demande}
                    acceptee
                    surChangement={rafraichit}
                  />
                ))}
              </div>
            ),
        },
      ]}
    />
  );
}

function Vide({ titre, texte }: { readonly titre: string; readonly texte: string }) {
  return (
    <Carte className="p-8 text-center">
      <p className="font-bold">{titre}</p>
      <p className="text-encre-70 mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed">{texte}</p>
    </Carte>
  );
}
