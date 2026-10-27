import Link from 'next/link';
import { Accent, Bouton, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { PARAMETRES_PAR_DEFAUT, REGLES_VALIDEES } from '@lerenom/core';
import { FilAriane } from '@/composants/FilAriane';

export const metadata = {
  title: 'Comment ça marche',
  description:
    'De la demande au devis signé : ce qui se passe, dans quel ordre, et ce que vous recevez à chaque étape.',
};

const ETAPES = [
  {
    moment: 'Jour J, en 3 minutes',
    titre: 'Vous décrivez votre besoin',
    texte:
      'Choisissez votre prestation dans le catalogue, précisez la ville, répondez à trois questions adaptées à votre univers et joignez jusqu’à six photos. Un code à six chiffres vérifie votre mobile : c’est ce qui protège les professionnels des demandes fantaisistes, et vous des concurrents déguisés.',
  },
  {
    moment: 'Dans les minutes qui suivent',
    titre: 'Votre demande part aux professionnels',
    texte: `Trois professionnels au maximum, jamais plus. Le partenaire Exclusif de votre zone la reçoit seul pendant ${PARAMETRES_PAR_DEFAUT.minutesExclusiviteExclusif} minutes, puis viennent les partenaires Premium, puis les autres professionnels. Cette priorité vous est annoncée avant l’envoi.`,
  },
  {
    moment: 'Avant d’accepter',
    titre: 'Ils voient votre besoin, pas vos coordonnées',
    texte:
      'Un professionnel voit le besoin, votre quartier sans la rue, la distance depuis son agence, la date souhaitée, le budget et votre prénom. Vos numéros et adresses écrits dans le texte sont retirés automatiquement, et vos photos sont débarrassées de leur géolocalisation.',
  },
  {
    moment: 'Dès qu’un professionnel accepte',
    titre: 'Vous recevez ses coordonnées par SMS',
    texte:
      'Nom, distinction de formule, note, avis vérifiés et téléphone. Son acceptation est définitive de son côté : il s’engage à vous répondre. Vous, vous ne vous engagez à rien.',
  },
  {
    moment: 'Les jours suivants',
    titre: 'Rendez-vous, devis, signature',
    texte:
      'Le professionnel vous propose trois créneaux, vous en choisissez un depuis un lien, et vous recevez des rappels la veille et deux heures avant. Son devis vous arrive en PDF, et vous le signez par code SMS, demandez une modification ou le refusez.',
  },
  {
    moment: '15 jours après les travaux',
    titre: 'Vous donnez votre avis',
    texte:
      'Une seule page, une seule note, quelques mots si vous le souhaitez. C’est ce lien avec des travaux réellement réalisés qui nous permet d’écrire « avis vérifié » sans mentir.',
  },
] as const;

export default function PageCommentCaMarche() {
  return (
    <>
      <Section fond="creme" className="pt-8 pb-10 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Comment ça marche' }]}
          />
          <h1 className="mt-6 max-w-[22ch] text-[clamp(1.9rem,4.4vw,3rem)]">
            De votre besoin au <Accent>devis signé</Accent>
          </h1>
          <p className="text-encre-70 mt-4 max-w-[62ch] text-[1.05rem]">
            Vous n’avez aucun compte à créer. Tout arrive par SMS et par e-mail, et chaque lien
            ouvre une page qui ne fait qu’une seule chose.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <ol className="border-bordure relative max-w-[72ch] space-y-8 border-l pl-8">
            {ETAPES.map((etape, index) => (
              <li key={etape.titre} className="relative">
                <span
                  aria-hidden="true"
                  className="border-or/40 bg-or/15 text-or-fonce absolute top-1.5 -left-[2.3rem] flex size-7 items-center justify-center rounded-full border font-[family-name:var(--font-titre)] text-sm"
                >
                  {index + 1}
                </span>
                <p className="text-or-fonce text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                  {etape.moment}
                </p>
                <h2 className="mt-1.5 text-xl">{etape.titre}</h2>
                <p className="text-encre-70 mt-2.5 leading-relaxed">{etape.texte}</p>
              </li>
            ))}
          </ol>
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Nos limites, écrites"
            titre={
              <>
                Ce que nous ne ferons <Accent>jamais</Accent>
              </>
            }
          />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                titre: `Jamais plus de ${REGLES_VALIDEES.prosMaxParDemande} professionnels`,
                texte:
                  'Votre demande n’est transmise qu’à trois professionnels au maximum. Pas cinq, pas dix, et jamais « quelques-uns de plus » un jour de faible activité.',
              },
              {
                titre: `Jamais après ${REGLES_VALIDEES.heuresFraicheurDemande} heures`,
                texte:
                  'Une demande n’est jamais proposée au-delà de 72 heures. Recevoir un appel trois semaines après avoir fait réparer sa fuite est la critique la plus courante faite aux plateformes : nous ne la reproduisons pas.',
              },
              {
                titre: 'Jamais vos coordonnées sans accord',
                texte:
                  'Vos coordonnées ne sont transmises qu’aux professionnels qui acceptent votre demande, et le texte exact de votre consentement est conservé avec elle.',
              },
            ].map((limite) => (
              <li key={limite.titre}>
                <Carte className="h-full p-5">
                  <h3 className="text-lg">{limite.titre}</h3>
                  <p className="text-encre-70 mt-2.5 text-sm leading-relaxed">{limite.texte}</p>
                </Carte>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Link href="/comment-nous-classons">
              <Bouton aspect="contour" taille="grand">
                Comment nous classons les professionnels
              </Bouton>
            </Link>
          </div>
        </Conteneur>
      </Section>
    </>
  );
}
