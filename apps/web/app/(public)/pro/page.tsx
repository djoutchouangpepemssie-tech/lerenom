import Link from 'next/link';
import {
  Accent,
  Apparition,
  BadgePayant,
  Bouton,
  Carte,
  Conteneur,
  Section,
  TitreSection,
} from '@lerenom/ui';
import {
  FORMULES,
  PARAMETRES_PAR_DEFAUT,
  REGLES_VALIDEES,
  formatEuros,
  prixAnnuelHT,
} from '@lerenom/core';
import { FilAriane } from '@/composants/FilAriane';
import { CalculateurPages } from '@/composants/CalculateurPages';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/pro' },
  title: 'Professionnels et tarifs',
  description:
    'Fiche gratuite pour toutes les entreprises. Formules Essentiel, Premium et Exclusif pour passer en tête de vos pages métier × ville et recevoir des demandes de devis.',
};

const DESCRIPTIONS: Record<
  (typeof FORMULES)[number],
  { phrase: string; points: readonly string[] }
> = {
  gratuit: {
    phrase: 'Pour exister dans l’annuaire et répondre aux demandes directes.',
    points: [
      'Fiche de base : nom, adresse, métier, description, une photo, horaires',
      'Badges de mérite selon les critères publiés',
      'Avis reçus, avec droit de réponse',
      'Classement naturel par le score de qualité',
      '3 demandes directes visibles par mois',
    ],
  },
  essentiel: {
    phrase: 'Pour une fiche complète et des demandes directes sans limite.',
    points: [
      'Pastille « PRO » sur la fiche et dans les résultats',
      'Logo, photo de couverture, 10 photos, services et prix indicatifs',
      'Boutons Appeler et Site web',
      'Demandes directes illimitées, accès aux demandes urgentes',
      'Modèles de réponse et statistiques complètes',
    ],
  },
  premium: {
    phrase: 'Pour passer en tête de vos pages métier × ville et recevoir des demandes.',
    points: [
      'Places 2 et 3 en tête de votre métier dans vos villes, en rotation équitable',
      'Carrousel « À la une » de la page ville et épingle or sur la carte',
      'Fiche riche : galerie illimitée, avant/après, zone sur carte, équipe, FAQ',
      'Thème de marque et site connecté',
      'Aucun concurrent, aucune publicité sur votre fiche',
      '5 demandes partagées incluses par mois',
    ],
  },
  exclusif: {
    phrase: 'Pour être le seul partenaire de votre métier sur votre zone.',
    points: [
      'Place n° 1 unique pour votre métier sur votre zone, renouvelable en priorité',
      'Grande carte sombre en tête des résultats, bannière sur la page ville',
      'Fiche vitrine en chapitres et Studio Exclusif',
      'Demandes de votre zone reçues en premier, seul pendant 30 minutes',
      '15 demandes partagées incluses par mois',
      'Garantie : moins de 5 demandes sur 3 mois, le mois suivant est offert',
    ],
  },
};

export default function PagePro() {
  return (
    <>
      <Section fond="nuit" className="pt-10 pb-16">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Professionnels' }]}
          />

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-or-clair text-[0.72rem] font-bold tracking-[0.2em] uppercase">
                Vous êtes professionnel
              </p>
              <h1 className="text-creme mt-5 max-w-[20ch] text-[clamp(2.1rem,5.4vw,3.6rem)]">
                En tête de votre métier, <Accent>dans vos villes</Accent>
              </h1>
              <p className="text-creme/75 mt-5 max-w-[56ch] text-[1.05rem]">
                Votre fiche est gratuite, pour toujours. Les formules servent à deux choses :
                apparaître en tête de vos pages métier × ville, et recevoir des demandes de devis de
                clients qui cherchent précisément ce que vous faites.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pro/inscription">
                  <Bouton aspect="or" taille="grand">
                    Créer ou revendiquer ma fiche
                  </Bouton>
                </Link>
              </div>
            </div>

            <Carte sombre className="p-6">
              <p className="text-or-clair text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                Une demande reçue
              </p>
              <p className="text-creme mt-4 font-[family-name:var(--font-titre)] text-xl">
                Recherche de fuite — Paris 11e
              </p>
              <p className="text-creme/70 mt-2 text-sm">
                « Une fuite sous l’évier de la cuisine depuis hier soir. »
              </p>
              <dl className="border-creme/10 mt-5 space-y-2 border-t pt-4 text-sm">
                {[
                  ['Quartier', 'Sainte-Marguerite · 1,2 km'],
                  ['Délai souhaité', 'Sous 48 heures'],
                  ['Budget annoncé', '100 à 400 €'],
                  ['Client', 'Camille · téléphone vérifié'],
                ].map(([cle, valeur]) => (
                  <div key={cle} className="flex justify-between gap-4">
                    <dt className="text-creme/55">{cle}</dt>
                    <dd className="text-creme text-right font-semibold">{valeur}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex gap-2.5">
                <span className="bg-or text-encre flex-1 rounded-[var(--radius-douce)] px-4 py-2.5 text-center text-sm font-bold">
                  Accepter — incluse
                </span>
                <span className="border-creme/20 text-creme/70 rounded-[var(--radius-douce)] border px-4 py-2.5 text-center text-sm font-semibold">
                  Refuser
                </span>
              </div>
              <p className="text-creme/50 mt-3 text-xs">
                Les coordonnées complètes n’apparaissent qu’après acceptation, et l’acceptation est
                définitive.
              </p>
            </Carte>
          </div>
        </Conteneur>
      </Section>

      {/* ── Les formules ──────────────────────────────────────────────────── */}
      <Section fond="creme" className="py-14">
        <Conteneur>
          <TitreSection
            centre
            surtitre="Les formules"
            titre={
              <>
                Quatre formules, <Accent>un seul prix partout</Accent>
              </>
            }
            chapeau="Tous les prix sont hors taxes, par mois. Le paiement annuel offre deux mois. Seule la formule Exclusif est engagée, pour 12 mois."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FORMULES.map((formule, index) => {
              const prix = REGLES_VALIDEES.prixMensuelHT[formule];
              const villes = REGLES_VALIDEES.villesMax[formule];
              const incluses = REGLES_VALIDEES.demandesIncluses[formule];
              const urgence = REGLES_VALIDEES.prixDemandeUrgente[formule];
              const agences = REGLES_VALIDEES.agencesMax[formule];
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

                    <p
                      className={`mt-3 text-sm ${estExclusif ? 'text-creme/70' : 'text-encre-70'}`}
                    >
                      {DESCRIPTIONS[formule].phrase}
                    </p>

                    <p className="mt-5 flex items-baseline gap-1.5">
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
                        ou {formatEuros(prixAnnuelHT(formule))} HT par an — 2 mois offerts
                      </p>
                    )}

                    <dl
                      className={`mt-5 space-y-2 border-y py-4 text-sm ${estExclusif ? 'border-creme/10' : 'border-bordure'}`}
                    >
                      <Ligne
                        clair={estExclusif}
                        cle="Villes"
                        valeur={villes === null ? 'Sans limite' : String(villes)}
                      />
                      <Ligne
                        clair={estExclusif}
                        cle="Agences"
                        valeur={agences === null ? 'Sans limite' : String(agences)}
                      />
                      <Ligne
                        clair={estExclusif}
                        cle="Demandes incluses"
                        valeur={incluses === 0 ? '—' : `${incluses} / mois`}
                      />
                      <Ligne
                        clair={estExclusif}
                        cle="Demande partagée"
                        valeur={formatEuros(REGLES_VALIDEES.prixDemandePartagee[formule])}
                      />
                      <Ligne
                        clair={estExclusif}
                        cle="Demande urgente"
                        valeur={urgence === null ? 'Non disponible' : formatEuros(urgence)}
                      />
                    </dl>

                    <ul
                      className={`mt-5 space-y-2.5 text-sm ${estExclusif ? 'text-creme/80' : 'text-encre-70'}`}
                    >
                      {DESCRIPTIONS[formule].points.map((point) => (
                        <li key={point} className="flex gap-2.5">
                          <span
                            aria-hidden="true"
                            className="bg-or mt-2 size-1.5 shrink-0 rounded-full"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-6">
                      <Link href="/pro/inscription" className="block">
                        <Bouton
                          aspect={estExclusif ? 'or' : formule === 'premium' ? 'encre' : 'contour'}
                          pleineLargeur
                        >
                          {prix === 0 ? 'Créer ma fiche' : 'Choisir cette formule'}
                        </Bouton>
                      </Link>
                    </div>
                  </Carte>
                </Apparition>
              );
            })}
          </div>

          <p className="text-encre-55 mt-8 text-center text-sm">
            Nous limitons à {REGLES_VALIDEES.premiumMaxParMetierVille} le nombre de partenaires
            Premium par métier et par ville, pour que chacun garde au moins un affichage sur trois.
            Au-delà, une liste d’attente s’ouvre.
          </p>
        </Conteneur>
      </Section>

      {/* ── Calculateur ───────────────────────────────────────────────────── */}
      <Section fond="carte" className="py-14">
        <Conteneur>
          <TitreSection
            surtitre="Combien de pages"
            titre={
              <>
                Une page, c’est <Accent>un métier dans une ville</Accent>
              </>
            }
            chapeau="Le nombre de pages où vous apparaissez est le produit de vos villes par vos métiers. Voici ce que chaque formule vous donne."
          />
          <CalculateurPages className="mt-9" />
        </Conteneur>
      </Section>

      {/* ── Garantie ──────────────────────────────────────────────────────── */}
      <Section fond="creme" className="py-14">
        <Conteneur>
          <Carte className="border-or/30 bg-or/[0.06] p-7 md:p-10">
            <p className="text-or-fonce text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Garantie Exclusif
            </p>
            <h2 className="mt-3 max-w-[26ch] text-[clamp(1.5rem,3.4vw,2.2rem)]">
              Moins de {REGLES_VALIDEES.garantieExclusif.demandesMinimum} demandes sur{' '}
              {REGLES_VALIDEES.garantieExclusif.moisConsecutifs} mois ?{' '}
              <Accent>Le mois suivant est offert.</Accent>
            </h2>
            <p className="text-encre-70 mt-4 max-w-[64ch]">
              La garantie se calcule sur trois mois civils consécutifs, à partir de votre premier
              mois complet d’abonnement. Sont comptées les demandes directes et partagées valides,
              hors demandes contestées et remboursées.
            </p>
            <p className="text-encre-70 mt-3 max-w-[64ch] text-sm">
              Deux conditions, et elles sont là pour que la garantie reste juste : votre fiche doit
              être complète, et votre taux de réponse d’au moins{' '}
              {Math.round(REGLES_VALIDEES.garantieExclusif.tauxReponseMinimum * 100)} %. Un abonné
              qui laisse expirer ses demandes ne peut pas se faire offrir un mois à cause de son
              propre silence.
            </p>
          </Carte>
        </Conteneur>
      </Section>

      {/* ── Ce que nous ne promettons pas ─────────────────────────────────── */}
      <Section fond="carte" className="py-14">
        <Conteneur>
          <TitreSection
            surtitre="Honnêtement"
            titre={
              <>
                Ce que nous <Accent>ne promettons pas</Accent>
              </>
            }
            chapeau="Un vendeur qui promet tout ne tient rien. Voici nos limites, écrites avant que vous payiez."
          />

          <ul className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              {
                titre: 'Aucune position dans un moteur de recherche',
                texte:
                  'Les emplacements que nous vendons sont des places dans l’annuaire Le Renom. Personne ne peut vendre une position dans un moteur de recherche, et ceux qui le prétendent vous trompent.',
              },
              {
                titre: 'Aucun volume de demandes',
                texte:
                  'Les demandes incluses sont un plafond, pas un engagement. Elles dépendent des recherches réelles dans vos villes et votre métier. C’est précisément pourquoi la garantie Exclusif existe.',
              },
              {
                titre: 'Aucune exclusivité hors de votre zone',
                texte:
                  'L’exclusivité porte sur le couple métier × zone que vous achetez. Dans vos autres villes, vous êtes traité comme un partenaire Premium.',
              },
            ].map((item) => (
              <li key={item.titre}>
                <Carte className="h-full p-5">
                  <h3 className="text-lg">{item.titre}</h3>
                  <p className="text-encre-70 mt-2.5 text-sm leading-relaxed">{item.texte}</p>
                </Carte>
              </li>
            ))}
          </ul>

          <p className="text-encre-55 mt-8 text-sm">
            Un refus de demande est gratuit, avec un motif. Une acceptation est définitive : elle
            débloque les coordonnées du client. Le recrédit est réservé aux cas vérifiés — client
            injoignable après trois appels tracés, client absent à un rendez-vous confirmé, fausses
            informations confirmées. Une demande partagée facturée peut être contestée dans les{' '}
            {PARAMETRES_PAR_DEFAUT.joursContestation} jours, et la contestation est tranchée sous{' '}
            {PARAMETRES_PAR_DEFAUT.heuresTraitementContestation} heures.{' '}
            <Link
              href="/cgv-pro"
              className="text-or-fonce font-semibold underline underline-offset-4"
            >
              Lire les conditions générales professionnelles
            </Link>
          </p>
        </Conteneur>
      </Section>
    </>
  );
}

function Ligne({
  cle,
  valeur,
  clair,
}: {
  readonly cle: string;
  readonly valeur: string;
  readonly clair: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={clair ? 'text-creme/55' : 'text-encre-55'}>{cle}</dt>
      <dd className={`text-right font-semibold ${clair ? 'text-creme' : 'text-encre'}`}>
        {valeur}
      </dd>
    </div>
  );
}
