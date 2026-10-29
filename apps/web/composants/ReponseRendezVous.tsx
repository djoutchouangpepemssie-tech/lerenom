'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte } from '@lerenom/ui';

/**
 * Accepter ou décliner un rendez-vous proposé.
 *
 * **Accepter demande une confirmation, décliner non.** L'asymétrie est voulue : accepter
 * engage le client à être chez lui, décliner ne l'engage à rien et libère le créneau pour
 * quelqu'un d'autre. Mettre un garde-fou devant le geste sans conséquence ferait hésiter là
 * où il ne faut pas — et un client qui hésite à décliner ne répond pas du tout.
 */
export function ReponseRendezVous({
  jeton,
  repondable,
  raisonRefus,
}: {
  readonly jeton: string;
  readonly repondable: boolean;
  readonly raisonRefus: string | null;
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function repond(accepte: boolean): Promise<void> {
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch(`/api/rendez-vous/${jeton}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accepte }),
      });
      if (reponse.ok) {
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Votre réponse n’a pas pu être enregistrée.');
    } catch {
      setRefus('Nous n’avons pas pu joindre nos serveurs.');
    } finally {
      setEnCours(false);
    }
  }

  if (!repondable) {
    return (
      <Carte className="mt-6 p-5 sm:p-6">
        <p className="text-encre-70 text-sm">
          {raisonRefus ?? 'Ce rendez-vous ne peut plus être modifié en ligne.'}
        </p>
      </Carte>
    );
  }

  return (
    <Carte className="mt-6 p-5 sm:p-6">
      {refus !== null && (
        <p role="alert" className="text-alerte mb-3 text-sm font-semibold">
          {refus}
        </p>
      )}

      {confirme ? (
        <>
          <p className="text-encre text-sm font-bold">Ce créneau vous convient ?</p>
          <p className="text-encre-70 mt-2 text-sm">
            En acceptant, vous vous engagez à être présent. L’entreprise vous enverra un rappel la
            veille.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Bouton aspect="or" onClick={() => void repond(true)} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Oui, je confirme'}
            </Bouton>
            <Bouton aspect="discret" onClick={() => setConfirme(false)} disabled={enCours}>
              Revenir
            </Bouton>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Bouton aspect="or" onClick={() => setConfirme(true)}>
            Ce créneau me convient
          </Bouton>
          <Bouton aspect="discret" onClick={() => void repond(false)} disabled={enCours}>
            Je ne suis pas disponible
          </Bouton>
        </div>
      )}
    </Carte>
  );
}
