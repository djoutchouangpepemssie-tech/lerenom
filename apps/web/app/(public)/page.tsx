import Link from 'next/link';
import {
  Accent,
  Apparition,
  BadgePayant,
  BandeauDefilant,
  Bouton,
  Carte,
  Chiffre,
  CielEtoile,
  Compteur,
  Conteneur,
  Epingle,
  MentionSponsorise,
  Note,
  Section,
  TitreSection,
  ToitsDeParis,
} from '@lerenom/ui';
import { BarreRecherche } from '@/composants/BarreRecherche';
import { VitrineUnivers } from '@/composants/VitrineUnivers';
import { catalogue, communesOuvertes, departements, resultats } from '@/lib/donnees';
import { nomVille } from '@/lib/affichage';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/' },
  description:
    'Trouvez un professionnel vérifié en Île-de-France : plombier, électricien, nettoyage de canapé, déménagement. Comparez les avis, demandez jusqu’à 3 devis gratuitement, sans créer de compte.',
};

const ETAPES = [
  {
    titre: 'Décrivez votre besoin',
    texte:
      'Choisissez votre prestation, précisez la ville et joignez quelques photos. Trois minutes suffisent, et vous n’avez aucun compte à créer.',
  },
  {
    titre: 'Trois professionnels vous répondent',
    texte:
      'Votre demande part à trois professionnels au maximum, jamais plus, et jamais après 72 heures. Vos coordonnées ne leur sont transmises que s’ils acceptent.',
  },
  {
    titre: 'Vous comparez, vous choisissez',
    texte:
      'Vous recevez leurs devis par SMS et par e-mail, vous signez celui qui vous convient, et vous laissez un avis une fois les travaux faits.',
  },
] as const;

const QUESTIONS = [
  {
    question: 'Combien coûte une demande de devis ?',
    reponse:
      'Rien. Le service est entièrement gratuit pour les particuliers et les entreprises qui cherchent un professionnel. Ce sont les professionnels qui paient pour recevoir des demandes.',
  },
  {
    question: 'Combien de professionnels vont me contacter ?',
    reponse:
      'Trois au maximum, jamais plus. Et votre demande n’est jamais proposée à un professionnel au-delà de 72 heures : c’est la principale critique faite aux plateformes existantes, et nous ne la reproduisons pas.',
  },
  {
    question: 'Qui voit mes coordonnées ?',
    reponse:
      'Personne tant qu’aucun professionnel n’a accepté votre demande. Avant d’accepter, un professionnel voit votre besoin, votre quartier et votre prénom, mais ni votre téléphone, ni votre adresse exacte. Le texte exact de votre consentement est conservé avec votre demande.',
  },
  {
    question: 'Les professionnels en tête des résultats sont-ils les meilleurs ?',
    reponse:
      'Non, et nous l’écrivons. Les trois premières places peuvent être des emplacements payés : elles portent toujours la mention « Sponsorisé ». Tout le reste est classé par un score de qualité où le paiement ne compte pour rien — avis, activité, pertinence, réactivité, fraîcheur de la fiche.',
  },
  {
    question: 'Dois-je créer un compte ?',
    reponse:
      'Non. Vous recevez chaque étape par SMS et par e-mail, et chaque lien ouvre une page qui ne fait qu’une chose : choisir un créneau, signer un devis, payer une facture, laisser un avis.',
  },
] as const;

export default async function Accueil() {
  const [cat, deps, ouvertes, plombiersParis11] = await Promise.all([
    catalogue(),
    departements(),
    communesOuvertes(),
    resultats('plombier', 'paris-11'),
  ]);

  const metiersBandeau = cat.univers
    .flatMap((u) => u.metiers.map((m) => m.nom))
    .filter((_, index) => index % 3 === 0)
    .slice(0, 18);

  const prestationsPhares = cat.univers
    .flatMap((u) => u.metiers.flatMap((m) => m.prestations.map((p) => ({ ...p, metier: m }))))
    .filter((p) => p.tresDemande)
    .slice(0, 8);

  const villesOuvertes = ouvertes.filter((c) => c.statut === 'ouvert');

  return (
    <>
      {/* ── Héros ─────────────────────────────────────────────────────────── */}
      <header className="bg-nuit text-creme relative isolate overflow-hidden">
        <CielEtoile className="absolute inset-x-0 top-0 -z-30 h-24 opacity-80" />
        <ToitsDeParis className="absolute inset-x-0 bottom-0 -z-20 opacity-60" />
        <div className="from-nuit via-nuit/92 to-nuit/60 absolute inset-0 -z-10 bg-gradient-to-b" />

        <Conteneur className="relative pt-16 pb-28 md:pt-24 md:pb-36">
          <Apparition>
            <p className="text-or-clair flex items-center gap-2 text-[0.72rem] font-bold tracking-[0.2em] uppercase">
              <span className="bg-or size-1.5 rounded-full" />
              Toute l’Île-de-France
            </p>
          </Apparition>

          <Apparition index={1}>
            <h1 className="text-creme mt-5 max-w-[20ch] text-[clamp(2.3rem,6.4vw,4.2rem)]">
              Le bon artisan, <Accent>près de chez vous</Accent>.
            </h1>
          </Apparition>

          <Apparition index={2}>
            <p className="text-creme/75 mt-5 max-w-[56ch] text-[1.05rem] md:text-lg">
              {cat.comptes.prestations} prestations, {cat.comptes.metiers} métiers, 1 285 villes et
              arrondissements. Comparez les avis vérifiés et recevez jusqu’à trois devis —
              gratuitement, et sans créer de compte.
            </p>
          </Apparition>

          <Apparition index={3}>
            <BarreRecherche className="mt-9 max-w-4xl" />
          </Apparition>

          <Apparition index={4}>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-creme/55 text-sm">Souvent demandé :</span>
              {prestationsPhares.slice(0, 5).map((prestation) => (
                <Link
                  key={prestation.slug}
                  href={`/${prestation.metier.slug}`}
                  className="border-creme/15 text-creme/80 hover:border-or hover:text-creme inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors"
                >
                  {prestation.nom}
                </Link>
              ))}
            </div>
          </Apparition>

          <Apparition index={5}>
            <dl className="border-creme/10 bg-nuit/55 mt-12 grid grid-cols-2 gap-x-6 gap-y-8 rounded-[var(--radius-panneau)] border px-6 py-7 backdrop-blur-[2px] sm:grid-cols-4">
              <Chiffre
                clair
                valeur={<Compteur valeur={1285} />}
                libelle="villes et arrondissements"
              />
              <Chiffre
                clair
                valeur={<Compteur valeur={cat.comptes.prestations} />}
                libelle="prestations au catalogue"
              />
              <Chiffre
                clair
                valeur={<Compteur valeur={villesOuvertes.length} />}
                libelle="villes ouvertes aux devis"
              />
              <Chiffre
                clair
                valeur={
                  <>
                    <Compteur valeur={3} /> max
                  </>
                }
                libelle="pros contactés par demande"
              />
            </dl>
          </Apparition>
        </Conteneur>
      </header>

      <BandeauDefilant entrees={metiersBandeau} />

      {/* ── Comment ça marche ─────────────────────────────────────────────── */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            centre
            surtitre="Comment ça marche"
            titre={
              <>
                Trois étapes, <Accent>aucun compte</Accent>
              </>
            }
            chapeau="Vous décrivez, nous transmettons, vous choisissez. Tout le reste arrive par SMS et par e-mail."
          />

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {ETAPES.map((etape, index) => (
              <Apparition key={etape.titre} index={index} balise="li">
                <Carte className="h-full p-6">
                  <span className="bg-or/15 text-or-fonce flex size-11 items-center justify-center rounded-full font-[family-name:var(--font-titre)] text-xl">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl">{etape.titre}</h3>
                  <p className="text-encre-70 mt-3 text-sm leading-relaxed">{etape.texte}</p>
                </Carte>
              </Apparition>
            ))}
          </ol>
        </Conteneur>
      </Section>

      {/* ── Vitrine des univers ───────────────────────────────────────────── */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre={`${cat.comptes.univers} univers`}
            titre={
              <>
                Tous les métiers, <Accent>vraiment tous</Accent>
              </>
            }
            chapeau={`De la recherche de fuite au nettoyage de canapé, du déménagement à la garde d’animaux : ${cat.comptes.metiers} métiers et ${cat.comptes.prestations} prestations, chacun avec ses prix constatés.`}
          />
          <VitrineUnivers
            className="mt-10"
            univers={cat.univers.map((u) => ({
              slug: u.slug,
              nom: u.nom,
              couleur: u.couleur,
              icone: u.icone,
              metiers: u.metiers.map((m) => ({
                slug: m.slug,
                nom: m.nom,
                prestations: m.prestations.slice(0, 6).map((p) => ({ slug: p.slug, nom: p.nom })),
                nombrePrestations: m.prestations.length,
              })),
            }))}
          />
        </Conteneur>
      </Section>

      {/* ── Les pros d'une ville ──────────────────────────────────────────── */}
      {plombiersParis11 !== null && plombiersParis11.pros.length > 0 && (
        <Section fond="creme">
          <Conteneur>
            <TitreSection
              surtitre="Exemple de résultats"
              titre={
                <>
                  Les plombiers de <Accent>Paris 11e</Accent>
                </>
              }
              chapeau="Les emplacements payés sont en tête, toujours étiquetés. Tout le reste est classé par un score de qualité où le paiement ne compte pour rien."
            />

            <ol className="mt-9 space-y-3">
              {plombiersParis11.pros.slice(0, 5).map((pro, index) => (
                <li key={pro.id}>
                  {index === plombiersParis11.dernierRangSponsorise &&
                    plombiersParis11.dernierRangSponsorise > 0 && (
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
                      sombre={pro.raison === 'emplacement-exclusif'}
                      liseréOr={pro.raison === 'emplacement-premium'}
                      className="p-4 md:p-5"
                    >
                      <Link href={`/entreprise/${pro.slug}`} className="flex items-start gap-4">
                        <Epingle
                          variante={
                            pro.raison === 'emplacement-exclusif'
                              ? 'couronne'
                              : pro.raison === 'emplacement-premium'
                                ? 'or'
                                : 'standard'
                          }
                          retardMs={index * 70}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-[family-name:var(--font-titre)] text-lg md:text-xl ${
                                pro.raison === 'emplacement-exclusif' ? 'text-creme' : 'text-encre'
                              }`}
                            >
                              {pro.nom}
                            </span>
                            {pro.formule !== 'gratuit' && <BadgePayant formule={pro.formule} />}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Note
                              note={pro.note}
                              nombreAvis={pro.nombreAvis}
                              taille="petite"
                              clair={pro.raison === 'emplacement-exclusif'}
                            />
                            {pro.communeAgence !== null && (
                              <span
                                className={`text-xs ${
                                  pro.raison === 'emplacement-exclusif'
                                    ? 'text-creme/55'
                                    : 'text-encre-55'
                                }`}
                              >
                                {nomVille(pro.communeAgence)}
                              </span>
                            )}
                          </div>
                          {pro.sponsorise && (
                            <div className="mt-2.5">
                              <MentionSponsorise
                                className={
                                  pro.raison === 'emplacement-exclusif'
                                    ? '[&_span]:border-creme/20 [&_span]:bg-creme/10 [&_span]:text-creme/80'
                                    : ''
                                }
                              />
                            </div>
                          )}
                        </div>
                      </Link>
                    </Carte>
                  </Apparition>
                </li>
              ))}
            </ol>

            <Carte className="border-or/30 bg-or/[0.06] mt-6 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
              <p className="text-encre-70 flex-1 text-sm">
                <strong className="text-encre font-bold">Comment nous classons.</strong> Trois
                places au maximum sont payées et portent la mention « Sponsorisé ». Les autres sont
                classées par un score de qualité : avis, activité, pertinence, réactivité, fraîcheur
                de la fiche. Le paiement n’y entre pour rien.
              </p>
              <Link href="/comment-nous-classons" className="shrink-0">
                <Bouton aspect="contour">Lire la méthode</Bouton>
              </Link>
            </Carte>

            <div className="mt-6">
              <Link
                href="/plombier/paris-11"
                className="text-or-fonce inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                Voir les {plombiersParis11.pros.length} plombiers de Paris 11e
              </Link>
            </div>
          </Conteneur>
        </Section>
      )}

      {/* ── Les départements ──────────────────────────────────────────────── */}
      <Section fond="carte">
        <Conteneur>
          <TitreSection
            surtitre="Île-de-France"
            titre={
              <>
                Huit départements, <Accent>1 285 villes</Accent>
              </>
            }
            chapeau="Les demandes de devis s’ouvrent ville par ville. Partout ailleurs, l’annuaire est consultable et vous pouvez demander à être prévenu."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {deps.map((departement, index) => (
              <Apparition key={departement.code} index={index}>
                <Link href={`/${departement.slug}`} className="block h-full">
                  <Carte survolable className="h-full p-5">
                    <p className="text-encre-40 font-mono text-xs">{departement.code}</p>
                    <h3 className="mt-1 text-xl">{departement.nom}</h3>
                    <p className="text-encre-55 mt-2 text-sm">
                      {departement._count.communes}{' '}
                      {departement.code === '75' ? 'arrondissements' : 'communes'}
                    </p>
                  </Carte>
                </Link>
              </Apparition>
            ))}
          </div>

          <div className="border-bordure bg-creme mt-8 rounded-[var(--radius-carte)] border p-6">
            <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Demandes de devis déjà ouvertes
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {villesOuvertes.map((ville) => (
                <li key={ville.code}>
                  <Link
                    href={`/${ville.slug}`}
                    className="border-succes/25 bg-succes-fond text-succes hover:border-succes inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors"
                  >
                    {nomVille(ville.nom)}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-encre-70 mt-4 text-sm">
              Les autres villes ouvriront progressivement. Dans une ville qui n’est pas encore
              ouverte, votre demande ne part pas chez les professionnels : nous vous prévenons dès
              l’ouverture, et vous confirmez par SMS.
            </p>
          </div>
        </Conteneur>
      </Section>

      {/* ── Bandeau professionnels ────────────────────────────────────────── */}
      <Section fond="nuit">
        <Conteneur>
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <TitreSection
                clair
                surtitre="Vous êtes professionnel"
                titre={
                  <>
                    Passez en tête de <Accent>votre métier</Accent>, dans vos villes
                  </>
                }
                chapeau="Fiche gratuite pour tout le monde. Puis des formules pour apparaître en tête de vos pages métier × ville et recevoir des demandes de devis qualifiées."
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pro/inscription">
                  <Bouton aspect="or" taille="grand">
                    Créer ou revendiquer ma fiche
                  </Bouton>
                </Link>
                <Link href="/pro">
                  <Bouton
                    aspect="contour"
                    taille="grand"
                    className="border-creme/25 text-creme hover:border-or hover:bg-creme/5 bg-transparent"
                  >
                    Voir les tarifs
                  </Bouton>
                </Link>
              </div>
            </div>

            <ul className="grid gap-3">
              {[
                { formule: 'Gratuit', villes: '2 villes', prix: '0 €' },
                { formule: 'Essentiel', villes: '5 villes', prix: '29 €' },
                { formule: 'Premium', villes: '15 villes', prix: '79 €' },
                { formule: 'Exclusif', villes: 'Partout', prix: '229 €' },
              ].map((offre, index) => (
                <Apparition key={offre.formule} index={index} balise="li">
                  <div className="border-creme/12 bg-creme/[0.04] flex items-center justify-between gap-4 rounded-[var(--radius-carte)] border px-5 py-4">
                    <div>
                      <p className="text-creme font-semibold">{offre.formule}</p>
                      <p className="text-creme/55 text-sm">{offre.villes}</p>
                    </div>
                    <p className="text-or-clair font-[family-name:var(--font-titre)] text-2xl">
                      {offre.prix}
                      <span className="text-creme/50 ml-1 text-xs">HT / mois</span>
                    </p>
                  </div>
                </Apparition>
              ))}
            </ul>
          </div>
        </Conteneur>
      </Section>

      {/* ── Questions fréquentes ──────────────────────────────────────────── */}
      <Section fond="creme">
        <Conteneur>
          <TitreSection
            surtitre="Questions fréquentes"
            titre={
              <>
                Ce que vous nous demandez <Accent>le plus souvent</Accent>
              </>
            }
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {QUESTIONS.map((item, index) => (
              <Apparition key={item.question} index={index}>
                <Carte className="h-full p-6">
                  <h3 className="text-lg">{item.question}</h3>
                  <p className="text-encre-70 mt-3 text-sm leading-relaxed">{item.reponse}</p>
                </Carte>
              </Apparition>
            ))}
          </div>
        </Conteneur>
      </Section>

      {/* ── Appel final ───────────────────────────────────────────────────── */}
      <Section fond="carte" className="pb-20">
        <Conteneur>
          <Carte className="border-or/35 from-or/[0.1] overflow-hidden bg-gradient-to-br to-transparent p-8 text-center md:p-14">
            <h2 className="mx-auto max-w-[20ch] text-[clamp(1.8rem,4vw,2.8rem)]">
              Un besoin ? <Accent>Trois devis</Accent> vous attendent.
            </h2>
            <p className="text-encre-70 mx-auto mt-4 max-w-[56ch]">
              Décrivez votre besoin en trois minutes. Trois professionnels au maximum vous
              répondent, et vous n’avez aucun compte à créer.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/demande">
                <Bouton aspect="or" taille="grand">
                  Demander un devis
                </Bouton>
              </Link>
              <Link href="/guide-des-prix">
                <Bouton aspect="contour" taille="grand">
                  Consulter le guide des prix
                </Bouton>
              </Link>
            </div>
          </Carte>
        </Conteneur>
      </Section>
    </>
  );
}
