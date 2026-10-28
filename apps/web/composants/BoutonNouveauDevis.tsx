'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton } from '@lerenom/ui';

/**
 * Le bouton qui ouvre un nouveau devis.
 *
 * Il crée le brouillon côté serveur avant de naviguer : un devis a besoin d'exister pour
 * qu'on puisse y enregistrer des lignes, et un éditeur ouvert sur rien n'aurait nulle part
 * où sauvegarder.
 */
export function BoutonNouveauDevis() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function ouvre(): Promise<void> {
    setEnCours(true);
    try {
      const reponse = await fetch('/api/pro/devis', { method: 'POST' });
      if (!reponse.ok) return;
      const corps = (await reponse.json()) as { id: string };
      router.push(`/pro/espace/devis/${corps.id}`);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Bouton aspect="or" onClick={() => void ouvre()} disabled={enCours}>
      {enCours ? 'Ouverture…' : 'Nouveau devis'}
    </Bouton>
  );
}
