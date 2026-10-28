'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bouton, Carte, Champ } from '@lerenom/ui';

/**
 * La connexion d'un professionnel.
 *
 * Le message d'échec est volontairement unique et vague : « adresse ou mot de passe
 * incorrect ». Dire « cette adresse est inconnue » donnerait à n'importe qui le moyen de
 * savoir quels artisans sont inscrits sur Le Renom — ce qui ne regarde personne.
 */
export function FormulaireConnexion() {
  const routeur = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function connecte() {
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch('/api/pro/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), motDePasse }),
      });

      const brut: unknown = await reponse.json();
      const donnees = brut as { connecte?: boolean; erreur?: string };

      if (!reponse.ok || donnees.connecte !== true) {
        setErreur(donnees.erreur ?? 'Connexion impossible.');
        return;
      }

      routeur.push('/pro/espace');
      routeur.refresh();
    } catch {
      setErreur('Connexion impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Carte className="mx-auto max-w-[26rem] p-6 md:p-7">
      <h1 className="text-2xl">Votre espace professionnel</h1>
      <p className="text-encre-70 mt-2 text-sm">Vos demandes, votre fiche, vos statistiques.</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void connecte();
        }}
      >
        <Champ
          etiquette="Adresse électronique"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Champ
          etiquette="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
        />

        {erreur !== null && (
          <p
            role="alert"
            className="bg-erreur-fond text-erreur rounded-[var(--radius-douce)] px-4 py-3 text-sm"
          >
            {erreur}
          </p>
        )}

        <Bouton aspect="or" taille="grand" type="submit" chargement={envoi} pleineLargeur>
          Se connecter
        </Bouton>
      </form>

      <p className="text-encre-55 border-bordure mt-6 border-t pt-5 text-sm">
        Pas encore inscrit ?{' '}
        <Link href="/pro/inscription" className="text-encre underline">
          Créer ou revendiquer ma fiche
        </Link>
      </p>
    </Carte>
  );
}
