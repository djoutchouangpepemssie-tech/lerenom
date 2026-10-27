import Link from 'next/link';
import { BadgePayant, Carte, Epingle, MentionSponsorise, Note } from '@lerenom/ui';
import type { ProAffiche } from '@/lib/donnees';
import { nomVille } from '@/lib/affichage';
import { ExplicationRang } from './ExplicationRang';

/**
 * Une entreprise dans une liste de résultats.
 *
 * La carte change d'allure selon l'emplacement — sombre pour l'Exclusif, liseré or pour un
 * Premium — mais la mention « Sponsorisé » et le bouton « Pourquoi ce résultat ? » sont
 * toujours là, lisibles, et jamais masqués par la personnalisation d'une fiche.
 */
export function CarteResultat({
  pro,
  index,
}: {
  readonly pro: ProAffiche;
  readonly index: number;
}) {
  const estExclusif = pro.raison === 'emplacement-exclusif';
  const estPremium = pro.raison === 'emplacement-premium';

  return (
    <Carte survolable sombre={estExclusif} liseréOr={estPremium} className="p-4 md:p-5">
      <div className="flex items-start gap-4">
        <Epingle
          variante={estExclusif ? 'couronne' : estPremium ? 'or' : 'standard'}
          retardMs={index * 70}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/entreprise/${pro.slug}`}
              className={`font-[family-name:var(--font-titre)] text-lg md:text-xl ${
                estExclusif ? 'text-creme' : 'text-encre'
              }`}
            >
              {pro.nom}
            </Link>
            {pro.formule !== 'gratuit' && <BadgePayant formule={pro.formule} />}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Note note={pro.note} nombreAvis={pro.nombreAvis} taille="petite" clair={estExclusif} />
            {pro.communeAgence !== null && (
              <span className={`text-xs ${estExclusif ? 'text-creme/55' : 'text-encre-55'}`}>
                {nomVille(pro.communeAgence)}
              </span>
            )}
          </div>

          {pro.description !== null && (
            <p
              className={`mt-2.5 line-clamp-2 text-sm leading-relaxed ${
                estExclusif ? 'text-creme/70' : 'text-encre-70'
              }`}
            >
              {pro.description}
            </p>
          )}

          {pro.sponsorise && (
            <div className="mt-3">
              <ExplicationRang raison={pro.raison} sombre={estExclusif} />
            </div>
          )}
          {!pro.sponsorise && (
            <div className="mt-3">
              <ExplicationRang raison={pro.raison} sombre={false} />
            </div>
          )}
        </div>

        <Link href={`/entreprise/${pro.slug}`} className="hidden shrink-0 sm:block">
          <span
            className={`inline-flex min-h-10 items-center rounded-[var(--radius-douce)] border px-4 text-sm font-semibold transition-colors ${
              estExclusif
                ? 'border-or bg-or text-encre hover:bg-or-clair'
                : 'border-bordure bg-carte text-encre hover:border-or'
            }`}
          >
            Voir la fiche
          </span>
        </Link>
      </div>
    </Carte>
  );
}

export { MentionSponsorise };
