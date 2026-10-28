'use client';

import { useMemo, useState } from 'react';
import { Bouton, Carte, Champ, Jauge, Puce, cn } from '@lerenom/ui';
import { nombreDePages } from '@lerenom/core';
import type { PerimetreDuPro } from '@/lib/zones-pro';

function normalise(texte: string): string {
  return texte.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Les métiers et les villes d'un professionnel, modifiables.
 *
 * L'écran montre en permanence ce que la sélection produit : le nombre de pages, et la place
 * restante dans la formule. Un professionnel ne doit pas découvrir après coup qu'il a dépassé
 * son plafond — mais il n'est pas corrigé d'autorité non plus : c'est lui qui retire.
 *
 * Une ville verrouillée porte un emplacement payé ou une exclusivité en cours. Elle se voit,
 * elle se dit, et elle ne se décoche pas : la retirer laisserait un emplacement vendu sans
 * ville où l'honorer.
 */
export function FormulairePerimetre({ perimetre }: { readonly perimetre: PerimetreDuPro }) {
  const [metiers, setMetiers] = useState<readonly string[]>(
    perimetre.metiers.filter((metier) => metier.choisi).map((metier) => metier.slug),
  );
  const [principal, setPrincipal] = useState<string | null>(
    perimetre.metiers.find((metier) => metier.principal)?.slug ?? null,
  );
  const [villes, setVilles] = useState<readonly string[]>(
    perimetre.villes.filter((ville) => ville.choisie).map((ville) => ville.code),
  );

  const departements = useMemo(() => {
    const vus = new Map<string, string>();
    for (const ville of perimetre.villes) vus.set(ville.departementCode, ville.departementNom);
    return [...vus]
      .map(([code, nom]) => ({ code, nom }))
      .toSorted((a, b) => a.code.localeCompare(b.code));
  }, [perimetre.villes]);

  const universList = useMemo(() => {
    const vus = new Map<string, string>();
    for (const metier of perimetre.metiers) vus.set(metier.universSlug, metier.universNom);
    return [...vus].map(([slug, nom]) => ({ slug, nom }));
  }, [perimetre.metiers]);

  const [departementActif, setDepartementActif] = useState(departements[0]?.code ?? '');
  const [universActif, setUniversActif] = useState(universList[0]?.slug ?? '');
  const [recherche, setRecherche] = useState('');

  const [enregistrement, setEnregistrement] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const villesVisibles = useMemo(() => {
    const requete = normalise(recherche.trim());
    return perimetre.villes
      .filter((ville) =>
        requete === ''
          ? ville.departementCode === departementActif
          : normalise(ville.nom).includes(requete),
      )
      .slice(0, 80);
  }, [perimetre.villes, departementActif, recherche]);

  const metiersVisibles = useMemo(
    () => perimetre.metiers.filter((metier) => metier.universSlug === universActif),
    [perimetre.metiers, universActif],
  );

  const pages = nombreDePages(villes.length, metiers.length);
  const plafond = perimetre.villesMax;
  const depasse = plafond !== null && villes.length > plafond;

  function basculeMetier(slug: string) {
    setMetiers((actuels) => {
      const suivant = actuels.includes(slug)
        ? actuels.filter((s) => s !== slug)
        : [...actuels, slug];
      if (principal === slug && !suivant.includes(slug)) setPrincipal(suivant[0] ?? null);
      if (principal === null && suivant.length > 0) setPrincipal(suivant[0] ?? null);
      return suivant;
    });
  }

  function basculeVille(code: string, verrouillee: boolean) {
    if (verrouillee) return;
    setVilles((actuelles) =>
      actuelles.includes(code) ? actuelles.filter((c) => c !== code) : [...actuelles, code],
    );
  }

  async function enregistre(): Promise<void> {
    setEnregistrement(true);
    setRefus(null);
    setSucces(null);
    try {
      const reponse = await fetch('/api/pro/perimetre', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ metiers, metierPrincipal: principal, villes }),
      });
      if (reponse.ok) {
        const corps = (await reponse.json()) as { nombreDePages: number };
        setSucces(
          `Votre périmètre est enregistré : vous apparaissez désormais sur ${String(corps.nombreDePages)} pages.`,
        );
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Votre périmètre n’a pas pu être enregistré.');
    } catch {
      setRefus(
        'Nous n’avons pas pu joindre nos serveurs. Votre sélection est conservée : réessayez dans un instant.',
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="min-w-0">
        {succes !== null && (
          <p
            role="status"
            className="border-succes/25 bg-succes-fond text-succes mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
          >
            {succes}
          </p>
        )}
        {refus !== null && (
          <p
            role="alert"
            className="border-alerte/25 bg-alerte-fond text-alerte mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
          >
            {refus}
          </p>
        )}

        <Carte className="p-5">
          <h2 className="text-xl">Vos métiers</h2>
          <p className="text-encre-70 mt-2 text-sm">
            Vous ne recevrez que des demandes correspondant aux métiers cochés.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-[13rem_1fr]">
            <ul aria-label="Univers" className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
              {universList.map((univers) => (
                <li key={univers.slug}>
                  <button
                    type="button"
                    onClick={() => setUniversActif(univers.slug)}
                    aria-pressed={univers.slug === universActif}
                    className={cn(
                      'min-h-11 w-full rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                      univers.slug === universActif
                        ? 'bg-creme text-encre'
                        : 'text-encre-70 hover:bg-creme',
                    )}
                  >
                    {univers.nom}
                  </button>
                </li>
              ))}
            </ul>

            <div
              role="group"
              aria-label="Métiers de l’univers choisi"
              className="flex flex-wrap gap-2 self-start"
            >
              {metiersVisibles.map((metier) => (
                <Puce
                  key={metier.slug}
                  active={metiers.includes(metier.slug)}
                  onBascule={() => basculeMetier(metier.slug)}
                >
                  {metier.nom}
                </Puce>
              ))}
            </div>
          </div>

          {metiers.length > 0 && (
            <div className="border-bordure mt-6 border-t pt-5">
              <p className="text-encre text-sm font-semibold">Votre métier principal</p>
              <p className="text-encre-55 mt-1 text-xs">C’est celui qui nomme votre fiche.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {metiers.map((slug) => (
                  <Puce key={slug} active={principal === slug} onBascule={() => setPrincipal(slug)}>
                    {perimetre.metiers.find((m) => m.slug === slug)?.nom ?? slug}
                  </Puce>
                ))}
              </div>
            </div>
          )}
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Vos villes</h2>
          <p className="text-encre-70 mt-2 text-sm">
            Une page, c’est un métier dans une ville. Choisissez celles où vous intervenez
            réellement.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {departements.map((departement) => (
              <Puce
                key={departement.code}
                active={departement.code === departementActif && recherche.trim() === ''}
                onBascule={() => {
                  setDepartementActif(departement.code);
                  setRecherche('');
                }}
                compte={
                  perimetre.villes.filter(
                    (ville) =>
                      ville.departementCode === departement.code && villes.includes(ville.code),
                  ).length || undefined
                }
              >
                {departement.nom}
              </Puce>
            ))}
          </div>

          <Champ
            className="mt-5 max-w-sm"
            etiquette="Chercher une ville"
            placeholder="Nom de la ville"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />

          <ul
            aria-label="Villes du département choisi"
            className="mt-5 grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2"
          >
            {villesVisibles.map((ville) => {
              const choisie = villes.includes(ville.code);
              return (
                <li key={ville.code}>
                  <button
                    type="button"
                    onClick={() => basculeVille(ville.code, ville.verrouillee)}
                    aria-pressed={choisie}
                    disabled={ville.verrouillee}
                    title={
                      ville.verrouillee
                        ? 'Un emplacement payé ou une exclusivité y est en cours : écrivez-nous pour y mettre fin.'
                        : undefined
                    }
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-douce)] border px-3 text-left text-sm transition-colors',
                      ville.verrouillee
                        ? 'border-or/40 bg-or/[0.07] text-encre cursor-not-allowed font-semibold'
                        : choisie
                          ? 'border-or bg-or/10 text-encre font-semibold'
                          : 'border-bordure text-encre-70 hover:border-or/50',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{ville.nom}</span>
                    {ville.verrouillee && (
                      <span className="text-or-fonce shrink-0 text-[0.6rem] font-bold tracking-wide uppercase">
                        Emplacement
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {villesVisibles.length === 0 && (
            <p className="text-encre-55 mt-4 text-sm">
              Aucune ville ne correspond à cette recherche.
            </p>
          )}
        </Carte>

        <div className="mt-7">
          <Bouton
            aspect="or"
            taille="grand"
            onClick={() => void enregistre()}
            disabled={enregistrement || depasse}
            title={depasse ? 'Retirez des villes pour revenir dans votre formule.' : undefined}
          >
            {enregistrement ? 'Enregistrement…' : 'Enregistrer mon périmètre'}
          </Bouton>
        </div>
      </div>

      <Carte className="p-5 lg:sticky lg:top-6">
        {/* Sans plafond, pas de jauge : une barre pleine annoncerait une limite atteinte là
            où il n'y en a aucune. */}
        {plafond === null ? (
          <div>
            <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Villes
            </p>
            <p className="text-encre mt-1 font-[family-name:var(--font-titre)] text-2xl">
              {villes.length}
            </p>
            <p className="text-encre-70 mt-1 text-sm">Sans limite en Exclusif.</p>
          </div>
        ) : (
          <Jauge
            valeur={villes.length}
            maximum={plafond}
            etiquette="Villes"
            detail={`${String(villes.length)} sur ${String(plafond)} en ${perimetre.formule}`}
            aspect={depasse ? 'alerte' : 'or'}
          />
        )}

        <dl className="border-bordure mt-5 space-y-2.5 border-t pt-5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-encre-55">Métiers</dt>
            <dd className="text-encre font-semibold">{metiers.length}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-encre-55">Villes</dt>
            <dd className="text-encre font-semibold">{villes.length}</dd>
          </div>
          <div className="border-bordure flex justify-between gap-3 border-t pt-3">
            <dt className="text-encre font-bold">Pages</dt>
            <dd className="text-encre font-[family-name:var(--font-titre)] text-2xl">{pages}</dd>
          </div>
        </dl>

        {depasse && plafond !== null && (
          <p className="bg-alerte-fond text-alerte mt-5 rounded-[var(--radius-douce)] px-3.5 py-3 text-sm font-semibold">
            {villes.length - plafond} ville{villes.length - plafond > 1 ? 's' : ''} de trop pour
            votre formule. Retirez-en, ou changez de formule — nous n’en retirerons aucune à votre
            place.
          </p>
        )}
      </Carte>
    </div>
  );
}
