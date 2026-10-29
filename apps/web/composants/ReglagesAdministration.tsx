'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EtatReglages,
  LigneJournal,
  ReglageExploitation,
} from '@/lib/administration-reglages';

/**
 * Les réglages, à manier avec la main qui tremble un peu.
 *
 * **Un réglage ne se change pas en tapant dans un champ puis en passant au suivant.** Chacun
 * s'ouvre, montre sa valeur en vigueur, ses bornes, et demande un motif avant que le bouton
 * s'active. Ce n'est pas de la cérémonie : changer le délai de réponse modifie les revenus de
 * toutes les entreprises inscrites, et l'écran doit peser ce que pèse le geste.
 *
 * **La valeur par défaut est affichée à côté de la valeur en vigueur**, toujours. Sans elle,
 * on ne sait pas si 120 minutes est un choix ou un héritage — et on hésite à y toucher pour
 * la mauvaise raison.
 *
 * **Le journal d'audit est en lecture seule**, et il n'a pas de bouton. C'est tout l'intérêt :
 * un journal qu'on peut corriger ne prouve rien.
 */

type Onglet = 'exploitation' | 'comptes' | 'journal';

const ONGLETS: readonly { readonly cle: Onglet; readonly libelle: string }[] = [
  { cle: 'exploitation', libelle: 'Exploitation' },
  { cle: 'comptes', libelle: 'Comptes du back-office' },
  { cle: 'journal', libelle: 'Journal d’audit' },
];

function nombreFr(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function ReglagesAdministration({ etat }: { readonly etat: EtatReglages }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>('exploitation');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  async function change(cle: string, valeur: number, motif: string): Promise<boolean> {
    setEnCours(cle);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/reglages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cle, valeur, motif }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Changement impossible.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
      return false;
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Section des réglages" className="mt-6 flex flex-wrap gap-1">
        {ONGLETS.map((candidat) => (
          <button
            key={candidat.cle}
            role="tab"
            type="button"
            aria-selected={onglet === candidat.cle}
            onClick={() => setOnglet(candidat.cle)}
            className={`rounded-t-[8px] border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              onglet === candidat.cle
                ? 'border-[#16181D] text-[#16181D]'
                : 'border-transparent text-[#6b6b66] hover:text-[#16181D]'
            }`}
          >
            {candidat.libelle}
          </button>
        ))}
      </div>

      {refus !== null && (
        <p role="alert" className="mt-3 text-sm font-medium text-[#8c1c1c]">
          {refus}
        </p>
      )}

      {onglet === 'exploitation' && (
        <>
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
            Ces huit réglages sont les seuls que la distribution relit en base à chaque demande. La
            table en contient treize autres — poids du classement, délais de contestation, taux de
            TVA — qu’aucun code ne consulte encore : les offrir ici donnerait des boutons sans
            effet. Ils apparaîtront quand le code les lira.
          </p>
          <div className="mt-4 space-y-3">
            {etat.reglages.map((reglage) => (
              <CarteReglage
                key={reglage.cle}
                reglage={reglage}
                occupe={enCours === reglage.cle}
                change={change}
              />
            ))}
          </div>
        </>
      )}

      {onglet === 'comptes' && (
        <>
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
            Créer un compte demande d’enrôler une application d’authentification, et cela ne se fait
            pas depuis un écran : le secret ne doit transiter ni par un courriel ni par un
            navigateur partagé. La création reste pour l’instant un geste en ligne de commande.
          </p>
          <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#dcdcd8] bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#dcdcd8] text-left">
                  <th className="px-4 py-2.5 font-semibold">Nom</th>
                  <th className="px-4 py-2.5 font-semibold">Rôle</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">
                    Double authentification
                  </th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">
                    Dernière connexion
                  </th>
                </tr>
              </thead>
              <tbody>
                {etat.comptes.map((compte) => (
                  <tr key={compte.id} className="border-b border-[#eceae6] last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{compte.nom}</span>
                      <span className="block text-[0.78rem] text-[#6b6b66]">{compte.email}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {compte.role}
                      {!compte.actif && (
                        <span className="ml-2 rounded-[4px] bg-[#eceae6] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#5c5c56]">
                          désactivé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {compte.doubleAuthentification ? (
                        'active'
                      ) : (
                        <span className="font-semibold text-[#8c1c1c]">absente</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[#6b6b66]">
                      {compte.derniereConnexion?.toLocaleDateString('fr-FR') ?? 'jamais'}
                      {compte.tentativesConnexion > 0 &&
                        ` · ${compte.tentativesConnexion} échec${compte.tentativesConnexion > 1 ? 's' : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {onglet === 'journal' && (
        <>
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
            Les cinquante dernières écritures du back-office, avec leur avant et leur après. Rien ne
            s’y modifie et rien ne s’y supprime : une correction est une ligne de plus, jamais une
            ligne changée. Un journal qu’on peut corriger ne prouve rien.
          </p>
          <div className="mt-4 space-y-2">
            {etat.journal.map((ligne) => (
              <LigneAudit key={ligne.id} ligne={ligne} />
            ))}
            {etat.journal.length === 0 && (
              <p className="rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
                Aucune écriture enregistrée.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CarteReglage({
  reglage,
  occupe,
  change,
}: {
  readonly reglage: ReglageExploitation;
  readonly occupe: boolean;
  readonly change: (cle: string, valeur: number, motif: string) => Promise<boolean>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState(String(reglage.valeur));
  const [motif, setMotif] = useState('');

  const bouton =
    'rounded-[6px] border border-[#cfcfc9] px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';
  const nombre = Number(valeur.replace(',', '.'));
  const valide =
    Number.isFinite(nombre) &&
    nombre >= reglage.minimum &&
    nombre <= reglage.maximum &&
    nombre !== reglage.valeur &&
    motif.trim().length >= 10;

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-2 font-semibold">
            {reglage.libelle}
            <span className="text-lg tabular-nums">
              {nombreFr(reglage.valeur)}{' '}
              <span className="text-[0.78rem] font-normal text-[#6b6b66]">{reglage.unite}</span>
            </span>
          </h2>
          <p className="mt-1 max-w-[68ch] text-[0.82rem] leading-relaxed text-[#45453f]">
            {reglage.explication}
          </p>
          <p className="mt-1 text-[0.78rem] text-[#6b6b66]">
            {reglage.surDefaut ? (
              <>Valeur par défaut du code — aucune ligne n’a jamais été posée en base.</>
            ) : reglage.modifiePar === null ? (
              // Les lignes du semis n'ont pas d'auteur : écrire « par inconnu » laisserait
              // croire à une trace perdue, alors que personne n'a jamais touché à la valeur.
              <>
                Valeur initiale, posée le {reglage.modifieLe?.toLocaleDateString('fr-FR')} · jamais
                modifiée depuis.
              </>
            ) : (
              <>
                Par défaut {nombreFr(reglage.valeurParDefaut)} {reglage.unite} · réglé le{' '}
                {reglage.modifieLe?.toLocaleDateString('fr-FR')} par {reglage.modifiePar}
                {reglage.motif !== null && ` — « ${reglage.motif} »`}
              </>
            )}
          </p>
        </div>
        <button type="button" className={bouton} onClick={() => setOuvert(!ouvert)}>
          {ouvert ? 'Annuler' : 'Changer'}
        </button>
      </div>

      {ouvert && (
        <div className="mt-3 rounded-[8px] border border-[#dcdcd8] bg-[#f6f5f2] p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor={`valeur-${reglage.cle}`}
                className="block text-[0.78rem] font-semibold"
              >
                Nouvelle valeur ({reglage.unite})
              </label>
              <input
                id={`valeur-${reglage.cle}`}
                type="number"
                inputMode="decimal"
                value={valeur}
                min={reglage.minimum}
                max={reglage.maximum}
                step={reglage.pas}
                onChange={(e) => setValeur(e.target.value)}
                className="mt-1 w-32 rounded-[6px] border border-[#cfcfc9] bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-[#16181D]"
              />
            </div>
            <p className="pb-2 text-[0.78rem] text-[#6b6b66]">
              Entre {nombreFr(reglage.minimum)} et {nombreFr(reglage.maximum)} {reglage.unite}.
            </p>
          </div>

          <label
            htmlFor={`motif-${reglage.cle}`}
            className="mt-3 block text-[0.78rem] font-semibold"
          >
            Pourquoi ce changement ?
          </label>
          <p className="mt-1 text-[0.78rem] text-[#45453f]">
            Ce réglage s’applique à toutes les demandes suivantes. Le motif part au journal, et
            c’est lui qui répondra à « pourquoi cette valeur ? » dans six mois.
          </p>
          <textarea
            id={`motif-${reglage.cle}`}
            value={motif}
            rows={2}
            onChange={(e) => setMotif(e.target.value)}
            className="mt-2 w-full rounded-[6px] border border-[#cfcfc9] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#16181D]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={occupe || !valide}
              className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
              onClick={() => {
                void change(reglage.cle, nombre, motif).then((ok) => {
                  if (ok) {
                    setOuvert(false);
                    setMotif('');
                  }
                });
              }}
            >
              Appliquer
            </button>
            <button type="button" className={bouton} onClick={() => setOuvert(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function LigneAudit({ ligne }: { readonly ligne: LigneJournal }) {
  const [ouvert, setOuvert] = useState(false);
  const detail = ligne.avant !== null || ligne.apres !== null;

  return (
    <article className="rounded-[10px] border border-[#dcdcd8] bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{ligne.action}</span>
          <span className="text-[#6b6b66]">
            {' '}
            · {ligne.typeObjet}
            {ligne.objetId !== null && ` ${ligne.objetId}`}
          </span>
        </p>
        <p className="text-[0.78rem] text-[#6b6b66]">
          {ligne.auteur} ·{' '}
          {ligne.creeLe.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {detail && (
            <button
              type="button"
              aria-expanded={ouvert}
              onClick={() => setOuvert(!ouvert)}
              className="ml-2 underline underline-offset-2 hover:text-[#16181D]"
            >
              {ouvert ? 'replier' : 'avant / après'}
            </button>
          )}
        </p>
      </div>
      {ouvert && (
        <pre className="mt-2 overflow-x-auto rounded-[6px] bg-[#f6f5f2] p-2 text-[0.72rem] leading-relaxed">
          {JSON.stringify({ avant: ligne.avant, apres: ligne.apres }, null, 2)}
        </pre>
      )}
    </article>
  );
}
