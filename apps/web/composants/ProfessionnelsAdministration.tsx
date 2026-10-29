'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ActionProfessionnel,
  EtatProfessionnels,
  FileProfessionnels,
  ProfessionnelAdministration,
} from '@/lib/administration-professionnels';

/**
 * Les professionnels, à vérifier.
 *
 * **La file « à vérifier » s'ouvre en premier**, et les plus anciennes demandes en haut : un
 * artisan qui s'est inscrit lundi attend derrière, et il n'a reçu aucune demande depuis.
 *
 * **Les onglets et la recherche passent par l'adresse**, pas par l'état du composant. Trois
 * raisons : la liste est tronquée à deux cents lignes et un filtre côté navigateur ne
 * chercherait que dans ces deux cents ; un écran d'exploitation se partage par lien (« regarde
 * cette fiche ») ; et rafraîchir après une vérification doit laisser l'écran où il était.
 *
 * **Un seul tableau à la fois.** Les actions sont dans la ligne, pas dans un panneau latéral :
 * à 390 px un panneau recouvre ce qu'on vient de lire.
 *
 * **La suspension demande un motif avant d'être possible.** Le champ s'ouvre dans la ligne et
 * le bouton reste inerte tant qu'il est trop court. Ce n'est pas une politesse : le motif part
 * au journal d'audit, et c'est la seule chose qui expliquera la décision dans six mois.
 */

const ONGLETS: readonly {
  readonly cle: FileProfessionnels;
  readonly libelle: string;
  readonly compteur: keyof EtatProfessionnels['compteurs'];
}[] = [
  { cle: 'a-verifier', libelle: 'À vérifier', compteur: 'aVerifier' },
  { cle: 'actives', libelle: 'Actives', compteur: 'actives' },
  { cle: 'ecartees', libelle: 'Écartées', compteur: 'ecartees' },
];

export function ProfessionnelsAdministration({
  etat,
  file,
  recherche,
}: {
  readonly etat: EtatProfessionnels;
  readonly file: FileProfessionnels;
  readonly recherche: string;
}) {
  const router = useRouter();
  const [terme, setTerme] = useState(recherche);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  function navigue(prochaineFile: FileProfessionnels, prochainTerme: string): void {
    const parametres = new URLSearchParams();
    if (prochaineFile !== 'a-verifier') parametres.set('file', prochaineFile);
    if (prochainTerme.trim() !== '') parametres.set('q', prochainTerme.trim());
    const suffixe = parametres.toString();
    router.push(`/administration/professionnels${suffixe === '' ? '' : `?${suffixe}`}`);
  }

  async function agit(
    entrepriseId: string,
    action: ActionProfessionnel,
    motif?: string,
  ): Promise<void> {
    setEnCours(entrepriseId);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/professionnels', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entrepriseId,
          action,
          ...(motif === undefined ? {} : { motif }),
        }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Action impossible.');
        return;
      }
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="File de professionnels" className="flex gap-1">
          {ONGLETS.map((onglet) => (
            <button
              key={onglet.cle}
              role="tab"
              type="button"
              aria-selected={file === onglet.cle}
              onClick={() => navigue(onglet.cle, terme)}
              className={`rounded-t-[8px] border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                file === onglet.cle
                  ? 'border-[#16181D] text-[#16181D]'
                  : 'border-transparent text-[#6b6b66] hover:text-[#16181D]'
              }`}
            >
              {onglet.libelle}
              <span className="ml-1.5 tabular-nums opacity-70">
                {etat.compteurs[onglet.compteur].toLocaleString('fr-FR')}
              </span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigue(file, terme);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="search"
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
            placeholder="Nom ou SIRET…"
            aria-label="Chercher une entreprise par nom ou SIRET"
            className="rounded-[8px] border border-[#cfcfc9] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#16181D]"
          />
          <button
            type="submit"
            className="rounded-[8px] border border-[#cfcfc9] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[#16181D]"
          >
            Chercher
          </button>
        </form>
      </div>

      {refus !== null && (
        <p role="alert" className="mt-3 text-sm font-medium text-[#8c1c1c]">
          {refus}
        </p>
      )}

      <p className="mt-3 text-sm text-[#6b6b66]">
        {etat.liste.length.toLocaleString('fr-FR')} entreprise
        {etat.liste.length > 1 ? 's' : ''} affichée{etat.liste.length > 1 ? 's' : ''}
        {etat.liste.length === 200 && ' (les deux cents premières)'}
        {etat.compteurs.nonRevendiquees > 0 &&
          ` · ${etat.compteurs.nonRevendiquees.toLocaleString('fr-FR')} fiches de l’annuaire que personne n’a revendiquées, et qui n’attendent rien de nous.`}
      </p>

      <div className="mt-3 space-y-3">
        {etat.liste.map((pro) => (
          <Fiche key={pro.id} pro={pro} occupe={enCours === pro.id} agit={agit} />
        ))}
        {etat.liste.length === 0 && (
          <p className="rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
            {file === 'a-verifier'
              ? 'Aucune fiche n’attend d’être vérifiée. C’est la bonne nouvelle du jour.'
              : 'Aucune entreprise dans cette file.'}
          </p>
        )}
      </div>
    </>
  );
}

function Etiquette({
  texte,
  ton,
}: {
  readonly texte: string;
  readonly ton: 'attente' | 'bien' | 'mal' | 'neutre';
}) {
  const couleurs = {
    attente: 'bg-[#fdf0e4] text-[#8a5a16]',
    bien: 'bg-[#e6efe7] text-[#2c5733]',
    mal: 'bg-[#f6e4e4] text-[#8c1c1c]',
    neutre: 'bg-[#eceae6] text-[#5c5c56]',
  }[ton];
  return (
    <span
      className={`rounded-[4px] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap ${couleurs}`}
    >
      {texte}
    </span>
  );
}

function Fiche({
  pro,
  occupe,
  agit,
}: {
  readonly pro: ProfessionnelAdministration;
  readonly occupe: boolean;
  readonly agit: (id: string, action: ActionProfessionnel, motif?: string) => Promise<void>;
}) {
  const [motif, setMotif] = useState<string | null>(null);

  const bouton =
    'rounded-[6px] border border-[#cfcfc9] px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';
  const retiree = pro.retireeLe !== null;

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {pro.nom}
            {retiree && <Etiquette texte="retirée" ton="mal" />}
            {pro.suspendue && <Etiquette texte="suspendue" ton="mal" />}
            {!pro.verifiee && !retiree && !pro.suspendue && (
              <Etiquette texte="non vérifiée" ton="attente" />
            )}
            {pro.verifiee && !pro.suspendue && !retiree && (
              <Etiquette texte="vérifiée" ton="bien" />
            )}
            {!pro.revendiquee && <Etiquette texte="non revendiquée" ton="neutre" />}
            {pro.comptes === 0 && pro.revendiquee && (
              <Etiquette texte="aucun compte" ton="attente" />
            )}
          </h2>
          <p className="mt-1 text-[0.8rem] text-[#6b6b66]">
            {pro.commune ?? 'Commune inconnue'}
            {pro.siret === null ? ' · SIRET absent' : ` · SIRET ${pro.siret}`} · inscrite le{' '}
            {pro.creeLe.toLocaleDateString('fr-FR')}
          </p>
          <p className="mt-1 text-[0.8rem] text-[#45453f]">
            {pro.metiers.length === 0 ? (
              // Sans métier, la cascade ne peut la rapprocher d'aucune demande : la vérifier
              // ne lui apporterait toujours rien. Le dire ici évite de chercher pourquoi.
              <span className="text-[#8a5a16]">
                Aucun métier déclaré : même vérifiée, elle ne recevra rien.
              </span>
            ) : (
              pro.metiers.join(' · ')
            )}
          </p>
          <p className="mt-1 text-[0.78rem] text-[#6b6b66]">
            {pro.demandesRecues.toLocaleString('fr-FR')} demande
            {pro.demandesRecues > 1 ? 's' : ''} reçue{pro.demandesRecues > 1 ? 's' : ''} ·{' '}
            {pro.nombreAvis === 0
              ? 'aucun avis'
              : `${pro.noteMoyenne?.toFixed(1).replace('.', ',') ?? '—'} / 5 sur ${pro.nombreAvis.toLocaleString('fr-FR')} avis`}
            {pro.motifRetrait !== null && ` · retrait : ${pro.motifRetrait}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/professionnel/${pro.slug}`}
            target="_blank"
            rel="noreferrer"
            className={bouton}
          >
            Voir la fiche
          </a>
          {!retiree && !pro.verifiee && (
            <button
              type="button"
              disabled={occupe}
              className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
              title="L’entreprise entre dans la distribution et commence à recevoir des demandes."
              onClick={() => void agit(pro.id, 'verifier')}
            >
              Vérifier
            </button>
          )}
          {!retiree && pro.verifiee && (
            <button
              type="button"
              disabled={occupe}
              className={bouton}
              title="Elle reste visible dans l’annuaire mais ne reçoit plus de demandes."
              onClick={() => void agit(pro.id, 'retirer-verification')}
            >
              Retirer la vérification
            </button>
          )}
          {!retiree && !pro.suspendue && (
            <button
              type="button"
              className={bouton}
              onClick={() => setMotif(motif === null ? '' : null)}
            >
              Suspendre
            </button>
          )}
          {!retiree && pro.suspendue && (
            <button
              type="button"
              disabled={occupe}
              className={bouton}
              onClick={() => void agit(pro.id, 'reactiver')}
            >
              Réactiver
            </button>
          )}
        </div>
      </div>

      {motif !== null && (
        <div className="mt-3 rounded-[8px] border border-[#e4c9c9] bg-[#fdf7f7] p-3">
          <label htmlFor={`motif-${pro.id}`} className="text-[0.8rem] font-semibold">
            Pourquoi suspendez-vous {pro.nom} ?
          </label>
          <p className="mt-1 text-[0.78rem] text-[#45453f]">
            Une suspension coupe ses revenus. Ce motif part au journal d’audit : c’est la seule
            chose qui expliquera la décision dans six mois.
          </p>
          <textarea
            id={`motif-${pro.id}`}
            value={motif}
            rows={2}
            onChange={(e) => setMotif(e.target.value)}
            className="mt-2 w-full rounded-[6px] border border-[#cfcfc9] px-2 py-1.5 text-sm outline-none focus:border-[#16181D]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={occupe || motif.trim().length < 10}
              className={`${bouton} border-[#8c1c1c] bg-[#8c1c1c] text-white`}
              onClick={() => {
                void agit(pro.id, 'suspendre', motif);
                setMotif(null);
              }}
            >
              Suspendre
            </button>
            <button type="button" className={bouton} onClick={() => setMotif(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
