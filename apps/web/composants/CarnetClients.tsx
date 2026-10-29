'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientDuPro } from '@/lib/clients-pro';

/**
 * Le carnet de clients.
 *
 * **Le nom suffit pour enregistrer.** Un artisan qui prépare un devis sur un chantier n'a pas
 * toujours l'adresse ; la lui réclamer tout de suite le ferait renoncer au devis, pas chercher
 * l'adresse. L'écran signale en revanche les fiches incomplètes, parce que l'adresse
 * redeviendra obligatoire au moment d'émettre la facture — et que le découvrir à ce
 * moment-là, quand la facture est prête, est une mauvaise surprise.
 *
 * **Aucune suppression.** Un client porte des factures émises : l'effacer laisserait une
 * facture numérotée sans destinataire.
 */

const VIDE = {
  nom: '',
  email: '',
  telephone: '',
  adresse: '',
  codePostal: '',
  ville: '',
  professionnel: false,
  siren: '',
};

type Saisie = typeof VIDE;

export function CarnetClients({ clients }: { readonly clients: readonly ClientDuPro[] }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [modifie, setModifie] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  function ouvre(client?: ClientDuPro): void {
    setRefus(null);
    if (client === undefined) {
      setModifie(null);
      setSaisie({ ...VIDE });
      return;
    }
    setModifie(client.id);
    setSaisie({
      nom: client.nom,
      email: client.email ?? '',
      telephone: client.telephone ?? '',
      adresse: client.adresse ?? '',
      codePostal: client.codePostal ?? '',
      ville: client.ville ?? '',
      professionnel: client.professionnel,
      siren: client.siren ?? '',
    });
  }

  async function enregistre(): Promise<void> {
    if (saisie === null) return;
    setOccupe(true);
    setRefus(null);
    try {
      const reponse = await fetch('/api/pro/clients', {
        method: modifie === null ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(modifie === null ? saisie : { ...saisie, id: modifie }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Enregistrement impossible.');
        return;
      }
      setSaisie(null);
      setModifie(null);
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setOccupe(false);
    }
  }

  const bouton =
    'rounded-[8px] border border-[#cfcfc9] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';
  const champ =
    'mt-1 w-full rounded-[6px] border border-[#cfcfc9] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#16181D]';

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
          onClick={() => ouvre()}
        >
          Ajouter un client
        </button>
        <p className="text-encre-70 text-sm">
          {clients.length === 0
            ? 'Votre carnet est vide : un devis a besoin d’un client pour devenir une facture.'
            : `${clients.length} client${clients.length > 1 ? 's' : ''} dans votre carnet.`}
        </p>
      </div>

      {refus !== null && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#8c1c1c]">
          {refus}
        </p>
      )}

      {saisie !== null && (
        <div className="mt-4 rounded-[12px] border border-[#dcdcd8] bg-white p-4">
          <h2 className="font-semibold">
            {modifie === null ? 'Nouveau client' : 'Modifier ce client'}
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[0.8rem] font-semibold sm:col-span-2">
              Nom ou raison sociale *
              <input
                className={champ}
                value={saisie.nom}
                onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
              />
            </label>
            <label className="text-[0.8rem] font-semibold">
              Adresse électronique
              <input
                type="email"
                className={champ}
                value={saisie.email}
                onChange={(e) => setSaisie({ ...saisie, email: e.target.value })}
              />
            </label>
            <label className="text-[0.8rem] font-semibold">
              Téléphone
              <input
                className={champ}
                value={saisie.telephone}
                onChange={(e) => setSaisie({ ...saisie, telephone: e.target.value })}
              />
            </label>
            <label className="text-[0.8rem] font-semibold sm:col-span-2">
              Adresse
              <input
                className={champ}
                value={saisie.adresse}
                onChange={(e) => setSaisie({ ...saisie, adresse: e.target.value })}
              />
            </label>
            <label className="text-[0.8rem] font-semibold">
              Code postal
              <input
                inputMode="numeric"
                className={champ}
                value={saisie.codePostal}
                onChange={(e) => setSaisie({ ...saisie, codePostal: e.target.value })}
              />
            </label>
            <label className="text-[0.8rem] font-semibold">
              Ville
              <input
                className={champ}
                value={saisie.ville}
                onChange={(e) => setSaisie({ ...saisie, ville: e.target.value })}
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-[0.82rem] font-semibold">
            <input
              type="checkbox"
              className="size-4"
              checked={saisie.professionnel}
              onChange={(e) => setSaisie({ ...saisie, professionnel: e.target.checked })}
            />
            Ce client est un professionnel
          </label>

          {saisie.professionnel && (
            <label className="mt-2 block text-[0.8rem] font-semibold sm:w-60">
              SIREN *
              <input
                inputMode="numeric"
                className={champ}
                value={saisie.siren}
                onChange={(e) => setSaisie({ ...saisie, siren: e.target.value })}
              />
              <span className="text-encre-70 mt-1 block text-[0.75rem] font-normal">
                Obligatoire entre professionnels : il figure sur la facture, et son absence la rend
                incomplète.
              </span>
            </label>
          )}

          <p className="text-encre-70 mt-3 text-[0.78rem] leading-relaxed">
            Seul le nom est exigé maintenant. L’adresse le deviendra au moment d’émettre une facture
            — mieux vaut la renseigner tant que vous l’avez sous la main.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={occupe || saisie.nom.trim() === ''}
              className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
              onClick={() => void enregistre()}
            >
              Enregistrer
            </button>
            <button type="button" className={bouton} onClick={() => setSaisie(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {clients.map((client) => (
          <article key={client.id} className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                  {client.nom}
                  {client.professionnel && (
                    <span className="rounded-[4px] bg-[#eceae6] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#5c5c56]">
                      professionnel
                    </span>
                  )}
                  {client.adresseIncomplete && (
                    <span className="rounded-[4px] bg-[#fdf0e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8a5a16]">
                      adresse incomplète
                    </span>
                  )}
                </h2>
                <p className="text-encre-70 mt-1 text-[0.8rem]">
                  {[client.adresse, [client.codePostal, client.ville].filter(Boolean).join(' ')]
                    .filter((part) => part !== null && part !== '')
                    .join(', ') || 'Aucune adresse'}
                  {client.siren !== null && ` · SIREN ${client.siren}`}
                </p>
                <p className="text-encre-70 mt-1 text-[0.78rem]">
                  {client.devis} devis · {client.factures} facture
                  {client.factures > 1 ? 's' : ''}
                  {client.adresseIncomplete && (
                    <span className="text-[#8a5a16]">
                      {' '}
                      · une facture ne pourra pas être émise sans adresse
                    </span>
                  )}
                </p>
              </div>
              <button type="button" className={bouton} onClick={() => ouvre(client)}>
                Modifier
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
