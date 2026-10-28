'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte, Champ, ZoneTexte, cn } from '@lerenom/ui';
import {
  NOMS_UNITE,
  TAUX_TVA,
  UNITES,
  calculeTotaux,
  devisConforme,
  formatEuros,
  type LigneDocument,
  type PourcentAcompte,
  type TauxTva,
  type TypeLigne,
  type Unite,
  type ValiditeJours,
} from '@lerenom/core';
import type { DevisComplet } from '@/lib/devis-pro';

/**
 * L'éditeur de devis.
 *
 * Ce qui le distingue d'un tableur, c'est la **colonne de conformité** : les mentions
 * obligatoires d'un devis de dépannage à domicile y sont listées, cochées au fil de la
 * saisie, et le bouton d'envoi reste fermé tant qu'il en manque une. Ce n'est pas une
 * politesse réglementaire — un devis incomplet expose l'artisan qui l'a signé.
 *
 * Les totaux sont calculés par la même fonction que le serveur. Un écran qui additionnerait
 * de son côté finirait par afficher un prix que la facture ne reprendrait pas.
 */

interface Brouillon {
  readonly cle: string;
  readonly type: TypeLigne;
  readonly designation: string;
  readonly detail: string;
  readonly unite: Unite | null;
  readonly quantite: number | null;
  readonly prixUnitaireHT: number | null;
  readonly tauxTva: TauxTva | null;
}

const VALIDITES: readonly ValiditeJours[] = [15, 30, 60];
const ACOMPTES: readonly PourcentAcompte[] = [0, 30, 40];

export function EditeurDevis({ devis }: { readonly devis: DevisComplet }) {
  const router = useRouter();

  const [lignes, setLignes] = useState<readonly Brouillon[]>(() =>
    devis.lignes.map((ligne, rang) => ({
      cle: `${String(rang)}-${ligne.id}`,
      type: ligne.type,
      designation: ligne.designation,
      detail: ligne.detail ?? '',
      unite: ligne.unite ?? null,
      quantite: ligne.quantite ?? null,
      prixUnitaireHT: ligne.prixUnitaireHT ?? null,
      tauxTva: ligne.tauxTva ?? null,
    })),
  );
  const [clientId, setClientId] = useState(devis.clientId);
  const [remisePourcent, setRemise] = useState(devis.remisePourcent);
  const [acomptePourcent, setAcompte] = useState<PourcentAcompte>(devis.acomptePourcent);
  const [validiteJours, setValidite] = useState<ValiditeJours>(devis.validiteJours);
  const [fraisDeplacementTTC, setFrais] = useState<number | null>(devis.fraisDeplacementTTC);
  const [devisPayant, setPayant] = useState(devis.devisPayant);
  const [piecesRemplaceesGardees, setPieces] = useState(devis.piecesRemplaceesGardees);

  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refus, setRefus] = useState<{ texte: string; manquants: readonly string[] } | null>(null);

  const document = useMemo(() => {
    const converties: readonly LigneDocument[] = lignes.map((ligne, rang) => ({
      id: String(rang),
      type: ligne.type,
      designation: ligne.designation,
      ...(ligne.detail !== '' ? { detail: ligne.detail } : {}),
      ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
      ...(ligne.quantite !== null ? { quantite: ligne.quantite } : {}),
      ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: ligne.prixUnitaireHT } : {}),
      ...(ligne.tauxTva !== null ? { tauxTva: ligne.tauxTva } : {}),
    }));
    return { lignes: converties, remisePourcent, acomptePourcent };
  }, [lignes, remisePourcent, acomptePourcent]);

  const totaux = useMemo(() => calculeTotaux(document), [document]);
  const conformite = useMemo(
    () =>
      devisConforme(document, {
        fraisDeplacementIndiques: fraisDeplacementTTC !== null,
        validiteJours,
        caractereGratuitIndique: true,
        piecesRemplaceesIndiquee: true,
      }),
    [document, fraisDeplacementTTC, validiteJours],
  );

  function change(cle: string, champs: Partial<Brouillon>) {
    setLignes((actuelles) =>
      actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...champs } : ligne)),
    );
  }

  function ajoute(type: TypeLigne) {
    setLignes((actuelles) => [
      ...actuelles,
      {
        cle: `nouvelle-${String(Date.now())}-${String(actuelles.length)}`,
        type,
        designation: '',
        detail: '',
        unite: type === 'prestation' ? 'forfait' : null,
        quantite: type === 'prestation' ? 1 : null,
        prixUnitaireHT: type === 'prestation' ? 0 : null,
        tauxTva: type === 'prestation' ? 10 : null,
      },
    ]);
  }

  function deplace(cle: string, pas: -1 | 1) {
    setLignes((actuelles) => {
      const rang = actuelles.findIndex((ligne) => ligne.cle === cle);
      const cible = rang + pas;
      if (rang < 0 || cible < 0 || cible >= actuelles.length) return actuelles;
      const copie = [...actuelles];
      const [retiree] = copie.splice(rang, 1);
      if (retiree === undefined) return actuelles;
      copie.splice(cible, 0, retiree);
      return copie;
    });
  }

  function corps() {
    return {
      clientId,
      type: devis.type,
      lignes: lignes.map(({ cle: _cle, ...ligne }) => ligne),
      remisePourcent,
      acomptePourcent,
      validiteJours,
      fraisDeplacementTTC,
      devisPayant,
      piecesRemplaceesGardees,
      mentionRetractation: devis.mentionRetractation,
    };
  }

  async function enregistre(): Promise<boolean> {
    setRefus(null);
    setMessage(null);
    const reponse = await fetch(`/api/pro/devis/${devis.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps()),
    });
    if (reponse.ok) return true;
    const retour = (await reponse.json()) as { erreur?: string };
    setRefus({ texte: retour.erreur ?? 'Ce devis n’a pas pu être enregistré.', manquants: [] });
    return false;
  }

  async function sauvegarde(): Promise<void> {
    setEnCours(true);
    try {
      if (await enregistre()) setMessage('Votre devis est enregistré.');
    } catch {
      setRefus({ texte: 'Nous n’avons pas pu joindre nos serveurs.', manquants: [] });
    } finally {
      setEnCours(false);
    }
  }

  async function envoie(): Promise<void> {
    setEnCours(true);
    try {
      // On enregistre avant d'envoyer : le serveur juge le devis tel qu'il est en base, pas
      // tel qu'il est à l'écran.
      if (!(await enregistre())) return;

      const reponse = await fetch(`/api/pro/devis/${devis.id}/envoi`, { method: 'POST' });
      if (reponse.ok) {
        router.refresh();
        return;
      }
      const retour = (await reponse.json()) as { erreur?: string; manquants?: readonly string[] };
      setRefus({
        texte: retour.erreur ?? 'Ce devis n’a pas pu être envoyé.',
        manquants: retour.manquants ?? [],
      });
    } catch {
      setRefus({ texte: 'Nous n’avons pas pu joindre nos serveurs.', manquants: [] });
    } finally {
      setEnCours(false);
    }
  }

  async function dupliquer(): Promise<void> {
    setEnCours(true);
    try {
      const reponse = await fetch(`/api/pro/devis/${devis.id}/duplication`, { method: 'POST' });
      if (reponse.ok) {
        const retour = (await reponse.json()) as { id: string };
        router.push(`/pro/espace/devis/${retour.id}`);
      }
    } finally {
      setEnCours(false);
    }
  }

  const fige = !devis.modifiable;

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_19rem] lg:items-start">
      <div className="min-w-0">
        {message !== null && (
          <p
            role="status"
            className="border-succes/25 bg-succes-fond text-succes mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
          >
            {message}
          </p>
        )}
        {refus !== null && (
          <div
            role="alert"
            className="border-alerte/25 bg-alerte-fond mb-6 rounded-[var(--radius-carte)] border p-4"
          >
            <p className="text-alerte text-sm font-semibold">{refus.texte}</p>
            {refus.manquants.length > 0 && (
              <ul className="text-alerte/85 mt-2 list-disc space-y-1 pl-5 text-sm">
                {refus.manquants.map((manque) => (
                  <li key={manque}>{manque}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {fige && (
          <div className="border-bordure bg-creme mb-6 rounded-[var(--radius-carte)] border p-4">
            <p className="text-encre text-sm font-semibold">
              Ce devis a été envoyé{devis.numero !== null && ` sous le numéro ${devis.numero}`}.
            </p>
            <p className="text-encre-70 mt-1.5 text-sm">
              Il ne se modifie plus : votre client en a reçu un exemplaire, et le changer sous ses
              yeux ne serait pas une correction. Dupliquez-le pour en établir une nouvelle version.
            </p>
            <Bouton
              aspect="contour"
              className="mt-4"
              onClick={() => void dupliquer()}
              disabled={enCours}
            >
              Dupliquer en nouveau brouillon
            </Bouton>
          </div>
        )}

        <Carte className="p-5">
          <h2 className="text-xl">Les lignes</h2>

          <div className="mt-5 space-y-3">
            {lignes.map((ligne, rang) => (
              <LigneEditable
                key={ligne.cle}
                ligne={ligne}
                rang={rang}
                total={lignes.length}
                fige={fige}
                onChange={(champs) => change(ligne.cle, champs)}
                onRetire={() => setLignes((a) => a.filter((l) => l.cle !== ligne.cle))}
                onDeplace={(pas) => deplace(ligne.cle, pas)}
              />
            ))}
            {lignes.length === 0 && (
              <p className="text-encre-55 text-sm">
                Aucune ligne pour l’instant. Commencez par une prestation.
              </p>
            )}
          </div>

          {!fige && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Bouton aspect="contour" onClick={() => ajoute('prestation')}>
                Ajouter une prestation
              </Bouton>
              <Bouton aspect="discret" onClick={() => ajoute('section')}>
                Ajouter un titre de section
              </Bouton>
              <Bouton aspect="discret" onClick={() => ajoute('texte')}>
                Ajouter une note
              </Bouton>
            </div>
          )}
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Les conditions</h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-encre text-sm font-semibold">Client</span>
              <select
                value={clientId ?? ''}
                disabled={fige}
                onChange={(e) => setClientId(e.target.value === '' ? null : e.target.value)}
                className="border-bordure bg-carte text-encre focus:border-or mt-1.5 min-h-12 w-full rounded-[var(--radius-douce)] border px-3 text-sm focus:outline-none disabled:opacity-60"
              >
                <option value="">Non rattaché</option>
                {devis.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nom}
                  </option>
                ))}
              </select>
            </label>

            <Champ
              etiquette="Remise globale (%)"
              type="number"
              min={0}
              max={100}
              disabled={fige}
              value={String(remisePourcent)}
              onChange={(e) => setRemise(Number(e.target.value))}
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Choix
              etiquette="Validité du devis"
              valeur={String(validiteJours)}
              fige={fige}
              options={VALIDITES.map((jours) => ({
                valeur: String(jours),
                libelle: `${String(jours)} jours`,
              }))}
              onChange={(valeur) => setValidite(Number(valeur) as ValiditeJours)}
            />
            <Choix
              etiquette="Acompte demandé"
              valeur={String(acomptePourcent)}
              fige={fige}
              options={ACOMPTES.map((part) => ({
                valeur: String(part),
                libelle: part === 0 ? 'Aucun' : `${String(part)} %`,
              }))}
              onChange={(valeur) => setAcompte(Number(valeur) as PourcentAcompte)}
            />
          </div>

          <div className="border-bordure mt-5 border-t pt-5">
            <p className="text-encre text-sm font-semibold">Les mentions obligatoires</p>
            <p className="text-encre-70 mt-1 text-sm">
              Elles figurent sur le document. Un devis de dépannage à domicile qui les omet expose
              l’artisan qui l’a signé.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Champ
                etiquette="Frais de déplacement (TTC)"
                type="number"
                min={0}
                disabled={fige}
                value={fraisDeplacementTTC === null ? '' : String(fraisDeplacementTTC)}
                onChange={(e) => setFrais(e.target.value === '' ? null : Number(e.target.value))}
                aide="Zéro est une réponse : « déplacement offert » est une mention."
              />
            </div>

            <div className="mt-4 space-y-3">
              <Case coche={devisPayant} fige={fige} onBascule={() => setPayant(!devisPayant)}>
                Ce devis est payant
              </Case>
              <Case
                coche={piecesRemplaceesGardees}
                fige={fige}
                onBascule={() => setPieces(!piecesRemplaceesGardees)}
              >
                Le client peut conserver les pièces remplacées
              </Case>
            </div>
          </div>
        </Carte>

        {!fige && (
          <div className="mt-7 flex flex-wrap gap-3">
            <Bouton aspect="contour" onClick={() => void sauvegarde()} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer le brouillon'}
            </Bouton>
            <Bouton
              aspect="or"
              taille="grand"
              onClick={() => void envoie()}
              disabled={enCours || !conformite.conforme}
              title={conformite.conforme ? undefined : 'Il manque des mentions obligatoires.'}
            >
              Envoyer au client
            </Bouton>
          </div>
        )}
      </div>

      {/* ── Totaux et conformité ───────────────────────────────────────── */}
      <div className="space-y-5 lg:sticky lg:top-6">
        <Carte className="p-5">
          <dl className="space-y-2 text-sm">
            <Ligne cle="Total hors taxes" valeur={formatEuros(totaux.totalBrutHT)} />
            {totaux.remiseHT > 0 && (
              <Ligne cle="Remise" valeur={`− ${formatEuros(totaux.remiseHT)}`} />
            )}
            {totaux.tva.map((tva) => (
              <Ligne
                key={tva.taux}
                cle={`TVA ${String(tva.taux)} %`}
                valeur={formatEuros(tva.montant)}
              />
            ))}
            <div className="border-bordure flex justify-between gap-3 border-t pt-3">
              <dt className="text-encre font-bold">Total TTC</dt>
              <dd className="text-encre font-[family-name:var(--font-titre)] text-2xl">
                {formatEuros(totaux.totalTTC)}
              </dd>
            </div>
            {totaux.acompteTTC > 0 && (
              <>
                <Ligne cle="Acompte à la signature" valeur={formatEuros(totaux.acompteTTC)} />
                <Ligne cle="Solde à la fin" valeur={formatEuros(totaux.soldeTTC)} />
              </>
            )}
          </dl>
        </Carte>

        <Carte className="p-5">
          <p className="text-encre text-sm font-bold">
            {conformite.conforme ? 'Devis conforme' : 'Mentions manquantes'}
          </p>
          {conformite.conforme ? (
            <p className="text-succes mt-2 text-sm font-semibold">
              ✓ Toutes les mentions obligatoires y sont.
            </p>
          ) : (
            <ul className="text-encre-70 mt-3 space-y-2 text-sm">
              {conformite.manquants.map((manque) => (
                <li key={manque} className="flex gap-2">
                  <span aria-hidden="true" className="text-alerte shrink-0 font-bold">
                    ·
                  </span>
                  <span>{manque}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}

function Ligne({ cle, valeur }: { readonly cle: string; readonly valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-encre-55">{cle}</dt>
      <dd className="text-encre font-semibold">{valeur}</dd>
    </div>
  );
}

function Choix({
  etiquette,
  valeur,
  options,
  fige,
  onChange,
}: {
  readonly etiquette: string;
  readonly valeur: string;
  readonly options: readonly { readonly valeur: string; readonly libelle: string }[];
  readonly fige: boolean;
  readonly onChange: (valeur: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-encre text-sm font-semibold">{etiquette}</span>
      <select
        value={valeur}
        disabled={fige}
        onChange={(e) => onChange(e.target.value)}
        className="border-bordure bg-carte text-encre focus:border-or mt-1.5 min-h-12 w-full rounded-[var(--radius-douce)] border px-3 text-sm focus:outline-none disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

function Case({
  coche,
  fige,
  onBascule,
  children,
}: {
  readonly coche: boolean;
  readonly fige: boolean;
  readonly onBascule: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={coche}
        disabled={fige}
        onChange={onBascule}
        className="accent-or size-4.5 shrink-0"
      />
      <span className="text-encre">{children}</span>
    </label>
  );
}

function LigneEditable({
  ligne,
  rang,
  total,
  fige,
  onChange,
  onRetire,
  onDeplace,
}: {
  readonly ligne: Brouillon;
  readonly rang: number;
  readonly total: number;
  readonly fige: boolean;
  readonly onChange: (champs: Partial<Brouillon>) => void;
  readonly onRetire: () => void;
  readonly onDeplace: (pas: -1 | 1) => void;
}) {
  const chiffree = ligne.type === 'prestation';

  return (
    <div
      className={cn(
        'border-bordure rounded-[var(--radius-douce)] border p-4',
        ligne.type === 'section' && 'bg-creme',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {ligne.type === 'texte' ? (
            // Une note est de la prose : un champ d'une ligne en cache la fin au moment même
            // où on l'écrit.
            <ZoneTexte
              etiquette={`Note ${String(rang + 1)}`}
              rows={3}
              maxLength={500}
              value={ligne.designation}
              disabled={fige}
              onChange={(e) => onChange({ designation: e.target.value })}
            />
          ) : (
            <Champ
              etiquette={
                ligne.type === 'section'
                  ? `Titre de section ${String(rang + 1)}`
                  : `Désignation ${String(rang + 1)}`
              }
              value={ligne.designation}
              disabled={fige}
              onChange={(e) => onChange({ designation: e.target.value })}
            />
          )}
        </div>
        {!fige && (
          <div className="flex shrink-0 gap-1 pt-7">
            <button
              type="button"
              onClick={() => onDeplace(-1)}
              disabled={rang === 0}
              aria-label={`Monter la ligne ${String(rang + 1)}`}
              className="text-encre-55 hover:text-encre min-h-11 px-2 text-sm font-bold disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onDeplace(1)}
              disabled={rang === total - 1}
              aria-label={`Descendre la ligne ${String(rang + 1)}`}
              className="text-encre-55 hover:text-encre min-h-11 px-2 text-sm font-bold disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRetire}
              className="text-encre-55 hover:text-alerte min-h-11 px-2 text-sm font-semibold"
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      {chiffree && (
        <>
          <Champ
            className="mt-3"
            etiquette="Détail"
            value={ligne.detail}
            disabled={fige}
            onChange={(e) => onChange({ detail: e.target.value })}
            placeholder="Marque, référence, précision technique"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Champ
              etiquette="Quantité"
              type="number"
              min={0}
              step={0.5}
              disabled={fige}
              value={ligne.quantite === null ? '' : String(ligne.quantite)}
              onChange={(e) =>
                onChange({ quantite: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <label className="block">
              <span className="text-encre text-sm font-semibold">Unité</span>
              <select
                value={ligne.unite ?? ''}
                disabled={fige}
                onChange={(e) =>
                  onChange({ unite: e.target.value === '' ? null : (e.target.value as Unite) })
                }
                className="border-bordure bg-carte text-encre focus:border-or mt-1.5 min-h-12 w-full rounded-[var(--radius-douce)] border px-2.5 text-sm focus:outline-none disabled:opacity-60"
              >
                <option value="">—</option>
                {UNITES.map((unite) => (
                  <option key={unite} value={unite}>
                    {NOMS_UNITE[unite]}
                  </option>
                ))}
              </select>
            </label>
            <Champ
              etiquette="Prix unitaire HT"
              type="number"
              min={0}
              step={0.01}
              disabled={fige}
              value={ligne.prixUnitaireHT === null ? '' : String(ligne.prixUnitaireHT)}
              onChange={(e) =>
                onChange({
                  prixUnitaireHT: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <label className="block">
              <span className="text-encre text-sm font-semibold">TVA</span>
              <select
                value={ligne.tauxTva === null ? '' : String(ligne.tauxTva)}
                disabled={fige}
                onChange={(e) =>
                  onChange({
                    tauxTva: e.target.value === '' ? null : (Number(e.target.value) as TauxTva),
                  })
                }
                className="border-bordure bg-carte text-encre focus:border-or mt-1.5 min-h-12 w-full rounded-[var(--radius-douce)] border px-2.5 text-sm focus:outline-none disabled:opacity-60"
              >
                <option value="">—</option>
                {TAUX_TVA.map((taux) => (
                  <option key={taux} value={taux}>
                    {taux} %
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
