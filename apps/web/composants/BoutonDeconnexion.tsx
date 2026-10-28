'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bouton } from '@lerenom/ui';

/** La déconnexion. La session est révoquée en base, pas seulement oubliée par le navigateur. */
export function BoutonDeconnexion({ nom }: { readonly nom: string }) {
  const routeur = useRouter();
  const [envoi, setEnvoi] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span className="text-encre-55 hidden text-sm md:inline">{nom}</span>
      <Bouton
        aspect="discret"
        taille="petit"
        chargement={envoi}
        onClick={() => {
          setEnvoi(true);
          void fetch('/api/pro/deconnexion', { method: 'POST' }).then(() => {
            routeur.push('/pro/connexion');
            routeur.refresh();
          });
        }}
      >
        Se déconnecter
      </Bouton>
    </div>
  );
}
