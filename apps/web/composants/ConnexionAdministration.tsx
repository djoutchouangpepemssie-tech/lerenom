'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * La connexion au back-office : adresse, mot de passe, code.
 *
 * Les trois champs sont sur **un seul écran**, et non en deux temps comme on le voit souvent.
 * Un formulaire qui demande d'abord le mot de passe puis le code apprend à qui le teste que
 * le mot de passe était bon — c'est précisément ce qu'on ne veut pas dire. Ici, une seule
 * réponse d'échec couvre les trois champs.
 *
 * Le champ du code accepte les espaces : les applications affichent « 123 456 », et refuser
 * la recopie telle quelle n'ajoute rien à la sécurité.
 */
export function ConnexionAdministration() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function connecte(): Promise<void> {
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/connexion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, motDePasse, code }),
      });
      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(corps.erreur ?? 'Connexion impossible.');
        setCode('');
        return;
      }
      router.replace('/administration');
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  const champ =
    'mt-1 w-full rounded-[8px] border border-[#cfcfc9] bg-white px-3 py-2 text-[0.95rem] outline-none focus:border-[#16181D]';

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void connecte();
      }}
      className="w-full max-w-[22rem]"
    >
      <h1 className="text-xl font-bold">Back-office</h1>
      <p className="mt-1 text-sm text-[#6b6b66]">
        L’accès demande un code à six chiffres, en plus du mot de passe.
      </p>

      <label className="mt-6 block text-sm font-semibold">
        Adresse électronique
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={champ}
        />
      </label>

      <label className="mt-4 block text-sm font-semibold">
        Mot de passe
        <input
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className={champ}
        />
      </label>

      <label className="mt-4 block text-sm font-semibold">
        Code de votre application
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${champ} font-mono tracking-[0.3em]`}
          placeholder="000000"
        />
      </label>

      {refus !== null && (
        <p role="alert" className="mt-4 text-sm font-medium text-[#8c1c1c]">
          {refus}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="mt-6 w-full rounded-[8px] bg-[#16181D] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {enCours ? 'Vérification…' : 'Se connecter'}
      </button>
    </form>
  );
}
