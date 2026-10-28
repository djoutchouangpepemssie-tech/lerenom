'use client';

import { useState } from 'react';
import { ConfirmationIntervention } from '@/composants/ConfirmationIntervention';
import { FormulaireAvis } from '@/composants/FormulaireAvis';

/**
 * La confirmation d'intervention et le dépôt d'avis, enchaînés.
 *
 * Le client qui vient de dire « oui, l'intervention a eu lieu » est là, devant son écran, et
 * il se souvient. Lui envoyer un second message pour lui demander son avis serait un message
 * de trop : on lui propose le formulaire tout de suite, sur la même page.
 *
 * Il reste libre de ne rien écrire : sa confirmation est déjà enregistrée.
 */
export function ParcoursIntervention({
  jeton,
  nomPro,
  villePro,
  reference,
  prenom,
}: {
  readonly jeton: string;
  readonly nomPro: string;
  readonly villePro: string | null;
  readonly reference: string;
  readonly prenom: string;
}) {
  const [jetonAvis, setJetonAvis] = useState<string | null>(null);

  if (jetonAvis !== null) {
    return (
      <FormulaireAvis
        jeton={jetonAvis}
        reference={reference}
        prenom={prenom}
        cible={{ nom: nomPro, ville: villePro }}
      />
    );
  }

  return (
    <ConfirmationIntervention
      jeton={jeton}
      nomPro={nomPro}
      reference={reference}
      surConfirmation={setJetonAvis}
    />
  );
}
