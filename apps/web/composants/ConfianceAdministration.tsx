'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AvisAModerer,
  ContestationAJuger,
  EtatConfiance,
  FileConfiance,
} from '@/lib/administration-confiance';

/**
 * La confiance, à relire.
 *
 * **Les avis en premier**, les plus anciens en haut : un avis qui attend est un client qui a
 * écrit dans le vide, et un professionnel dont la note ne bouge pas.
 *
 * **Le texte d'origine et l'aperçu publié sont montrés côte à côte** dès qu'ils diffèrent. Le
 * relecteur doit voir ce qu'on lui a confié *et* ce qui sortira ; ne montrer que l'un des deux
 * reviendrait à lui faire signer sans lire. Quand rien n'a été retiré — le cas général — un
 * seul texte s'affiche, parce qu'un doublon identique ferait croire à une intervention.
 *
 * **Les signaux automatiques sont des alertes, pas des verdicts.** « Accusation grave » ne veut
 * pas dire que l'avis est faux ; il veut dire qu'un humain doit le lire avant qu'il engage la
 * plateforme. Le mot est choisi pour ne pas pré-juger.
 */

const LIBELLE_SIGNAL: Readonly<Record<string, string>> = {
  'coordonnees-telephoniques': 'numéro de téléphone',
  'adresse-electronique': 'adresse électronique',
  'lien-externe': 'lien externe',
  'injure-possible': 'injure possible',
  cris: 'texte tout en capitales',
  'accusation-grave': 'accusation grave',
};

const LIBELLE_RETRAIT: Readonly<Record<string, string>> = {
  telephone: 'numéro',
  email: 'adresse électronique',
  lien: 'lien',
};

const ONGLETS: readonly {
  readonly cle: FileConfiance;
  readonly libelle: string;
  readonly compteur: 'avis' | 'contestations' | 'signalements';
}[] = [
  { cle: 'avis', libelle: 'Avis à relire', compteur: 'avis' },
  { cle: 'contestations', libelle: 'Contestations', compteur: 'contestations' },
  { cle: 'signalements', libelle: 'Signalements', compteur: 'signalements' },
];

export function ConfianceAdministration({ etat }: { readonly etat: EtatConfiance }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<FileConfiance>('avis');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  async function modere(avisId: string, action: 'publier' | 'refuser', motif?: string) {
    setEnCours(avisId);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/confiance', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avisId, action, ...(motif === undefined ? {} : { motif }) }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Modération impossible.');
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
      <div role="tablist" aria-label="File de modération" className="mt-6 flex flex-wrap gap-1">
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
            <span className="ml-1.5 tabular-nums opacity-70">
              {etat.indicateurs[candidat.compteur].toLocaleString('fr-FR')}
            </span>
          </button>
        ))}
      </div>

      {refus !== null && (
        <p role="alert" className="mt-3 text-sm font-medium text-[#8c1c1c]">
          {refus}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {onglet === 'avis' &&
          (etat.avis.length === 0 ? (
            <Vide texte="Aucun avis n’attend d’être relu." />
          ) : (
            etat.avis.map((avis) => (
              <CarteAvis key={avis.id} avis={avis} occupe={enCours === avis.id} modere={modere} />
            ))
          ))}

        {onglet === 'contestations' &&
          (etat.contestations.length === 0 ? (
            <Vide texte="Aucune contestation en attente." />
          ) : (
            etat.contestations.map((c) => <CarteContestation key={c.id} contestation={c} />)
          ))}

        {onglet === 'signalements' &&
          (etat.signalements.length === 0 ? (
            <Vide texte="Aucun signalement en attente." />
          ) : (
            etat.signalements.map((s) => (
              <article key={s.id} className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
                <p className="font-semibold">
                  {s.motif} · {s.typeContenu}
                </p>
                <p className="mt-1 text-[0.8rem] text-[#6b6b66]">
                  Contenu {s.contenuId} · signalé le {s.creeLe.toLocaleDateString('fr-FR')}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{s.explication}</p>
                <p className="mt-3 text-[0.78rem] text-[#8a5a16] italic">
                  Le traitement des signalements DSA n’est pas encore outillé : la décision, sa
                  motivation et le recours de l’auteur doivent être écrits, et cet écran ne sait pas
                  encore les recueillir.
                </p>
              </article>
            ))
          ))}
      </div>
    </>
  );
}

function Vide({ texte }: { readonly texte: string }) {
  return (
    <p className="rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
      {texte}
    </p>
  );
}

function Etoiles({ note }: { readonly note: number }) {
  return (
    <span aria-label={`${note} sur 5`} className="font-semibold tabular-nums">
      {note} / 5
    </span>
  );
}

function CarteAvis({
  avis,
  occupe,
  modere,
}: {
  readonly avis: AvisAModerer;
  readonly occupe: boolean;
  readonly modere: (id: string, action: 'publier' | 'refuser', motif?: string) => Promise<void>;
}) {
  const [motif, setMotif] = useState<string | null>(null);
  const bouton =
    'rounded-[6px] border border-[#cfcfc9] px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';
  const caviarde = avis.retraits.length > 0;

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {avis.entreprise}
            <Etoiles note={avis.note} />
            {avis.signalements > 0 && (
              <span className="rounded-[4px] bg-[#f6e4e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8c1c1c]">
                {avis.signalements} signalement{avis.signalements > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="mt-1 text-[0.8rem] text-[#6b6b66]">
            {avis.auteur} · demande {avis.reference} · déposé le{' '}
            {avis.deposeLe.toLocaleDateString('fr-FR')}
            {avis.moyenneCriteres !== null &&
              ` · critères ${avis.moyenneCriteres.toFixed(1).replace('.', ',')} / 5`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/entreprise/${avis.entrepriseSlug}`}
            target="_blank"
            rel="noreferrer"
            className={bouton}
          >
            Voir la fiche
          </a>
          <button
            type="button"
            disabled={occupe}
            className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
            title={
              caviarde
                ? 'Publie la version caviardée, et recalcule la note de l’entreprise.'
                : 'Publie l’avis tel quel, et recalcule la note de l’entreprise.'
            }
            onClick={() => void modere(avis.id, 'publier')}
          >
            {caviarde ? 'Publier caviardé' : 'Publier'}
          </button>
          <button
            type="button"
            className={bouton}
            onClick={() => setMotif(motif === null ? '' : null)}
          >
            Refuser
          </button>
        </div>
      </div>

      {avis.signaux.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {avis.signaux.map((signal) => (
            <span
              key={signal}
              className="rounded-[4px] bg-[#fdf0e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8a5a16]"
            >
              {LIBELLE_SIGNAL[signal] ?? signal}
            </span>
          ))}
        </p>
      )}

      {avis.commentaire === null ? (
        <p className="mt-3 text-sm text-[#6b6b66] italic">
          Note sans commentaire : rien à relire, seulement à publier.
        </p>
      ) : caviarde ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.12em] text-[#6b6b66] uppercase">
              Tel que l’auteur l’a écrit
            </p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{avis.commentaire}</p>
          </div>
          <div className="rounded-[8px] bg-[#f6f5f2] p-3">
            <p className="text-[0.68rem] font-bold tracking-[0.12em] text-[#6b6b66] uppercase">
              Ce qui sera publié
            </p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{avis.apercuPublic}</p>
            <p className="mt-2 text-[0.75rem] text-[#45453f]">
              Retiré : {avis.retraits.map((r) => LIBELLE_RETRAIT[r] ?? r).join(', ')}. Le retrait
              reste visible dans le texte, et l’original n’est pas effacé.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{avis.commentaire}</p>
      )}

      {motif !== null && (
        <div className="mt-3 rounded-[8px] border border-[#e4c9c9] bg-[#fdf7f7] p-3">
          <label htmlFor={`motif-avis-${avis.id}`} className="text-[0.8rem] font-semibold">
            Pourquoi refusez-vous cet avis ?
          </label>
          <p className="mt-1 text-[0.78rem] text-[#45453f]">
            Refuser, c’est écarter la parole d’un client. Le motif part au journal d’audit, et c’est
            lui qui permettra de répondre si l’auteur demande des comptes.
          </p>
          <textarea
            id={`motif-avis-${avis.id}`}
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
                void modere(avis.id, 'refuser', motif);
                setMotif(null);
              }}
            >
              Refuser l’avis
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

function CarteContestation({ contestation }: { readonly contestation: ContestationAJuger }) {
  return (
    <article
      className={`rounded-[12px] border bg-white p-4 ${
        contestation.enRetard ? 'border-[#e4c9c9]' : 'border-[#dcdcd8]'
      }`}
    >
      <h2 className="flex flex-wrap items-center gap-2 font-semibold">
        {contestation.entreprise}
        <span className="text-[0.8rem] font-normal text-[#6b6b66]">{contestation.motif}</span>
        {contestation.enRetard && (
          <span className="rounded-[4px] bg-[#f6e4e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8c1c1c]">
            hors délai
          </span>
        )}
      </h2>
      <p className="mt-1 text-[0.8rem] text-[#6b6b66]">
        Demande {contestation.reference} · déposée le{' '}
        {contestation.deposeeLe.toLocaleDateString('fr-FR')} · à trancher avant le{' '}
        {contestation.echeanceLe.toLocaleDateString('fr-FR')}
      </p>
      <p className="mt-2 text-sm leading-relaxed">{contestation.explication}</p>
      <p className="mt-3 text-[0.78rem] text-[#8a5a16] italic">
        Trancher une contestation engage un recrédit, donc une ligne de facturation. Tant que la
        facturation n’est pas branchée, accepter ici promettrait un remboursement que rien ne
        verserait.
      </p>
    </article>
  );
}
