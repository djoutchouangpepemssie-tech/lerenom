'use client';

import Link from 'next/link';

/**
 * La barre au-dessus d'un document : retour, impression, et ce qui manque.
 *
 * Elle ne s'imprime pas — `lr-sans-impression` la retire. C'est le seul élément de la page qui
 * ne fait pas partie du document, et il doit le rester.
 *
 * « Enregistrer en PDF » plutôt que « Télécharger » : le bouton ouvre la boîte d'impression du
 * navigateur, où l'enregistrement en PDF est une destination. Annoncer un téléchargement qui
 * ouvre une boîte de dialogue serait un mensonge d'interface, et la vraie génération côté
 * serveur n'existe pas encore (voir `docs/QUESTIONS.md` §Q35).
 *
 * Les mentions manquantes s'affichent ici dans les deux cas, mais pas avec les mêmes mots.
 * Avant l'émission, c'est une consigne : voici ce qu'il reste à remplir. Après, c'est un
 * constat — la facture ne se modifie plus, et le professionnel a le droit de savoir qu'un
 * document parti chez son client est incomplet, pour ne pas refaire la même demain.
 *
 * Dans les deux cas, la barre ne s'imprime pas : l'exemplaire du client ne porte aucune de ces
 * mentions internes.
 */
export function BarreImpression({
  retour,
  manquants,
  emise,
}: {
  readonly retour: string;
  readonly manquants: readonly string[];
  readonly emise: boolean;
}) {
  const aDesLacunes = manquants.length > 0;

  return (
    <div className="lr-sans-impression mx-auto mb-4 w-[210mm] max-w-full px-4 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={retour}
          className="text-sm font-semibold text-[#3a3a38] transition-colors hover:text-black"
        >
          ← Retour
        </Link>
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
          className="rounded-[10px] bg-[#16181D] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Imprimer ou enregistrer en PDF
        </button>
      </div>

      {aDesLacunes && (
        <div className="mt-3 rounded-[10px] border border-[#e4c9c9] bg-[#fdf3f3] p-4">
          <p className="text-sm font-bold text-[#8c1c1c]">
            {manquants.length === 1
              ? 'Une mention obligatoire manque.'
              : `${String(manquants.length)} mentions obligatoires manquent.`}
          </p>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-[#5c3030]">
            {emise ? (
              <>
                Cette facture est émise : elle ne se modifie plus. Complétez vos informations dans{' '}
                <a className="underline" href="/pro/espace/documents">
                  les réglages de vos documents
                </a>{' '}
                pour que les suivantes soient en règle.
              </>
            ) : (
              <>
                Une facture incomplète expose à une amende, et elle ne se corrigera plus une fois
                émise. Complétez-les dans{' '}
                <a className="underline" href="/pro/espace/documents">
                  les réglages de vos documents
                </a>
                .
              </>
            )}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.8rem] text-[#5c3030]">
            {manquants.map((manquant) => (
              <li key={manquant}>{manquant}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
