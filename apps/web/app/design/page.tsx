'use client';

import { useState } from 'react';
import {
  Accent,
  Anneau,
  Apparition,
  BadgePayant,
  BandeauDefilant,
  BarreCollante,
  BarrePuces,
  Bouton,
  Carte,
  Champ,
  CielEtoile,
  Chiffre,
  Compteur,
  Conteneur,
  Epingle,
  Jauge,
  ListeBadgesMerite,
  Liste,
  MentionSponsorise,
  Minuteur,
  Modale,
  Note,
  Onglets,
  Puce,
  SceauExclusivite,
  Section,
  Tiroir,
  TitreSection,
  ToitsDeParis,
  ZoneTexte,
} from '@lerenom/ui';
import {
  FORMULES,
  PARAMETRES_PAR_DEFAUT,
  REGLES_VALIDEES,
  classePageResultats,
  etatForfait,
  expliqueRang,
  formatEuros,
  prixAnnuelHT,
} from '@lerenom/core';
import type { CandidatClassement } from '@lerenom/core';
import type { Merite } from '@lerenom/ui';

/* --------------------------------------------------------------------------- */
/* Jetons, pour la planche de couleurs                                          */
/* --------------------------------------------------------------------------- */

const COULEURS: readonly { nom: string; jeton: string; valeur: string; clair?: boolean }[] = [
  { nom: 'Encre', jeton: 'encre', valeur: '#16181D', clair: true },
  { nom: 'Nuit', jeton: 'nuit', valeur: '#0F1115', clair: true },
  { nom: 'Or', jeton: 'or', valeur: '#C9A24D' },
  { nom: 'Or clair', jeton: 'or-clair', valeur: '#E2C27A' },
  { nom: 'Or foncé', jeton: 'or-fonce', valeur: '#8A6A1F', clair: true },
  { nom: 'Crème', jeton: 'creme', valeur: '#F6F4EE' },
  { nom: 'Carte', jeton: 'carte', valeur: '#FFFFFF' },
  { nom: 'Bordure', jeton: 'bordure', valeur: '#E7E3D8' },
];

const ETATS: readonly { nom: string; texte: string; fond: string; valeurs: string }[] = [
  { nom: 'Succès', texte: 'text-succes', fond: 'bg-succes-fond', valeurs: '#2F6B47 sur #EAF5EE' },
  { nom: 'Alerte', texte: 'text-alerte', fond: 'bg-alerte-fond', valeurs: '#8A5B0B sur #FBF3E1' },
  { nom: 'Erreur', texte: 'text-erreur', fond: 'bg-erreur-fond', valeurs: '#A3321F sur #FBEDEA' },
];

const METIERS_BANDEAU = [
  'Plombier',
  'Électricien',
  'Serrurier',
  'Peintre',
  'Couvreur',
  'Chauffagiste',
  'Nettoyage de canapé',
  'Ménage à domicile',
  'Déménageur',
  'Jardinier',
  'Dératisation',
  'Vitrier',
  'Carreleur',
  'Menuisier',
  'Nettoyage de voiture',
];

/** Les 7 plombiers de référence de Paris 11e (cahier des charges §19). */
const PLOMBIERS: readonly (CandidatClassement & { nom: string; avis: number })[] = [
  {
    entrepriseId: 'martin',
    nom: 'Plomberie Martin',
    formule: 'exclusif',
    score: 0.92,
    note: 4.9,
    avis: 212,
    titulaireExclusivite: true,
  },
  {
    entrepriseId: 'dupont',
    nom: 'Dupont Plomberie',
    formule: 'premium',
    score: 0.88,
    note: 4.8,
    avis: 126,
  },
  {
    entrepriseId: 'roche',
    nom: 'Atelier Roche',
    formule: 'premium',
    score: 0.84,
    note: 4.7,
    avis: 84,
  },
  {
    entrepriseId: 'sos',
    nom: 'SOS Fuite 11',
    formule: 'essentiel',
    score: 0.79,
    note: 4.6,
    avis: 58,
  },
  {
    entrepriseId: 'hydro',
    nom: 'Hydro Services',
    formule: 'essentiel',
    score: 0.71,
    note: 4.4,
    avis: 40,
  },
  {
    entrepriseId: 'plombart',
    nom: 'Plomb’Art 11',
    formule: 'gratuit',
    score: 0.74,
    note: 4.5,
    avis: 31,
  },
  {
    entrepriseId: 'lefevre',
    nom: 'Lefèvre Sanitaire',
    formule: 'gratuit',
    score: 0.66,
    note: 4.3,
    avis: 19,
  },
];

// Cette page de démonstration affiche un minuteur, donc une valeur tirée de l'horloge au
// moment du rendu. Servie depuis un cache, elle finirait par montrer une heure plus vieille
// que celle que reçoit le navigateur, et React refuserait d'hydrater la page.
export const dynamic = 'force-dynamic';

export default function PageDesign() {
  const [filtres, setFiltres] = useState<readonly string[]>(['urgence']);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [raisonAffichee, setRaisonAffichee] = useState<string | null>(null);

  const page = classePageResultats(PLOMBIERS, PARAMETRES_PAR_DEFAUT, 0);
  const forfait = etatForfait('premium', 4, PARAMETRES_PAR_DEFAUT);
  // L'échéance est calculée à chaque requête. Sur une page mise en cache, une valeur tirée de
  // l'horloge au moment du rendu finit par différer de ce que le navigateur reçoit, et React
  // refuse d'hydrater : c'est pourquoi cette page est explicitement dynamique.
  const echeance = new Date(Date.now() + 27 * 60 * 1000);

  function bascule(cle: string) {
    setFiltres((actuels) =>
      actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle],
    );
  }

  return (
    <main>
      {/* --- Héros ------------------------------------------------------------ */}
      <header className="bg-nuit text-creme relative isolate overflow-hidden">
        {/* Les toits sont une bande posée en bas du héros, jamais un fond étiré. */}
        <CielEtoile className="absolute inset-x-0 top-0 -z-30 h-24 opacity-80" />
        <ToitsDeParis className="absolute inset-x-0 bottom-0 -z-20 opacity-70" />
        {/* Le voile garde les toits à l'état d'atmosphère : le texte passe avant l'illustration. */}
        <div className="from-nuit via-nuit/92 to-nuit/55 absolute inset-0 -z-10 bg-gradient-to-b" />

        <Conteneur className="relative pt-20 pb-52 md:pt-28 md:pb-64">
          <Apparition>
            <p className="text-or-clair flex items-center gap-2 text-[0.72rem] font-bold tracking-[0.2em] uppercase">
              <span className="bg-or size-1.5 rounded-full" />
              Le Renom · design system · phase 0
            </p>
          </Apparition>

          <Apparition index={1}>
            <h1 className="text-creme mt-5 max-w-[22ch] text-[clamp(2.4rem,7vw,4.5rem)]">
              L’annuaire qui a <Accent>de l’âme</Accent>.
            </h1>
          </Apparition>

          <Apparition index={2}>
            <p className="text-creme/75 mt-6 max-w-[58ch] text-[1.05rem] md:text-lg">
              Les jetons, les composants et les animations qui tiendront les 1 285 villes
              d’Île-de-France, les 4 rendus de fiche et le centre de distribution. Une seule source
              pour les couleurs, les polices et les durées : si l’identité bouge, elle bouge ici.
            </p>
          </Apparition>

          <Apparition index={3}>
            <div className="mt-9 flex flex-wrap gap-3">
              <Bouton aspect="or" taille="grand">
                Demander un devis
              </Bouton>
              <Bouton
                aspect="contour"
                taille="grand"
                className="border-creme/25 text-creme hover:border-or hover:bg-creme/5 bg-transparent"
              >
                Vous êtes artisan ?
              </Bouton>
            </div>
          </Apparition>

          <Apparition index={4}>
            <dl className="border-creme/10 bg-nuit/55 mt-14 grid grid-cols-2 gap-x-6 gap-y-8 rounded-[var(--radius-panneau)] border px-6 py-7 backdrop-blur-[2px] sm:grid-cols-4">
              <Chiffre
                clair
                valeur={<Compteur valeur={1285} />}
                libelle="villes et arrondissements"
              />
              <Chiffre
                clair
                valeur={<Compteur valeur={REGLES_VALIDEES.catalogueAnnonce.prestations} />}
                libelle="prestations au catalogue"
              />
              <Chiffre clair valeur={<Compteur valeur={8} />} libelle="départements couverts" />
              <Chiffre
                clair
                valeur={
                  <>
                    <Compteur valeur={3} /> max
                  </>
                }
                libelle="pros par demande"
              />
            </dl>
          </Apparition>
        </Conteneur>
      </header>

      <BandeauDefilant entrees={METIERS_BANDEAU} />

      {/* --- Couleurs --------------------------------------------------------- */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            surtitre="Jetons"
            titre={
              <>
                Une palette <Accent>chaleureuse</Accent>, jamais grise
              </>
            }
            chapeau="Les ombres elles-mêmes reprennent la couleur de l’encre. Chaque couleur d’état est déclarée avec son fond, pour que le contraste AA soit garanti par construction et non vérifié après coup."
          />

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COULEURS.map((couleur, index) => (
              <Apparition key={couleur.jeton} index={index}>
                <Carte className="overflow-hidden">
                  <div
                    className="border-bordure h-24 border-b"
                    style={{ backgroundColor: couleur.valeur }}
                  />
                  <div className="p-3.5">
                    <p className="text-encre text-sm font-bold">{couleur.nom}</p>
                    <p className="text-encre-55 mt-0.5 font-mono text-xs">{couleur.valeur}</p>
                    <p className="text-encre-40 mt-1 font-mono text-[0.68rem]">
                      --color-{couleur.jeton}
                    </p>
                  </div>
                </Carte>
              </Apparition>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {ETATS.map((etat, index) => (
              <Apparition key={etat.nom} index={index}>
                <div className={`rounded-[var(--radius-carte)] ${etat.fond} p-5`}>
                  <p className={`font-bold ${etat.texte}`}>{etat.nom}</p>
                  <p className={`mt-1 font-mono text-xs ${etat.texte} opacity-80`}>
                    {etat.valeurs}
                  </p>
                </div>
              </Apparition>
            ))}
          </div>
        </Conteneur>
      </Section>

      {/* --- Typographie ------------------------------------------------------ */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre="Typographie"
            titre={
              <>
                DM Serif Display et <Accent>Manrope</Accent>
              </>
            }
            chapeau="Les titres en serif portent l’éditorial, le texte en Manrope porte la lecture. Les polices sont auto-hébergées par next/font : aucun appel externe, aucun décalage de mise en page au chargement."
          />

          <div className="border-or/35 mt-10 space-y-7 border-l-2 pl-6">
            <div>
              <p className="text-encre-40 mb-2 font-mono text-xs">titre · clamp(2,4rem · 4,5rem)</p>
              <p className="font-[family-name:var(--font-titre)] text-[clamp(2.2rem,5.5vw,3.5rem)] leading-[1.1]">
                Trouvez le bon <em className="text-or-fonce">artisan</em> près de chez vous
              </p>
            </div>
            <div>
              <p className="text-encre-40 mb-2 font-mono text-xs">
                titre de section · clamp(1,75rem · 2,75rem)
              </p>
              <h3 className="text-[clamp(1.6rem,3.6vw,2.4rem)]">Plombiers à Paris 11e</h3>
            </div>
            <div>
              <p className="text-encre-40 mb-2 font-mono text-xs">texte courant · 1rem / 1,6</p>
              <p className="text-encre-70 max-w-[62ch]">
                Le Renom transmet votre demande à trois professionnels au maximum, jamais plus, et
                jamais après 72 heures. Les partenaires de Le Renom sont servis en priorité : c’est
                écrit sur le formulaire, parce que la loyauté des plateformes l’exige.
              </p>
            </div>
            <div>
              <p className="text-encre-40 mb-2 font-mono text-xs">mention légale · 0,8rem</p>
              <p className="text-encre-55 max-w-[72ch] text-[0.8rem]">
                Prix indicatifs TTC, à titre d’information. Seul un devis détaillé engage le
                professionnel.
              </p>
            </div>
          </div>
        </Conteneur>
      </Section>

      {/* --- Boutons ---------------------------------------------------------- */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            surtitre="Composants"
            titre={
              <>
                Des boutons qui <Accent>font</Accent> quelque chose
              </>
            }
            chapeau="Aucun bouton n’est décoratif. Quand une action est momentanément impossible, elle est désactivée avec la raison dans l’info-bulle, jamais masquée : l’utilisateur doit savoir qu’elle existe. Toutes les cibles font au moins 40 px de haut."
          />

          <Carte className="mt-10 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Bouton aspect="or">Demander un devis</Bouton>
              <Bouton aspect="encre">Créer ma fiche</Bouton>
              <Bouton aspect="contour">Voir la fiche</Bouton>
              <Bouton aspect="discret">Annuler</Bouton>
              <Bouton aspect="danger">Refuser la demande</Bouton>
            </div>

            <div className="border-bordure mt-6 flex flex-wrap items-end gap-3 border-t pt-6">
              <Bouton aspect="or" taille="petit">
                Petit
              </Bouton>
              <Bouton aspect="or" taille="moyen">
                Moyen
              </Bouton>
              <Bouton aspect="or" taille="grand">
                Grand
              </Bouton>
              <Bouton aspect="contour" chargement>
                Envoi en cours
              </Bouton>
              <Bouton
                aspect="contour"
                disabled
                title="Le devis doit porter les frais de déplacement et la durée de validité avant l’envoi."
              >
                Envoyer au client
              </Bouton>
            </div>

            <div className="border-bordure mt-6 border-t pt-6">
              <p className="text-encre mb-3 text-sm font-semibold">
                Barre d’action, telle qu’elle se colle en bas sur téléphone
              </p>
              <div className="border-bordure overflow-hidden rounded-[var(--radius-douce)] border">
                <BarreCollante className="static">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-encre truncate text-sm font-bold">3 pros sélectionnés</p>
                      <p className="text-encre-55 truncate text-xs">
                        Paris 11e · Recherche de fuite
                      </p>
                    </div>
                    <Bouton aspect="or">Demander des devis</Bouton>
                  </div>
                </BarreCollante>
              </div>
            </div>
          </Carte>
        </Conteneur>
      </Section>

      {/* --- Badges ----------------------------------------------------------- */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre="Badges"
            titre={
              <>
                Deux familles qui ne se mélangent <Accent>jamais</Accent>
              </>
            }
            chapeau="Ce n’est pas une règle de style : un badge payant présenté comme une garantie de qualité serait une pratique commerciale trompeuse. D’où deux composants distincts, deux jeux de types distincts, et aucun moyen de passer un libellé de mérite à un badge payant."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Carte className="p-6">
              <h3 className="text-xl">Badges payants</h3>
              <p className="text-encre-70 mt-2 text-sm">
                Ils disent qu’une offre est souscrite, rien de plus. Chacun porte une info-bulle qui
                le précise. Aucun mot comme « Recommandé », « Meilleur » ou « Certifié » ne leur est
                jamais associé.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <BadgePayant formule="essentiel" />
                <BadgePayant formule="premium" />
                <BadgePayant formule="exclusif" />
              </div>
              <div className="mt-4">
                <SceauExclusivite zone="Paris 11e" />
              </div>
              <div className="border-bordure mt-5 border-t pt-4">
                <MentionSponsorise onPourquoi={() => setModaleOuverte(true)} />
              </div>
            </Carte>

            <Carte className="p-6">
              <h3 className="text-xl">Badges de mérite</h3>
              <p className="text-encre-70 mt-2 text-sm">
                Gratuits, accessibles à toutes les fiches y compris gratuites, calculés à partir de
                critères publiés. L’info-bulle donne le critère exact : c’est ce qui les distingue
                d’une mention commerciale.
              </p>
              <ListeBadgesMerite
                className="mt-5"
                merites={
                  [
                    'entreprise-verifiee',
                    'siret-verifie',
                    'decennale-verifiee',
                    'tres-bien-note',
                    'repond-vite',
                    'avis-verifies',
                  ] as readonly Merite[]
                }
              />
              <div className="border-bordure mt-5 flex flex-wrap items-center gap-4 border-t pt-4">
                <Note note={4.9} nombreAvis={212} taille="grande" />
                <Note note={4.3} nombreAvis={19} />
                <Note note={null} />
              </div>
            </Carte>
          </div>
        </Conteneur>
      </Section>

      {/* --- Page de résultats ------------------------------------------------ */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            surtitre="Moteur de résultats"
            titre={
              <>
                Trois places payées, puis le <Accent>classement naturel</Accent>
              </>
            }
            chapeau="Cette liste n’est pas une maquette : elle est classée par classePageResultats de packages/core, avec les 7 plombiers de référence de Paris 11e. La place 1 revient au titulaire de l’exclusivité, les places 2 et 3 aux Premium en rotation équitable, et le séparateur marque l’endroit où l’argent s’arrête."
          />

          <BarrePuces etiquette="Filtres de la page de résultats" className="mt-9">
            {[
              { cle: 'urgence', libelle: 'Intervient en urgence' },
              { cle: 'aujourdhui', libelle: 'Disponible aujourd’hui', compte: 4 },
              { cle: 'note', libelle: 'Note de 4,5 et plus', compte: 5 },
              { cle: 'partenaires', libelle: 'Partenaires Le Renom', compte: 3 },
              { cle: 'decennale', libelle: 'Décennale vérifiée' },
            ].map((filtre) => (
              <Puce
                key={filtre.cle}
                active={filtres.includes(filtre.cle)}
                onBascule={() => bascule(filtre.cle)}
                {...(filtre.compte !== undefined ? { compte: filtre.compte } : {})}
              >
                {filtre.libelle}
              </Puce>
            ))}
          </BarrePuces>

          <ol className="mt-7 space-y-3">
            {page.lignes.map((ligne, index) => {
              const pro = PLOMBIERS.find((p) => p.entrepriseId === ligne.entrepriseId)!;
              const estExclusif = ligne.raison === 'emplacement-exclusif';

              return (
                <li key={ligne.entrepriseId}>
                  {index === page.dernierRangSponsorise && page.dernierRangSponsorise > 0 && (
                    <div className="mb-4 flex items-center gap-4">
                      <span className="bg-bordure h-px flex-1" />
                      <span className="text-encre-55 text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                        Classement naturel
                      </span>
                      <span className="bg-bordure h-px flex-1" />
                    </div>
                  )}

                  <Apparition index={index}>
                    <Carte
                      survolable
                      sombre={estExclusif}
                      liseréOr={ligne.raison === 'emplacement-premium'}
                      className="p-4 md:p-5"
                    >
                      <div className="flex items-start gap-4">
                        <Epingle
                          variante={
                            estExclusif
                              ? 'couronne'
                              : ligne.raison === 'emplacement-premium'
                                ? 'or'
                                : 'standard'
                          }
                          retardMs={index * 70}
                          className="mt-0.5 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-[family-name:var(--font-titre)] text-lg md:text-xl ${estExclusif ? 'text-creme' : 'text-encre'}`}
                            >
                              {pro.nom}
                            </span>
                            {pro.formule !== 'gratuit' && <BadgePayant formule={pro.formule} />}
                          </div>

                          <div
                            className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${estExclusif ? 'text-creme/70' : ''}`}
                          >
                            <Note
                              note={pro.note}
                              nombreAvis={pro.avis}
                              taille="petite"
                              clair={estExclusif}
                            />
                            <span
                              className={`text-xs ${estExclusif ? 'text-creme/55' : 'text-encre-55'}`}
                            >
                              Paris 11e · 1,2 km
                            </span>
                          </div>

                          {ligne.sponsorise && (
                            <div className="mt-2.5">
                              <MentionSponsorise
                                className={
                                  estExclusif
                                    ? '[&_span]:border-creme/20 [&_span]:bg-creme/10 [&_span]:text-creme/80 [&_button]:text-creme/65'
                                    : ''
                                }
                                onPourquoi={() => setRaisonAffichee(expliqueRang(ligne))}
                              />
                            </div>
                          )}
                        </div>

                        <div className="hidden shrink-0 sm:block">
                          <Bouton aspect={estExclusif ? 'or' : 'contour'} taille="petit">
                            Demander un devis
                          </Bouton>
                        </div>
                      </div>
                    </Carte>
                  </Apparition>
                </li>
              );
            })}
          </ol>
        </Conteneur>
      </Section>

      {/* --- Formules --------------------------------------------------------- */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre="Formules"
            titre={
              <>
                Les prix viennent des <Accent>règles validées</Accent>
              </>
            }
            chapeau="Aucun prix n’est écrit dans cette page : tout vient de packages/core. Changer un tarif se fait à un seul endroit, et des tests échouent si une valeur validée bouge sans décision d’Arcel."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FORMULES.map((formule, index) => {
              const prix = REGLES_VALIDEES.prixMensuelHT[formule];
              const villes = REGLES_VALIDEES.villesMax[formule];
              const incluses = REGLES_VALIDEES.demandesIncluses[formule];
              const urgence = REGLES_VALIDEES.prixDemandeUrgente[formule];
              const estExclusif = formule === 'exclusif';

              return (
                <Apparition key={formule} index={index}>
                  <Carte
                    sombre={estExclusif}
                    liseréOr={formule === 'premium'}
                    className="flex h-full flex-col p-6"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-xl capitalize ${estExclusif ? 'text-creme' : 'text-encre'}`}
                      >
                        {formule}
                      </h3>
                      {formule !== 'gratuit' && <BadgePayant formule={formule} sansInfoBulle />}
                    </div>

                    <p className="mt-4 flex items-baseline gap-1.5">
                      <span
                        className={`font-[family-name:var(--font-titre)] text-4xl ${estExclusif ? 'text-or-clair' : 'text-encre'}`}
                      >
                        {prix}
                      </span>
                      <span
                        className={`text-sm ${estExclusif ? 'text-creme/60' : 'text-encre-55'}`}
                      >
                        € HT / mois
                      </span>
                    </p>
                    {prix > 0 && (
                      <p
                        className={`mt-1 text-xs ${estExclusif ? 'text-creme/50' : 'text-encre-55'}`}
                      >
                        {formatEuros(prixAnnuelHT(formule))} HT en annuel · 2 mois offerts
                      </p>
                    )}

                    <ul
                      className={`mt-5 space-y-2.5 text-sm ${estExclusif ? 'text-creme/80' : 'text-encre-70'}`}
                    >
                      <li className="flex gap-2">
                        <span className="text-or">·</span>
                        {villes === null ? 'Toutes les villes qu’il souhaite' : `${villes} villes`}
                      </li>
                      <li className="flex gap-2">
                        <span className="text-or">·</span>
                        {incluses > 0
                          ? `${incluses} demandes incluses, puis ${formatEuros(REGLES_VALIDEES.prixDemandePartagee[formule])}`
                          : `Demande partagée à ${formatEuros(REGLES_VALIDEES.prixDemandePartagee[formule])}`}
                      </li>
                      <li className="flex gap-2">
                        <span className="text-or">·</span>
                        {urgence === null
                          ? 'Pas d’accès aux urgences'
                          : `Urgence à ${formatEuros(urgence)}`}
                      </li>
                      <li className="flex gap-2">
                        <span className="text-or">·</span>
                        {REGLES_VALIDEES.agencesMax[formule] === null
                          ? 'Agences illimitées'
                          : `${REGLES_VALIDEES.agencesMax[formule]} agence${(REGLES_VALIDEES.agencesMax[formule] ?? 0) > 1 ? 's' : ''}`}
                      </li>
                    </ul>

                    <div className="mt-auto pt-6">
                      <Bouton
                        aspect={estExclusif ? 'or' : formule === 'premium' ? 'encre' : 'contour'}
                        pleineLargeur
                      >
                        {prix === 0 ? 'Créer ma fiche' : 'Choisir cette formule'}
                      </Bouton>
                    </div>
                  </Carte>
                </Apparition>
              );
            })}
          </div>
        </Conteneur>
      </Section>

      {/* --- Espace pro ------------------------------------------------------- */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            surtitre="Espace pro et back-office"
            titre={
              <>
                Jauges, anneaux, minuteurs et <Accent>onglets</Accent>
              </>
            }
            chapeau="La règle de mise en page du back-office est tenue par le composant : 4 indicateurs au maximum, puis des onglets, un seul tableau visible à la fois. Chaque jauge porte une valeur accessible — la couleur seule ne dit pas « 80 % de votre forfait »."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <Carte className="p-6">
              <Onglets
                etiquette="Démonstration des onglets du back-office"
                onglets={[
                  {
                    cle: 'distribution',
                    libelle: 'Distribution',
                    compte: 3,
                    contenu: (
                      <div className="space-y-3">
                        {[
                          {
                            nom: 'Plomberie Martin',
                            rang: 1,
                            raison: 'Exclusif de la zone',
                            etat: 'en-cours' as const,
                          },
                          {
                            nom: 'Atelier Roche',
                            rang: 2,
                            raison: 'Premium le moins servi ce mois',
                            etat: 'attente' as const,
                          },
                          {
                            nom: 'Dupont Plomberie',
                            rang: 3,
                            raison: 'Premium le moins servi ce mois',
                            etat: 'attente' as const,
                          },
                        ].map((pro) => (
                          <div
                            key={pro.nom}
                            className="border-bordure bg-creme flex flex-wrap items-center gap-3 rounded-[var(--radius-douce)] border px-4 py-3"
                          >
                            <span className="bg-encre text-creme flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                              {pro.rang}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-encre truncate text-sm font-bold">{pro.nom}</p>
                              <p className="text-encre-55 truncate text-xs">{pro.raison}</p>
                            </div>
                            {pro.etat === 'en-cours' ? (
                              <Minuteur echeance={echeance} />
                            ) : (
                              <span className="bg-encre/[0.06] text-encre-55 rounded-full px-2.5 py-1 text-xs font-semibold">
                                En attente du tour 2
                              </span>
                            )}
                          </div>
                        ))}
                        <p className="text-encre-55 pt-1 text-xs">
                          L’Exclusif reçoit la demande seul pendant 30 minutes. Passé ce délai, ou
                          s’il refuse, les Premium reçoivent la demande.
                        </p>
                      </div>
                    ),
                  },
                  {
                    cle: 'pros',
                    libelle: 'Pros et zone',
                    compte: 2,
                    contenu: (
                      <div className="space-y-2.5">
                        {[
                          {
                            nom: 'Hydro Services',
                            raison: 'Hors zone : 6,7 km pour un rayon de 4,0 km',
                          },
                          {
                            nom: 'Plomb’Art 11',
                            raison: 'S’est déclaré indisponible sur cette période',
                          },
                        ].map((ecarte) => (
                          <div
                            key={ecarte.nom}
                            className="border-alerte/25 bg-alerte-fond rounded-[var(--radius-douce)] border px-4 py-3"
                          >
                            <p className="text-alerte text-sm font-bold">{ecarte.nom}</p>
                            <p className="text-alerte/85 mt-0.5 text-xs">{ecarte.raison}</p>
                          </div>
                        ))}
                        <p className="text-encre-55 pt-1 text-xs">
                          Chaque pro écarté l’est avec sa raison, pour qu’une demande sans preneur
                          se comprenne sans ouvrir la base.
                        </p>
                      </div>
                    ),
                  },
                  {
                    cle: 'journal',
                    libelle: 'Journal',
                    contenu: (
                      <ul className="space-y-2.5 text-sm">
                        {[
                          [
                            '09:12',
                            'Demande vérifiée par SMS, classée « Plomberie › Recherche de fuite » (confiance 94 %)',
                          ],
                          [
                            '09:12',
                            'Envoi à Plomberie Martin — Exclusif de la zone, seul pendant 30 min',
                          ],
                          ['09:14', 'Ouverture de la demande par Plomberie Martin'],
                        ].map(([heure, texte]) => (
                          <li key={`${heure}-${texte}`} className="flex gap-3">
                            <span className="text-encre-40 shrink-0 font-mono text-xs">
                              {heure}
                            </span>
                            <span className="text-encre-70">{texte}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            </Carte>

            <div className="space-y-6">
              <Carte className="p-6">
                <h3 className="text-lg">Forfait du mois</h3>
                <div className="mt-5 space-y-5">
                  <Jauge
                    valeur={forfait.consommees}
                    maximum={forfait.incluses}
                    etiquette="Demandes partagées"
                    detail={`${forfait.consommees} sur ${forfait.incluses}`}
                    aspect={forfait.alerte ? 'alerte' : 'or'}
                  />
                  <Jauge valeur={0.62} etiquette="Taux de réponse" detail="62 %" aspect="succes" />
                  <Jauge valeur={0.18} etiquette="Plafond de dépense" detail="22 € sur 120 €" />
                </div>
                {forfait.alerte && (
                  <p className="bg-alerte-fond text-alerte mt-5 rounded-[var(--radius-douce)] px-4 py-3 text-sm">
                    Vous avez consommé {Math.round(forfait.part * 100)} % de votre forfait. Au-delà,
                    chaque demande acceptée sera facturée {formatEuros(12)} HT.
                  </p>
                )}
              </Carte>

              <Carte className="flex items-center justify-around gap-4 p-6">
                <Anneau valeur={0.86} etiquette="Fiche" />
                <Anneau valeur={0.4} etiquette="Part d’affichage" />
              </Carte>
            </div>
          </div>
        </Conteneur>
      </Section>

      {/* --- Formulaires ------------------------------------------------------ */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre="Formulaires"
            titre={
              <>
                Des champs qui <Accent>disent</Accent> ce qui va
              </>
            }
            chapeau="Chaque champ porte son étiquette liée, son aide ou son erreur annoncée par aria-describedby, et une erreur qui change le fond autant que le texte : la couleur seule ne suffit jamais."
          />

          <Carte className="mt-10 p-6 md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Champ etiquette="Prénom" placeholder="Camille" autoComplete="given-name" />
              <Champ
                etiquette="Mobile"
                type="tel"
                placeholder="06 12 34 56 78"
                aide="Un code à 6 chiffres vous sera envoyé pour vérifier ce numéro."
                autoComplete="tel"
              />
              <Champ
                etiquette="Adresse électronique"
                type="email"
                defaultValue="camille@exemple"
                erreur="Cette adresse ne semble pas complète. Vérifiez ce qui suit l’arobase."
              />
              <Liste etiquette="Ville de l’intervention" defaultValue="75111">
                <option value="75111">Paris 11e — ouvert aux demandes</option>
                <option value="93048">Montreuil — ouvert aux demandes</option>
                <option value="93006">Bagnolet — ouvre bientôt</option>
                <option value="94028">Créteil — annuaire seulement</option>
              </Liste>
              <ZoneTexte
                className="md:col-span-2"
                etiquette="Votre besoin"
                placeholder="Une fuite sous l’évier de la cuisine depuis hier soir, l’eau coule dès que j’ouvre le robinet."
                aide="600 caractères au maximum. Les numéros de téléphone et les adresses électroniques sont retirés automatiquement avant l’envoi aux professionnels."
                maxLength={600}
              />
            </div>

            <div className="border-bordure mt-6 flex flex-wrap gap-3 border-t pt-6">
              <Bouton aspect="discret" onClick={() => setTiroirOuvert(true)}>
                Ouvrir le tiroir plein écran
              </Bouton>
              <Bouton aspect="or" onClick={() => setModaleOuverte(true)}>
                Accepter la demande — 12 €
              </Bouton>
            </div>
          </Carte>
        </Conteneur>
      </Section>

      {/* --- Modales et tiroirs ----------------------------------------------- */}
      <Modale
        ouverte={modaleOuverte}
        onFermer={() => setModaleOuverte(false)}
        titre="Cette acceptation est définitive"
        description="Vous allez débloquer les coordonnées du client. Après cela, aucune annulation n’est possible."
        actions={
          <>
            <Bouton aspect="discret" onClick={() => setModaleOuverte(false)}>
              Revenir en arrière
            </Bouton>
            <Bouton aspect="or" onClick={() => setModaleOuverte(false)}>
              J’accepte — 12 € HT
            </Bouton>
          </>
        }
      >
        <ul className="text-encre-70 space-y-2.5 text-sm">
          <li className="flex gap-2.5">
            <span className="text-or">·</span>
            Vous verrez le nom complet, le téléphone vérifié, l’adresse exacte et les photos en
            haute définition.
          </li>
          <li className="flex gap-2.5">
            <span className="text-or">·</span>
            Cette demande sera décomptée de votre forfait, ou facturée {formatEuros(12)} HT s’il est
            épuisé.
          </li>
          <li className="flex gap-2.5">
            <span className="text-or">·</span>
            Le refus, lui, reste gratuit — un motif est simplement demandé.
          </li>
        </ul>
      </Modale>

      <Modale
        ouverte={raisonAffichee !== null}
        onFermer={() => setRaisonAffichee(null)}
        titre="Pourquoi ce résultat ?"
        largeur="large"
        actions={
          <Bouton aspect="contour" onClick={() => setRaisonAffichee(null)}>
            J’ai compris
          </Bouton>
        }
      >
        <p className="text-encre-70">{raisonAffichee}</p>
      </Modale>

      <Tiroir ouvert={tiroirOuvert} onFermer={() => setTiroirOuvert(false)} titre="Services">
        <nav className="space-y-1.5">
          {[
            'Plomberie et chauffage',
            'Électricité et domotique',
            'Serrurerie et sécurité',
            'Canapés, matelas, tapis et textiles',
            'Auto, moto et vélo',
            'Beauté et bien-être à domicile',
          ].map((univers) => (
            <button
              key={univers}
              type="button"
              className="text-encre hover:bg-creme flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-douce)] px-4 text-left font-semibold transition-colors"
            >
              {univers}
              <span aria-hidden="true" className="text-or">
                →
              </span>
            </button>
          ))}
        </nav>
      </Tiroir>

      {/* --- Pied ------------------------------------------------------------- */}
      <footer className="bg-nuit text-creme/70 relative overflow-hidden py-14">
        <Conteneur>
          <p className="text-creme font-[family-name:var(--font-titre)] text-2xl">
            Le Renom<span className="text-or">.</span>
          </p>
          <p className="mt-3 max-w-[64ch] text-sm">
            Design system de la phase 0. Les couleurs, les polices, les durées et les composants qui
            porteront le site public, l’espace pro et le back-office. Capturé à 390 px et 1440 px,
            comme chaque écran du projet.
          </p>
        </Conteneur>
        <p
          aria-hidden="true"
          className="text-creme/[0.035] pointer-events-none absolute -bottom-8 left-1/2 w-full -translate-x-1/2 text-center font-[family-name:var(--font-titre)] text-[22vw] leading-none select-none"
        >
          Le Renom
        </p>
      </footer>
    </main>
  );
}
