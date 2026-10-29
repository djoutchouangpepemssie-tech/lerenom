'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte, Champ, Liste, ZoneTexte } from '@lerenom/ui';
import type { ParametresDocumentsAffiches } from '@/lib/parametres-documents';

/**
 * Les mentions légales des devis et des factures.
 *
 * Un formulaire long, et assumé comme tel : chacun de ces champs est une mention qu'une
 * facture doit porter sous peine d'amende, et aucun ne peut être deviné à partir de SIRENE.
 * Le choix a donc été de tout demander une fois, ici, plutôt que de les réclamer un par un
 * au moment d'émettre — là où le professionnel veut facturer, pas remplir un formulaire.
 *
 * **Rien n'est obligatoire pour enregistrer.** Un professionnel qui ne connaît pas encore son
 * numéro de médiateur doit pouvoir sauver le reste et revenir. Le contrôle sérieux a lieu
 * avant l'émission d'une facture, où il nomme ce qui manque.
 *
 * Les champs sont regroupés par ce qu'ils servent, pas par la table qui les stocke :
 * l'identité, la TVA, l'assurance, la médiation, le règlement. Un artisan ne pense pas en
 * colonnes.
 */

function videSiBlanc(valeur: string): string | null {
  const propre = valeur.trim();
  return propre === '' ? null : propre;
}

/** Un nombre saisi, ou `null` si le champ est vide. Zéro reste zéro. */
function nombreSaisi(valeur: string): number | null {
  const propre = valeur.trim().replace(',', '.');
  if (propre === '') return null;
  const nombre = Number(propre);
  return Number.isFinite(nombre) ? nombre : null;
}

function texte(valeur: number | null): string {
  return valeur === null ? '' : String(valeur);
}

export function FormulaireDocuments({
  initial,
}: {
  readonly initial: ParametresDocumentsAffiches;
}) {
  const router = useRouter();

  const [formeJuridique, setFormeJuridique] = useState(initial.formeJuridique ?? '');
  const [capital, setCapital] = useState(texte(initial.capitalSocialEuros));
  const [registre, setRegistre] = useState(initial.immatriculationRegistre ?? '');
  const [lieu, setLieu] = useState(initial.immatriculationLieu ?? '');
  const [numeroTva, setNumeroTva] = useState(initial.numeroTva ?? '');
  const [franchiseTva, setFranchiseTva] = useState(initial.franchiseTva);
  const [assureur, setAssureur] = useState(initial.assuranceAssureur ?? '');
  const [contrat, setContrat] = useState(initial.assuranceContrat ?? '');
  const [couverture, setCouverture] = useState(initial.assuranceCouverture ?? '');
  const [mediateurNom, setMediateurNom] = useState(initial.mediateurNom ?? '');
  const [mediateurUrl, setMediateurUrl] = useState(initial.mediateurUrl ?? '');
  const [penalites, setPenalites] = useState(texte(initial.penalitesTauxAnnuel));
  const [delai, setDelai] = useState(String(initial.delaiPaiementJours));
  const [escompte, setEscompte] = useState(initial.escompte ?? '');
  const [conditions, setConditions] = useState(initial.conditionsGenerales ?? '');
  const [pied, setPied] = useState(initial.piedDePage ?? '');

  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  async function enregistreTout(): Promise<void> {
    setEnCours(true);
    setRefus(null);
    setEnregistre(false);
    try {
      const reponse = await fetch('/api/pro/documents', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          formeJuridique: videSiBlanc(formeJuridique),
          capitalSocialEuros: nombreSaisi(capital),
          immatriculationRegistre: registre === '' ? null : registre,
          immatriculationLieu: videSiBlanc(lieu),
          numeroTva: videSiBlanc(numeroTva),
          franchiseTva,
          assuranceAssureur: videSiBlanc(assureur),
          assuranceContrat: videSiBlanc(contrat),
          assuranceCouverture: videSiBlanc(couverture),
          mediateurNom: videSiBlanc(mediateurNom),
          mediateurUrl: videSiBlanc(mediateurUrl),
          penalitesTauxAnnuel: nombreSaisi(penalites),
          delaiPaiementJours: nombreSaisi(delai) ?? 30,
          escompte: videSiBlanc(escompte),
          conditionsGenerales: videSiBlanc(conditions),
          piedDePage: videSiBlanc(pied),
        }),
      });
      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(corps.erreur ?? 'Enregistrement impossible pour le moment.');
        return;
      }
      setEnregistre(true);
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void enregistreTout();
      }}
      className="grid max-w-3xl gap-6"
    >
      <Carte className="p-5">
        <h2 className="text-lg">Votre identité</h2>
        <p className="text-encre-70 mt-1 text-sm">
          Ces mentions ne figurent pas dans les registres publics : nous ne pouvons pas les deviner
          à votre place.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Champ
            etiquette="Forme juridique"
            aide="EI, micro-entreprise, SASU, SARL…"
            value={formeJuridique}
            onChange={(e) => setFormeJuridique(e.target.value)}
            maxLength={60}
          />
          <Champ
            etiquette="Capital social"
            aide="En euros. Sans objet pour une entreprise individuelle."
            inputMode="decimal"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
          />
          <Liste
            etiquette="Registre d’immatriculation"
            value={registre}
            onChange={(e) => setRegistre(e.target.value)}
          >
            <option value="">À préciser</option>
            <option value="rm">Répertoire des métiers (artisan)</option>
            <option value="rcs">Registre du commerce et des sociétés</option>
          </Liste>
          <Champ
            etiquette={registre === 'rcs' ? 'Ville du greffe' : 'Département d’immatriculation'}
            aide={
              registre === 'rcs'
                ? 'Celle du tribunal de commerce.'
                : 'Celui de votre chambre de métiers.'
            }
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            maxLength={80}
          />
        </div>
      </Carte>

      <Carte className="p-5">
        <h2 className="text-lg">TVA</h2>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={franchiseTva}
            onChange={(e) => setFranchiseTva(e.target.checked)}
            className="border-bordure accent-or mt-0.5 size-4 rounded"
          />
          <span>
            <span className="text-encre font-semibold">Je suis en franchise en base de TVA</span>
            <span className="text-encre-70 mt-0.5 block">
              Vos documents porteront « TVA non applicable, article 293 B du CGI » et n’auront pas
              besoin d’un numéro de TVA.
            </span>
          </span>
        </label>
        {!franchiseTva && (
          <Champ
            etiquette="Numéro de TVA intracommunautaire"
            aide="FR, puis onze caractères."
            className="mt-4"
            value={numeroTva}
            onChange={(e) => setNumeroTva(e.target.value)}
            maxLength={20}
          />
        )}
      </Carte>

      <Carte className="p-5">
        <h2 className="text-lg">Assurance professionnelle</h2>
        <p className="text-encre-70 mt-1 text-sm">
          {initial.batiment
            ? 'Vos métiers relèvent du bâtiment : l’assureur et la couverture géographique sont des mentions obligatoires de vos devis et de vos factures.'
            : 'Vos métiers ne l’exigent pas. Vous pouvez la mentionner : un client rassuré signe plus vite.'}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Champ
            etiquette="Assureur"
            value={assureur}
            onChange={(e) => setAssureur(e.target.value)}
            maxLength={120}
          />
          <Champ
            etiquette="Numéro de contrat"
            value={contrat}
            onChange={(e) => setContrat(e.target.value)}
            maxLength={60}
          />
          <Champ
            etiquette="Couverture géographique"
            aide="« France métropolitaine », « Île-de-France »… Le client doit savoir où vous êtes couvert."
            className="sm:col-span-2"
            value={couverture}
            onChange={(e) => setCouverture(e.target.value)}
            maxLength={160}
          />
        </div>
      </Carte>

      <Carte className="p-5">
        <h2 className="text-lg">Médiation de la consommation</h2>
        <p className="text-encre-70 mt-1 text-sm">
          Obligatoire dès que vous facturez un particulier. Vous devez adhérer à un médiateur et
          l’indiquer sur vos documents.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Champ
            etiquette="Nom du médiateur"
            value={mediateurNom}
            onChange={(e) => setMediateurNom(e.target.value)}
            maxLength={120}
          />
          <Champ
            etiquette="Site du médiateur"
            aide="Le client doit pouvoir le saisir sans appeler personne."
            value={mediateurUrl}
            onChange={(e) => setMediateurUrl(e.target.value)}
            maxLength={200}
          />
        </div>
      </Carte>

      <Carte className="p-5">
        <h2 className="text-lg">Règlement</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Champ
            etiquette="Délai de paiement"
            aide="En jours à compter de l’émission. Trente par défaut, comme la loi."
            inputMode="numeric"
            value={delai}
            onChange={(e) => setDelai(e.target.value)}
          />
          <Champ
            etiquette="Taux annuel des pénalités de retard"
            aide="En %. Laissez vide pour le taux légal — vos factures imprimeront alors la formule de la BCE, qui reste juste quand le taux change."
            inputMode="decimal"
            value={penalites}
            onChange={(e) => setPenalites(e.target.value)}
          />
          <ZoneTexte
            etiquette="Conditions d’escompte"
            aide="Facultatif : une réduction en cas de paiement anticipé."
            className="sm:col-span-2"
            rows={2}
            value={escompte}
            onChange={(e) => setEscompte(e.target.value)}
            maxLength={400}
          />
        </div>
      </Carte>

      <Carte className="p-5">
        <h2 className="text-lg">Bas de vos documents</h2>
        <div className="mt-5 grid gap-4">
          <ZoneTexte
            etiquette="Conditions générales"
            aide="Elles s’impriment au bas de chaque devis et de chaque facture."
            rows={5}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            maxLength={4000}
          />
          <ZoneTexte
            etiquette="Pied de page"
            aide="Une ligne ou deux, centrées : votre site, un remerciement."
            rows={2}
            value={pied}
            onChange={(e) => setPied(e.target.value)}
            maxLength={400}
          />
        </div>
      </Carte>

      {refus !== null && (
        <p role="alert" className="text-erreur text-sm font-medium">
          {refus}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
        {enregistre && (
          <p role="status" className="text-encre-70 text-sm font-semibold">
            Enregistré. Vos prochains documents en tiendront compte.
          </p>
        )}
      </div>
    </form>
  );
}
