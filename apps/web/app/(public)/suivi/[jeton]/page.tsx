import type { Metadata } from 'next';
import { Accent, Carte, Conteneur, Section } from '@lerenom/ui';
import { resoudLien } from '@lerenom/liens';
import { FormulaireAvis } from '@/composants/FormulaireAvis';
import { SuiviDemande } from '@/composants/SuiviDemande';
import { contexteAvis } from '@/lib/avis';
import { suiviDeLaDemande } from '@/lib/suivi';

/**
 * La page de suivi d'une demande, côté client.
 *
 * C'est tout ce que Le Renom offre à un client : pas de compte, pas de mot de passe, un lien
 * reçu par SMS. La page n'est donc jamais mise en cache, jamais indexée, et ne montre que la
 * demande que le jeton désigne.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Suivi de votre demande',
  // Une page privée n'a rien à faire dans un moteur de recherche, même par accident.
  robots: { index: false, follow: false, nocache: true },
};

/** Les écrans d'échec. Ils sont avares : ils ne disent jamais si une demande existe. */
function Impasse({ titre, texte }: { readonly titre: string; readonly texte: string }) {
  return (
    <Section fond="creme" className="py-16">
      <Conteneur>
        <Carte className="mx-auto max-w-[36rem] p-7 text-center">
          <span className="bg-encre/6 text-encre-55 mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
            ⌛
          </span>
          <h1 className="mt-5 text-2xl">{titre}</h1>
          <p className="text-encre-70 mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed">{texte}</p>
          <p className="text-encre-55 mt-6 text-sm">
            Pour toute question, répondez simplement au SMS reçu : un conseiller vous répond.
          </p>
        </Carte>
      </Conteneur>
    </Section>
  );
}

export default async function PageSuivi({
  params,
}: {
  readonly params: Promise<{ readonly jeton: string }>;
}) {
  const { jeton } = await params;
  const resolution = await resoudLien(jeton);

  if (resolution.issue === 'inconnu') {
    return (
      <Impasse
        titre="Ce lien n’est pas valide"
        texte="Il a peut-être été recopié partiellement. Ouvrez-le depuis le SMS ou le courriel que vous avez reçu, plutôt que de le retaper."
      />
    );
  }

  if (resolution.issue === 'expire') {
    return (
      <Impasse
        titre="Ce lien a expiré"
        texte="Les liens de suivi se ferment au bout de quelques semaines, pour que vos coordonnées ne restent pas accessibles indéfiniment. Déposez une nouvelle demande si votre besoin est toujours d’actualité."
      />
    );
  }

  if (resolution.issue === 'deja-utilise') {
    return (
      <Impasse
        titre="Ce lien a déjà servi"
        texte="L’action qu’il portait a été effectuée. Si ce n’est pas vous, répondez au SMS reçu : nous vérifierons."
      />
    );
  }

  // Le lien d'invitation à l'avis mène au formulaire, pas au suivi : une action, un écran.
  if (resolution.lien.action === 'deposer_avis') {
    const contexte = await contexteAvis(resolution.lien.demandeId, resolution.lien.cibleId);

    if (contexte === null) {
      return (
        <Impasse
          titre="Cet avis n’est plus possible"
          texte="L’intervention concernée est introuvable. Si vous pensez qu’il s’agit d’une erreur, répondez au SMS reçu."
        />
      );
    }

    if (contexte.droit.issue === 'deja-depose') {
      return (
        <Impasse
          titre="Votre avis a déjà été déposé"
          texte="Merci : il est relu avant publication, comme tous les avis. Vous serez prévenu de sa publication, ou de son refus et de son motif."
        />
      );
    }

    if (contexte.droit.issue !== 'peut-deposer') {
      return (
        <Impasse
          titre="Cet avis n’est pas encore possible"
          texte="Un avis ne peut être déposé qu’après une intervention réellement effectuée. C’est ce qui nous permet d’écrire « avis vérifié » sans mentir."
        />
      );
    }

    return (
      <Section fond="creme" className="py-12 md:py-16">
        <Conteneur>
          <FormulaireAvis
            jeton={jeton}
            reference={contexte.reference}
            prenom={contexte.prenom}
            cible={{ nom: contexte.nomPro, ville: contexte.villePro }}
          />
        </Conteneur>
      </Section>
    );
  }

  const suivi = await suiviDeLaDemande(resolution.lien.demandeId);
  if (suivi === null) {
    return (
      <Impasse
        titre="Cette demande n’existe plus"
        texte="Elle a été supprimée, à votre demande ou à l’issue de sa durée de conservation."
      />
    );
  }

  return (
    <>
      <Section fond="creme" className="pt-8 pb-8">
        <Conteneur>
          <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Demande {suivi.reference}
          </p>
          <h1 className="mt-3 max-w-[24ch] text-[clamp(1.8rem,4.2vw,2.7rem)]">
            Bonjour {suivi.prenom}, <Accent>où en est votre demande</Accent>
          </h1>
          <p className="text-encre-70 mt-3 max-w-[56ch]">
            {suivi.besoin} à {suivi.ville}. Cette page vous appartient : personne d’autre n’y a
            accès, et aucun compte ne vous sera demandé.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="pt-0 pb-16">
        <Conteneur>
          <SuiviDemande jeton={jeton} suivi={suivi} />
        </Conteneur>
      </Section>
    </>
  );
}
