import type { ReactNode } from 'react';
import { Accent, Carte, Conteneur, Section } from '@lerenom/ui';
import { FilAriane } from './FilAriane';

export interface SectionContenu {
  readonly titre: string;
  readonly paragraphes: readonly string[];
  readonly points?: readonly string[];
}

/**
 * Le gabarit des pages de contenu : légales, de confiance, d'explication.
 *
 * Elles se ressemblent volontairement. Un visiteur qui cherche une information contractuelle ne
 * veut pas découvrir une nouvelle mise en page à chaque page ; il veut lire.
 */
export function PageContenu({
  titre,
  accent,
  chapeau,
  miseAJour,
  avertissement,
  sections,
  apres,
}: {
  readonly titre: string;
  readonly accent?: string;
  readonly chapeau: string;
  readonly miseAJour: string;
  readonly avertissement?: string;
  readonly sections: readonly SectionContenu[];
  readonly apres?: ReactNode;
}) {
  return (
    <>
      <Section fond="creme" className="pt-8 pb-10 md:pt-10">
        <Conteneur>
          <FilAriane elements={[{ libelle: 'Accueil', href: '/' }, { libelle: titre }]} />
          <h1 className="mt-6 max-w-[24ch] text-[clamp(1.9rem,4.4vw,3rem)]">
            {titre}
            {accent !== undefined && (
              <>
                {' '}
                <Accent>{accent}</Accent>
              </>
            )}
          </h1>
          <p className="text-encre-70 mt-4 max-w-[64ch] text-[1.05rem]">{chapeau}</p>
          <p className="text-encre-55 mt-4 text-sm">Dernière mise à jour : {miseAJour}</p>

          {avertissement !== undefined && (
            <Carte className="border-alerte/25 bg-alerte-fond mt-6 max-w-[70ch] p-5">
              <p className="text-alerte text-sm leading-relaxed">{avertissement}</p>
            </Carte>
          )}
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <div className="max-w-[70ch] space-y-10">
            {sections.map((section) => (
              <section key={section.titre}>
                <h2 className="text-[1.6rem]">{section.titre}</h2>
                {section.paragraphes.map((paragraphe) => (
                  <p key={paragraphe.slice(0, 40)} className="text-encre-70 mt-4 leading-relaxed">
                    {paragraphe}
                  </p>
                ))}
                {section.points !== undefined && (
                  <ul className="mt-4 space-y-2.5">
                    {section.points.map((point) => (
                      <li key={point.slice(0, 40)} className="text-encre-70 flex gap-3">
                        <span
                          aria-hidden="true"
                          className="bg-or mt-2 size-1.5 shrink-0 rounded-full"
                        />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          {apres}
        </Conteneur>
      </Section>
    </>
  );
}
