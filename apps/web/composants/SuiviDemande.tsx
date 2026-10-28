'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bouton, Carte, Note, Puce, ZoneTexte, cn } from '@lerenom/ui';
import { telephoneLisible } from '@/lib/affichage';
import type { SuiviClient } from '@/lib/suivi';

/**
 * Le suivi d'une demande, tel que le client le voit.
 *
 * Trois choses, et rien d'autre : où en est la demande, qui a accepté et comment le joindre,
 * et le droit de tout arrêter. L'annulation demande une confirmation explicite parce qu'elle ne
 * se défait pas : les professionnels qui ont déjà accepté ont été facturés.
 */

const MOTIFS = [
  'J’ai finalement trouvé quelqu’un',
  'Le besoin a disparu',
  'Je ne suis pas satisfait des réponses',
  'Je reporte les travaux',
] as const;

function dateCourte(valeur: Date | string): string {
  return new Date(valeur).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Les quelques statuts qu'un client peut voir, dits dans sa langue et pas dans celle de la base. */
function enClair(suivi: SuiviClient): { readonly titre: string; readonly texte: string } {
  if (suivi.annuleeLe !== null) {
    return {
      titre: 'Demande annulée',
      texte: `Vous avez annulé cette demande le ${dateCourte(suivi.annuleeLe)}. Elle n’est plus transmise à personne.`,
    };
  }

  switch (suivi.statut) {
    case 'complete':
    case 'gagnee':
      return {
        titre: 'Vous avez vos réponses',
        texte: `${suivi.pros.length} professionnels sur ${suivi.objectifPros} ont accepté. Votre demande n’est plus transmise à personne d’autre.`,
      };
    case 'sans_preneur':
      return {
        titre: 'Personne n’a pu se déplacer',
        texte:
          'Aucun professionnel disponible n’a pu prendre votre demande. Nous en sommes désolés : vous pouvez en déposer une nouvelle, ou élargir votre délai.',
      };
    case 'perimee':
      return {
        titre: 'Demande close',
        texte:
          'Passé 72 heures, une demande n’est plus transmise à personne. C’est la règle, et elle protège votre numéro.',
      };
    case 'en_attente_ouverture':
      return {
        titre: 'En attente de l’ouverture de votre ville',
        texte:
          'Votre demande est conservée et ne part chez personne. Nous vous préviendrons dès que des professionnels seront disponibles chez vous.',
      };
    default:
      return {
        titre:
          suivi.pros.length > 0 ? 'Des professionnels ont accepté' : 'Votre demande est en route',
        texte:
          suivi.pros.length > 0
            ? `${suivi.pros.length} sur ${suivi.objectifPros} ont accepté. Nous continuons tant que les ${suivi.objectifPros} places ne sont pas prises.`
            : `${suivi.nombreSollicites} professionnels ont été sollicités. Vous recevrez un SMS dès que l’un d’eux accepte.`,
      };
  }
}

export function SuiviDemande({
  jeton,
  suivi: initial,
}: {
  readonly jeton: string;
  readonly suivi: SuiviClient;
}) {
  const [suivi, setSuivi] = useState(initial);
  const [confirme, setConfirme] = useState(false);
  const [motif, setMotif] = useState<string>(MOTIFS[0]);
  const [precision, setPrecision] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const etat = enClair(suivi);
  const annulable =
    suivi.annuleeLe === null &&
    !['complete', 'gagnee', 'perimee', 'annulee', 'sans_preneur'].includes(suivi.statut);

  async function annule() {
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/suivi/${jeton}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'annuler',
          motif: precision.trim() === '' ? motif : `${motif} — ${precision.trim()}`,
        }),
      });

      const brut: unknown = await reponse.json();
      const donnees = brut as { annuleeLe?: string; erreur?: string };

      if (!reponse.ok || donnees.annuleeLe === undefined) {
        setErreur(donnees.erreur ?? 'Votre demande n’a pas pu être annulée.');
        return;
      }

      setSuivi((precedent) => ({
        ...precedent,
        statut: 'annulee',
        annuleeLe: new Date(donnees.annuleeLe ?? Date.now()),
      }));
      setConfirme(false);
    } catch {
      setErreur('Votre demande n’a pas pu être annulée. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="min-w-0 space-y-5">
        {/* ── Où en est la demande ─────────────────────────────────────── */}
        <Carte className="p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl">{etat.titre}</h2>
            <Puce desactivee={suivi.annuleeLe !== null}>
              {suivi.pros.length} / {suivi.objectifPros} professionnels
            </Puce>
          </div>
          <p className="text-encre-70 mt-2 max-w-[60ch] text-sm leading-relaxed">{etat.texte}</p>

          <ol className="mt-6 space-y-4">
            <Etape faite libelle="Demande déposée" detail={dateCourte(suivi.deposeeLe)} />
            <Etape
              faite={suivi.nombreSollicites > 0}
              libelle="Professionnels sollicités"
              detail={
                suivi.nombreSollicites > 0
                  ? `${suivi.nombreSollicites} contactés${suivi.enAttenteDeReponse > 0 ? `, ${suivi.enAttenteDeReponse} en attente de réponse` : ''}`
                  : 'En cours'
              }
            />
            <Etape
              faite={suivi.pros.length > 0}
              libelle="Coordonnées transmises"
              detail={
                suivi.pros.length > 0
                  ? `${suivi.pros.length} professionnels ont vos coordonnées`
                  : 'Personne n’a encore vos coordonnées'
              }
            />
          </ol>
        </Carte>

        {/* ── Les professionnels qui ont accepté ───────────────────────── */}
        {suivi.pros.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl">Qui a accepté votre demande</h2>
            {suivi.pros.map((pro) => (
              <Carte key={pro.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{pro.nom}</p>
                    {pro.ville !== null && (
                      <p className="text-encre-55 mt-0.5 text-sm">{pro.ville}</p>
                    )}
                  </div>
                  <Note note={pro.note} nombreAvis={pro.nombreAvis} taille="petite" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2.5">
                  {pro.telephone !== null && (
                    <a href={`tel:${pro.telephone.replace(/\s/g, '')}`}>
                      <Bouton aspect="or">Appeler {telephoneLisible(pro.telephone)}</Bouton>
                    </a>
                  )}
                  {pro.email !== null && (
                    <a href={`mailto:${pro.email}`}>
                      <Bouton aspect="contour">Écrire</Bouton>
                    </a>
                  )}
                  {pro.slug !== null && (
                    <Link href={`/entreprise/${pro.slug}`}>
                      <Bouton aspect="discret">Voir la fiche</Bouton>
                    </Link>
                  )}
                </div>

                {pro.accepteeLe !== null && (
                  <p className="text-encre-55 mt-3 text-xs">
                    A accepté le {dateCourte(pro.accepteeLe)}
                  </p>
                )}
              </Carte>
            ))}
          </div>
        )}

        {/* ── Annulation ───────────────────────────────────────────────── */}
        {annulable && (
          <Carte className="p-5">
            {!confirme ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">Vous n’avez plus besoin de ces devis ?</p>
                  <p className="text-encre-70 mt-1 text-sm">
                    Vous pouvez arrêter votre demande à tout moment. C’est gratuit et sans
                    justification.
                  </p>
                </div>
                <Bouton aspect="discret" onClick={() => setConfirme(true)}>
                  Annuler ma demande
                </Bouton>
              </div>
            ) : (
              <div>
                <p className="font-bold">Annuler définitivement cette demande ?</p>
                <p className="text-encre-70 mt-1 text-sm leading-relaxed">
                  Elle ne sera plus transmise à personne. Les professionnels qui ont déjà accepté
                  gardent vos coordonnées : prévenez-les directement si vous ne souhaitez plus
                  qu’ils vous recontactent. Cette action ne se défait pas.
                </p>

                <fieldset className="mt-5">
                  <legend className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                    Pourquoi ? (cela nous aide à nous améliorer)
                  </legend>
                  <div className="mt-3 space-y-2">
                    {MOTIFS.map((valeur) => (
                      <label
                        key={valeur}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-douce)]',
                          'border px-4 text-sm transition-colors',
                          motif === valeur ? 'border-or bg-or/6' : 'border-bordure',
                        )}
                      >
                        <input
                          type="radio"
                          name="motif-annulation"
                          checked={motif === valeur}
                          onChange={() => setMotif(valeur)}
                          className="size-4 shrink-0 accent-[var(--color-or)]"
                        />
                        <span>{valeur}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <ZoneTexte
                  className="mt-4"
                  etiquette="Précision (facultatif)"
                  rows={3}
                  value={precision}
                  onChange={(e) => setPrecision(e.target.value)}
                  maxLength={300}
                />

                {erreur !== null && (
                  <p
                    role="alert"
                    className="bg-erreur-fond text-erreur mt-4 rounded-[var(--radius-douce)] px-4 py-3 text-sm"
                  >
                    {erreur}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Bouton aspect="discret" onClick={() => setConfirme(false)} disabled={envoi}>
                    Non, je garde ma demande
                  </Bouton>
                  <Bouton aspect="contour" onClick={() => void annule()} chargement={envoi}>
                    Oui, annuler définitivement
                  </Bouton>
                </div>
              </div>
            )}
          </Carte>
        )}
      </div>

      {/* ── Rappel de la demande ───────────────────────────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Carte className="p-5">
          <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Votre demande
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <Ligne cle="Référence" valeur={suivi.reference} />
            <Ligne cle="Prestation" valeur={suivi.besoin} />
            <Ligne cle="Ville" valeur={suivi.ville} />
            <Ligne cle="Déposée le" valeur={dateCourte(suivi.deposeeLe)} />
          </dl>
          <p className="text-encre-70 border-bordure mt-4 border-t pt-4 text-sm leading-relaxed">
            {suivi.description}
          </p>
        </Carte>

        <Carte className="border-or/25 bg-or/[0.05] p-5">
          <p className="text-encre text-sm font-bold">Ce que nous ne ferons jamais</p>
          <ul className="text-encre-70 mt-3 space-y-2 text-xs leading-relaxed">
            <li>Transmettre votre demande à plus de {suivi.objectifPros} professionnels.</li>
            <li>La transmettre à quiconque au-delà de 72 heures.</li>
            <li>Vendre vos coordonnées à qui que ce soit d’autre.</li>
          </ul>
        </Carte>
      </aside>
    </div>
  );
}

function Etape({
  faite,
  libelle,
  detail,
}: {
  readonly faite: boolean;
  readonly libelle: string;
  readonly detail: string;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          faite ? 'bg-succes-fond text-succes' : 'bg-encre/6 text-encre-40',
        )}
      >
        {faite ? '✓' : '·'}
      </span>
      <div className="min-w-0">
        <p className={cn('text-sm font-bold', faite ? 'text-encre' : 'text-encre-55')}>{libelle}</p>
        <p className="text-encre-55 mt-0.5 text-sm">{detail}</p>
      </div>
    </li>
  );
}

function Ligne({ cle, valeur }: { readonly cle: string; readonly valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-encre-55 shrink-0">{cle}</dt>
      <dd className="min-w-0 text-right font-bold break-words">{valeur}</dd>
    </div>
  );
}
