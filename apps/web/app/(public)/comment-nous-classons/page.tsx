import Link from 'next/link';
import { Accent, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { PARAMETRES_PAR_DEFAUT, REGLES_VALIDEES } from '@lerenom/core';
import { FilAriane } from '@/composants/FilAriane';

export const metadata = {
  title: 'Comment nous classons les professionnels',
  description:
    'La méthode de classement de Le Renom : les emplacements payés, le score de qualité et ce que le paiement ne change pas.',
};

const POIDS = [
  {
    critere: 'Qualité des avis',
    part: PARAMETRES_PAR_DEFAUT.poidsScore.avis,
    detail:
      'La note moyenne, corrigée par le nombre d’avis : un unique 5 sur 5 ne passe pas devant cinquante avis à 4,7. Seuls comptent les avis liés à une demande réelle et à des travaux déclarés réalisés.',
  },
  {
    critere: 'Activité sur Le Renom',
    part: PARAMETRES_PAR_DEFAUT.poidsScore.activite,
    detail:
      'Les demandes traitées, les réponses apportées, la régularité de la présence. Une entreprise qui répond fait avancer les demandes ; une entreprise absente les bloque.',
  },
  {
    critere: 'Pertinence pour votre besoin',
    part: PARAMETRES_PAR_DEFAUT.poidsScore.pertinence,
    detail:
      'La correspondance entre votre prestation et les métiers déclarés, la complétude de la fiche du professionnel, et la proximité entre votre commune et celle de son agence la plus proche. Cette proximité est mesurée de commune à commune : elle distingue un artisan de votre ville d’un artisan à trente kilomètres, pas deux artisans de votre quartier. Nous l’écrivons donc à cette échelle, sans fausse précision.',
  },
  {
    critere: 'Réactivité',
    part: PARAMETRES_PAR_DEFAUT.poidsScore.reactivite,
    detail:
      'Le taux de réponse aux demandes reçues et le délai moyen de première réponse. Un professionnel qui laisse expirer ses demandes descend.',
  },
  {
    critere: 'Fraîcheur de la fiche',
    part: PARAMETRES_PAR_DEFAUT.poidsScore.fraicheur,
    detail:
      'La date de dernière mise à jour de la fiche, des photos, des horaires et des prestations. Une fiche à jour est une fiche utile.',
  },
] as const;

/**
 * La page publique de transparence, exigée par la loyauté des plateformes.
 *
 * Les chiffres qu'elle affiche — poids du score, note minimale, nombre de places payées — sont
 * **lus dans les règles du moteur**, pas recopiés à la main. Une page de transparence qui
 * finirait par mentir en se désynchronisant serait pire que pas de page du tout.
 */
export default function PageCommentNousClassons() {
  return (
    <>
      <Section fond="creme" className="pt-8 pb-12 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Comment nous classons' }]}
          />
          <h1 className="mt-6 max-w-[22ch] text-[clamp(1.9rem,4.4vw,3rem)]">
            Comment nous classons les <Accent>professionnels</Accent>
          </h1>
          <p className="text-encre-70 mt-4 max-w-[64ch] text-[1.05rem]">
            Deux mécanismes, strictement séparés : des emplacements payés, toujours étiquetés, et un
            classement par score de qualité où le paiement ne compte pour rien. Cette page explique
            les deux, sans rien omettre.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="1. Les emplacements payés"
            titre={
              <>
                Trois places au maximum, <Accent>toujours signalées</Accent>
              </>
            }
          />

          <div className="mt-8 space-y-4">
            <Carte className="p-6">
              <h3 className="text-lg">Place 1 — le partenaire Exclusif</h3>
              <p className="text-encre-70 mt-2 text-sm leading-relaxed">
                Une entreprise peut acheter l’exclusivité d’un métier sur une zone. Elle occupe
                alors la première place des résultats de ce métier dans cette zone. Il n’y en a
                jamais plus d’une, et l’emplacement porte la mention « Sponsorisé ».
              </p>
            </Carte>

            <Carte className="p-6">
              <h3 className="text-lg">Places 2 et 3 — les partenaires Premium</h3>
              <p className="text-encre-70 mt-2 text-sm leading-relaxed">
                Deux emplacements, partagés en <strong>rotation équitable</strong> entre les
                partenaires Premium du métier dans cette ville. S’ils sont cinq pour deux places,
                chacun apparaît sur 40 % des affichages — exactement, pas approximativement. Nous en
                limitons le nombre à {REGLES_VALIDEES.premiumMaxParMetierVille} par métier et par
                ville, pour que chacun garde au moins un affichage sur trois.
              </p>
            </Carte>

            <Carte className="border-or/30 bg-or/[0.06] p-6">
              <h3 className="text-lg">Ce qu’un emplacement payé ne dit pas</h3>
              <p className="text-encre-70 mt-2 text-sm leading-relaxed">
                Il ne dit <strong>rien</strong> de la qualité du travail. C’est un abonnement, et
                nous l’écrivons sur chaque emplacement et dans chaque info-bulle. Une fiche payante
                dont la note descend sous{' '}
                {PARAMETRES_PAR_DEFAUT.noteMinimale.toString().replace('.', ',')} sur 5 perd sa
                place sponsorisée tant que sa note n’est pas remontée.
              </p>
            </Carte>
          </div>
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="2. Le classement naturel"
            titre={
              <>
                Un score de qualité, <Accent>cinq critères</Accent>
              </>
            }
            chapeau="Toutes les entreprises y sont classées, abonnées comprises. Le montant payé n’entre dans aucun de ces cinq critères."
          />

          <ul className="mt-9 space-y-3">
            {POIDS.map((critere) => (
              <li key={critere.critere}>
                <Carte className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 items-baseline gap-2 sm:w-28">
                    <span className="text-or-fonce font-[family-name:var(--font-titre)] text-3xl">
                      {Math.round(critere.part * 100)}
                    </span>
                    <span className="text-encre-55 text-sm">%</span>
                  </div>
                  <div>
                    <h3 className="text-lg">{critere.critere}</h3>
                    <p className="text-encre-70 mt-1.5 text-sm leading-relaxed">{critere.detail}</p>
                  </div>
                </Carte>
              </li>
            ))}
          </ul>

          <p className="text-encre-55 mt-6 text-sm">
            Le score est recalculé chaque nuit. Une entreprise déjà affichée dans une place payée
            est retirée du classement naturel : elle n’apparaît jamais deux fois sur la même page.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="3. Les demandes de devis"
            titre={
              <>
                Qui reçoit votre demande, et <Accent>dans quel ordre</Accent>
              </>
            }
          />
          <div className="mt-8 space-y-4">
            <Carte className="p-6">
              <p className="text-encre-70 text-sm leading-relaxed">
                Votre demande est transmise à{' '}
                <strong>{REGLES_VALIDEES.prosMaxParDemande} professionnels au maximum</strong>,
                jamais plus, et jamais au-delà de {REGLES_VALIDEES.heuresFraicheurDemande} heures.
                Les partenaires de Le Renom sont contactés en priorité : le partenaire Exclusif de
                la zone d’abord, seul pendant {PARAMETRES_PAR_DEFAUT.minutesExclusiviteExclusif}{' '}
                minutes, puis les partenaires Premium, puis les autres professionnels. Cette
                priorité vous est annoncée au moment de l’envoi, c’est la loi et c’est normal que
                vous le sachiez.
              </p>
            </Carte>
            <Carte className="p-6">
              <p className="text-encre-70 text-sm leading-relaxed">
                Vos coordonnées ne sont transmises qu’aux professionnels qui{' '}
                <strong>acceptent</strong> votre demande. Avant d’accepter, un professionnel voit
                votre besoin, votre quartier sans la rue, la date souhaitée, le budget et votre
                prénom — ni votre téléphone, ni votre adresse exacte.
              </p>
            </Carte>
          </div>
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <Carte className="p-6">
            <h2 className="text-xl">Les badges, et ce qu’ils veulent dire</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-encre font-bold">Badges payants</p>
                <p className="text-encre-70 mt-1.5 text-sm">
                  « PRO », « Partenaire Premium », « Partenaire Exclusif ». Ils disent qu’une offre
                  est souscrite, et rien d’autre. Nous ne leur associons jamais un mot comme «
                  Recommandé », « Meilleur » ou « Certifié ».
                </p>
              </div>
              <div>
                <p className="text-encre font-bold">Badges de mérite</p>
                <p className="text-encre-70 mt-1.5 text-sm">
                  « Entreprise vérifiée », « SIRET vérifié », « Assurance décennale vérifiée », «
                  Très bien noté », « Répond en moins d’1 h », « Avis vérifiés ». Ils sont gratuits,
                  calculés à partir de critères publiés, et accessibles à toutes les fiches, y
                  compris gratuites.
                </p>
              </div>
            </div>
            <p className="text-encre-55 mt-6 text-sm">
              Une question sur un classement ou un avis ?{' '}
              <Link
                href="/signaler"
                className="text-or-fonce font-semibold underline underline-offset-4"
              >
                Signalez-le-nous
              </Link>
              .
            </p>
          </Carte>
        </Conteneur>
      </Section>
    </>
  );
}
