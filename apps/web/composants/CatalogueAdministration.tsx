'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EtatCatalogue,
  LigneCatalogue,
  NiveauCatalogue,
} from '@/lib/administration-catalogue';

/**
 * Le catalogue, à relire.
 *
 * **Un seul tableau à la fois**, comme l'impose la règle de mise en page : trois onglets, et
 * jamais deux listes côte à côte. Quatre cent soixante-dix-neuf prestations ne se lisent pas
 * en parallèle d'autre chose.
 *
 * **Le filtre « à valider seulement » est actif par défaut.** C'est le travail du jour ; voir
 * d'abord ce qui est déjà relu serait voir d'abord ce qui ne demande rien. Un second bouton
 * montre tout, pour corriger un nom déjà validé.
 *
 * **Chaque ligne se valide seule.** Un bouton « tout valider » viderait le compteur sans que
 * rien n'ait été lu — et ce compteur est la seule trace de ce qui reste à faire. Le seul
 * raccourci offert est par univers, parce qu'on vient d'en parcourir le contenu.
 *
 * Le slug s'affiche mais ne se modifie pas : il vit dans des adresses déjà indexées. Le
 * montrer sert à reconnaître la ligne ; le rendre modifiable casserait des liens sans
 * prévenir.
 */

type Onglet = NiveauCatalogue;

const ONGLETS: readonly { readonly cle: Onglet; readonly libelle: string }[] = [
  { cle: 'univers', libelle: 'Univers' },
  { cle: 'metier', libelle: 'Métiers' },
  { cle: 'prestation', libelle: 'Prestations' },
];

export function CatalogueAdministration({ etat }: { readonly etat: EtatCatalogue }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>('univers');
  const [aValiderSeulement, setAValiderSeulement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ id: string; nom: string } | null>(null);

  const lignes = useMemo(() => {
    const source =
      onglet === 'univers' ? etat.univers : onglet === 'metier' ? etat.metiers : etat.prestations;
    const terme = recherche.trim().toLowerCase();
    return source.filter((ligne) => {
      if (aValiderSeulement && !ligne.aValider) return false;
      if (terme === '') return true;
      return (
        ligne.nom.toLowerCase().includes(terme) ||
        ligne.slug.includes(terme) ||
        (ligne.parent ?? '').toLowerCase().includes(terme)
      );
    });
  }, [onglet, etat, aValiderSeulement, recherche]);

  async function envoie(corps: unknown, cle: string): Promise<void> {
    setEnCours(cle);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/catalogue', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Modification impossible.');
        return;
      }
      setEdition(null);
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(null);
    }
  }

  const restant =
    onglet === 'univers'
      ? etat.aValider.univers
      : onglet === 'metier'
        ? etat.aValider.metiers
        : etat.aValider.prestations;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Niveau du catalogue" className="flex gap-1">
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aValiderSeulement}
              onChange={(e) => setAValiderSeulement(e.target.checked)}
              className="size-4"
            />
            À valider seulement
          </label>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher…"
            aria-label="Chercher dans le catalogue"
            className="rounded-[8px] border border-[#cfcfc9] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#16181D]"
          />
        </div>
      </div>

      {refus !== null && (
        <p role="alert" className="mt-3 text-sm font-medium text-[#8c1c1c]">
          {refus}
        </p>
      )}

      <p className="mt-3 text-sm text-[#6b6b66]">
        {lignes.length.toLocaleString('fr-FR')} ligne{lignes.length > 1 ? 's' : ''} affichée
        {lignes.length > 1 ? 's' : ''} · {restant.toLocaleString('fr-FR')} à valider à ce niveau.
      </p>

      <div className="mt-3 overflow-x-auto rounded-[12px] border border-[#dcdcd8] bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#dcdcd8] text-left">
              <th className="px-4 py-2.5 font-semibold">Nom</th>
              <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Rattaché à</th>
              <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Identifiant d’adresse</th>
              <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <Ligne
                key={ligne.id}
                ligne={ligne}
                niveau={onglet}
                edition={edition}
                setEdition={setEdition}
                enCours={enCours}
                envoie={envoie}
              />
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[#6b6b66] italic">
                  {aValiderSeulement
                    ? 'Rien à valider à ce niveau. Décochez le filtre pour voir le reste.'
                    : 'Aucune ligne ne correspond.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Ligne({
  ligne,
  niveau,
  edition,
  setEdition,
  enCours,
  envoie,
}: {
  readonly ligne: LigneCatalogue;
  readonly niveau: NiveauCatalogue;
  readonly edition: { id: string; nom: string } | null;
  readonly setEdition: (valeur: { id: string; nom: string } | null) => void;
  readonly enCours: string | null;
  readonly envoie: (corps: unknown, cle: string) => Promise<void>;
}) {
  const enEdition = edition?.id === ligne.id;
  const occupe = enCours === ligne.id;

  const bouton =
    'rounded-[6px] border border-[#cfcfc9] px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';

  return (
    <tr className={`border-b border-[#eceae6] last:border-0 ${ligne.masque ? 'opacity-55' : ''}`}>
      <td className="px-4 py-2.5">
        {enEdition ? (
          <input
            type="text"
            value={edition.nom}
            aria-label={`Nom de ${ligne.nom}`}
            onChange={(e) => setEdition({ id: ligne.id, nom: e.target.value })}
            className="w-full rounded-[6px] border border-[#16181D] px-2 py-1 text-sm outline-none"
          />
        ) : (
          // `inline-flex` et `whitespace-nowrap` sur les étiquettes : sans eux, « à valider »
          // se coupait en deux au milieu d'un nom long, et l'écran donnait l'impression d'un
          // défaut de rendu plutôt que d'une information.
          <span className="inline-flex flex-wrap items-center gap-2 font-medium">
            {ligne.nom}
            {ligne.aValider && (
              <span className="rounded-[4px] bg-[#fdf0e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8a5a16]">
                à valider
              </span>
            )}
            {ligne.masque && (
              <span className="rounded-[4px] bg-[#eceae6] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#5c5c56]">
                masqué
              </span>
            )}
            {ligne.batiment === true && (
              <span className="rounded-[4px] bg-[#e7eef0] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#1f5566]">
                bâtiment
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-[#6b6b66]">
        {ligne.parent ?? `${String(ligne.enfants ?? 0)} métiers`}
        {ligne.unite !== undefined && ` · ${ligne.unite}`}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-[#8a8a83]">{ligne.slug}</td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap justify-end gap-2">
          {enEdition ? (
            <>
              <button
                type="button"
                disabled={occupe}
                className={bouton}
                onClick={() => void envoie({ niveau, id: ligne.id, nom: edition.nom }, ligne.id)}
              >
                Enregistrer
              </button>
              <button type="button" className={bouton} onClick={() => setEdition(null)}>
                Annuler
              </button>
            </>
          ) : (
            <>
              {ligne.aValider && (
                <button
                  type="button"
                  disabled={occupe}
                  className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
                  onClick={() => void envoie({ niveau, id: ligne.id, aValider: false }, ligne.id)}
                >
                  Valider
                </button>
              )}
              {niveau === 'univers' && (
                <button
                  type="button"
                  disabled={occupe}
                  className={bouton}
                  title="Valide cet univers, ses métiers et leurs prestations."
                  onClick={() =>
                    void envoie({ action: 'valider-univers', universId: ligne.id }, ligne.id)
                  }
                >
                  Valider l’univers
                </button>
              )}
              <button
                type="button"
                className={bouton}
                onClick={() => setEdition({ id: ligne.id, nom: ligne.nom })}
              >
                Renommer
              </button>
              {niveau === 'univers' && (
                <button
                  type="button"
                  disabled={occupe}
                  className={bouton}
                  title="Rend l’assurance professionnelle obligatoire sur les devis et factures."
                  onClick={() =>
                    void envoie(
                      { niveau, id: ligne.id, batiment: ligne.batiment !== true },
                      ligne.id,
                    )
                  }
                >
                  {ligne.batiment === true ? 'Hors bâtiment' : 'Bâtiment'}
                </button>
              )}
              <button
                type="button"
                disabled={occupe}
                className={bouton}
                title={
                  ligne.masque
                    ? 'Le remet sur le site.'
                    : 'Le retire du site. Rien n’est supprimé : demandes et professionnels restent rattachés.'
                }
                onClick={() =>
                  void envoie({ niveau, id: ligne.id, masque: !ligne.masque }, ligne.id)
                }
              >
                {ligne.masque ? 'Réafficher' : 'Masquer'}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
