import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Accent,
  BadgePayant,
  BarreCollante,
  Bouton,
  Carte,
  Conteneur,
  ListeBadgesMerite,
  Note,
  SceauExclusivite,
  Section,
  TitreSection,
} from '@lerenom/ui';
import type { Merite } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { entrepriseParSlug } from '@/lib/donnees';
import { FUSEAU, nomVille } from '@/lib/affichage';

interface Parametres {
  readonly params: Promise<{ readonly slug: string }>;
}

export async function generateMetadata({ params }: Parametres): Promise<Metadata> {
  const { slug } = await params;
  const entreprise = await entrepriseParSlug(slug);
  if (entreprise === null) return {};

  const metier = entreprise.metiers.find((m) => m.principal)?.metier.nom ?? 'Professionnel';
  const ville = nomVille(entreprise.agences[0]?.commune.nom ?? 'Île-de-France');

  return {
    title: `${entreprise.nom} — ${metier} à ${ville}`,
    description:
      entreprise.fiche?.description?.slice(0, 160) ??
      `${entreprise.nom}, ${metier.toLowerCase()} à ${ville}. Avis vérifiés et demande de devis gratuite.`,
  };
}

/**
 * La fiche d'une entreprise, rendue selon sa formule.
 *
 * Deux règles de la grille des formules sont tenues ici et nulle part ailleurs :
 *   * **aucun concurrent** sur la fiche d'un Premium ou d'un Exclusif — c'est l'argument
 *     commercial le plus fort, le visiteur qui arrive chez un abonné ne voit que lui ;
 *   * **aucune publicité** sur ces mêmes fiches.
 *
 * La personnalisation d'une fiche ne touche jamais aux badges payants, au sceau d'exclusivité,
 * à la mention « Sponsorisé », aux badges de mérite ni au bouton de devis principal.
 */
export default async function PageEntreprise({ params }: Parametres) {
  const { slug } = await params;
  const entreprise = await entrepriseParSlug(slug);
  if (entreprise === null || entreprise.retireeLe !== null) notFound();

  const formule = entreprise.abonnements[0]?.formule ?? 'gratuit';
  const sansConcurrents = formule === 'premium' || formule === 'exclusif';
  const metierPrincipal = entreprise.metiers.find((m) => m.principal) ?? entreprise.metiers[0];
  const agencePrincipale = entreprise.agences.find((a) => a.principale) ?? entreprise.agences[0];
  const fiche = entreprise.fiche;

  // Une fiche qui ne contient que les données SIRENE reste en `noindex` : publier des millions
  // de pages reproduites à grande échelle est exactement ce que les règles anti-spam visent.
  const enrichie =
    entreprise.revendiquee || entreprise.nombreAvis > 0 || (fiche?.completude ?? 0) > 0.5;

  const merites: Merite[] = [];
  if (entreprise.verifiee) merites.push('entreprise-verifiee');
  if (entreprise.siret !== null) merites.push('siret-verifie');
  if (fiche?.decennaleVerifieeLe != null) merites.push('decennale-verifiee');
  if ((entreprise.noteMoyenne ?? 0) >= 4.5 && entreprise.nombreAvis >= 10)
    merites.push('tres-bien-note');
  if (entreprise.nombreAvis > 0) merites.push('avis-verifies');

  const estExclusif = formule === 'exclusif';

  return (
    <>
      {!enrichie && <meta name="robots" content="noindex, follow" />}

      {/* ── Couverture ─────────────────────────────────────────────────────── */}
      <header className={estExclusif ? 'bg-nuit text-creme' : 'bg-creme'}>
        <Conteneur className="pt-8 pb-10">
          <FilAriane
            clair={estExclusif}
            elements={[
              { libelle: 'Accueil', href: '/' },
              ...(agencePrincipale !== undefined
                ? [
                    {
                      libelle: nomVille(agencePrincipale.commune.nom),
                      href: `/${agencePrincipale.commune.slug}`,
                    },
                  ]
                : []),
              ...(metierPrincipal !== undefined
                ? [{ libelle: metierPrincipal.metier.nom, href: `/${metierPrincipal.metier.slug}` }]
                : []),
              { libelle: entreprise.nom },
            ]}
          />

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {formule !== 'gratuit' && <BadgePayant formule={formule} />}
                {estExclusif && agencePrincipale !== undefined && (
                  <SceauExclusivite zone={nomVille(agencePrincipale.commune.nom)} />
                )}
              </div>

              <h1
                className={`mt-4 text-[clamp(2rem,5vw,3.4rem)] ${estExclusif ? 'text-creme' : 'text-encre'}`}
              >
                {entreprise.nom}
              </h1>

              {fiche?.slogan != null && (
                <p className={`mt-2 text-lg ${estExclusif ? 'text-or-clair' : 'text-or-fonce'}`}>
                  {fiche.slogan}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Note
                  note={entreprise.noteMoyenne}
                  nombreAvis={entreprise.nombreAvis}
                  taille="grande"
                  clair={estExclusif}
                />
                {metierPrincipal !== undefined && (
                  <Link
                    href={`/${metierPrincipal.metier.slug}`}
                    className={`text-sm font-semibold underline underline-offset-4 ${
                      estExclusif ? 'text-creme/75' : 'text-encre-70'
                    }`}
                  >
                    {metierPrincipal.metier.nom}
                  </Link>
                )}
                {agencePrincipale !== undefined && (
                  <span className={`text-sm ${estExclusif ? 'text-creme/60' : 'text-encre-55'}`}>
                    {nomVille(agencePrincipale.commune.nom)}
                  </span>
                )}
              </div>

              <ListeBadgesMerite className="mt-5" merites={merites} />
            </div>

            <Carte sombre={estExclusif} className="w-full shrink-0 p-5 lg:max-w-xs">
              <p className={`text-sm ${estExclusif ? 'text-creme/70' : 'text-encre-70'}`}>
                {formule === 'exclusif'
                  ? 'Conciergerie : devis prioritaire et rappel en 5 minutes.'
                  : 'Décrivez votre besoin, cette entreprise vous répond.'}
              </p>
              <Link href="/demande" className="mt-4 block">
                <Bouton aspect="or" pleineLargeur taille="grand">
                  Demander un devis
                </Bouton>
              </Link>
              {formule !== 'gratuit' && fiche?.telephone != null && (
                <a href={`tel:${fiche.telephone}`} className="mt-2.5 block">
                  <Bouton
                    aspect="contour"
                    pleineLargeur
                    className={estExclusif ? 'border-creme/25 text-creme bg-transparent' : ''}
                  >
                    Appeler
                  </Bouton>
                </a>
              )}
              <p className={`mt-4 text-xs ${estExclusif ? 'text-creme/50' : 'text-encre-55'}`}>
                Vos coordonnées ne sont transmises que si le professionnel accepte votre demande.
              </p>
            </Carte>
          </div>
        </Conteneur>
      </header>

      {/* ── Présentation ───────────────────────────────────────────────────── */}
      {fiche?.description != null && (
        <Section fond="carte" className="py-12">
          <Conteneur>
            <TitreSection
              surtitre="L’entreprise"
              titre={
                <>
                  Qui <Accent>elle est</Accent>
                </>
              }
            />
            <p className="text-encre-70 mt-6 max-w-[70ch] text-[1.05rem] leading-relaxed">
              {fiche.description}
            </p>

            {fiche.atouts.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {fiche.atouts.map((atout) => (
                  <li
                    key={atout}
                    className="border-bordure bg-creme text-encre inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold"
                  >
                    {atout}
                  </li>
                ))}
              </ul>
            )}
          </Conteneur>
        </Section>
      )}

      {/* ── Prestations ────────────────────────────────────────────────────── */}
      {entreprise.prestations.length > 0 && (
        <Section fond="creme" className="py-12">
          <Conteneur>
            <TitreSection
              surtitre="Prestations"
              titre={
                <>
                  Ce qu’elle <Accent>propose</Accent>
                </>
              }
            />
            <ul className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {entreprise.prestations.map((lien) => (
                <li
                  key={lien.id}
                  className="border-bordure bg-carte flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-douce)] border px-4"
                >
                  <span className="text-encre min-w-0 flex-1 truncate text-sm font-medium">
                    {lien.prestation.nom}
                  </span>
                  {lien.prixTTC !== null && (
                    <span className="text-or-fonce shrink-0 text-sm font-bold">
                      {Number(lien.prixTTC)} €
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Conteneur>
        </Section>
      )}

      {/* ── Zones et agences ───────────────────────────────────────────────── */}
      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Zone d’intervention"
            titre={
              <>
                Où elle <Accent>intervient</Accent>
              </>
            }
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                {entreprise.agences.length > 1 ? `${entreprise.agences.length} agences` : 'Agence'}
              </p>
              <ul className="mt-4 space-y-3">
                {entreprise.agences.map((agence) => (
                  <li key={agence.id}>
                    <Carte className="p-4">
                      <p className="text-encre font-semibold">
                        {agence.nom ?? nomVille(agence.commune.nom)}
                      </p>
                      <p className="text-encre-70 mt-1 text-sm">
                        {entreprise.diffusible
                          ? agence.adresse
                          : 'Adresse communiquée après acceptation'}
                        {' · '}
                        {agence.codePostal} {nomVille(agence.commune.nom)}
                      </p>
                      <p className="text-encre-55 mt-1 text-xs">
                        Intervient jusqu’à {agence.rayonKm} km autour de cette adresse.
                      </p>
                    </Carte>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                Villes couvertes
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {entreprise.zones.map((zone) => (
                  <li key={zone.id}>
                    <Link
                      href={`/${zone.commune.slug}`}
                      className="border-bordure bg-creme text-encre hover:border-or inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors"
                    >
                      {nomVille(zone.commune.nom)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Conteneur>
      </Section>

      {/* ── Avis ───────────────────────────────────────────────────────────── */}
      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Avis vérifiés"
            titre={
              <>
                Ce qu’en disent <Accent>ses clients</Accent>
              </>
            }
            chapeau="Chaque avis est lié à une demande réelle et à des travaux déclarés réalisés. Un professionnel ne peut ni acheter ni supprimer un avis ; il peut y répondre."
          />

          {entreprise.avis.length === 0 ? (
            <Carte className="mt-8 p-6">
              <p className="text-encre-70 text-sm">
                Cette entreprise n’a pas encore d’avis sur Le Renom. Les avis apparaissent quinze
                jours après des travaux réalisés via une demande déposée ici — c’est ce qui permet
                de dire « avis vérifié » sans mentir.
              </p>
            </Carte>
          ) : (
            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              {entreprise.avis.map((avis) => (
                <li key={avis.id}>
                  <Carte className="h-full p-5">
                    <div className="flex items-center justify-between gap-3">
                      <Note note={avis.note} taille="petite" />
                      <span className="text-encre-40 text-xs">
                        {avis.auteurPrenom} ·{' '}
                        {avis.publieLe?.toLocaleDateString('fr-FR', {
                          month: 'long',
                          year: 'numeric',
                          timeZone: FUSEAU,
                        })}
                      </span>
                    </div>
                    {avis.commentaire != null && (
                      <p className="text-encre-70 mt-3 text-sm leading-relaxed">
                        {avis.commentaire}
                      </p>
                    )}
                    {avis.reponse !== null && (
                      <div className="border-or bg-creme mt-4 rounded-[var(--radius-douce)] border-l-2 p-3.5">
                        <p className="text-encre text-xs font-bold">Réponse de {entreprise.nom}</p>
                        <p className="text-encre-70 mt-1.5 text-sm">{avis.reponse.contenu}</p>
                      </div>
                    )}
                  </Carte>
                </li>
              ))}
            </ul>
          )}
        </Conteneur>
      </Section>

      {/* ── Autres professionnels : jamais sur une fiche Premium ou Exclusif ── */}
      {!sansConcurrents && agencePrincipale !== undefined && metierPrincipal !== undefined && (
        <Section fond="carte" className="py-12">
          <Conteneur>
            <TitreSection
              surtitre="À proximité"
              titre={
                <>
                  Autres professionnels à <Accent>{nomVille(agencePrincipale.commune.nom)}</Accent>
                </>
              }
            />
            <Link
              href={`/${metierPrincipal.metier.slug}/${agencePrincipale.commune.slug}`}
              className="text-or-fonce mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Voir tous les {metierPrincipal.metier.nom.toLowerCase()}s de{' '}
              {nomVille(agencePrincipale.commune.nom)}
            </Link>
          </Conteneur>
        </Section>
      )}

      <BarreCollante className="lg:hidden">
        <Link href="/demande">
          <Bouton aspect="or" pleineLargeur taille="grand">
            Demander un devis à {entreprise.nom}
          </Bouton>
        </Link>
      </BarreCollante>
    </>
  );
}
