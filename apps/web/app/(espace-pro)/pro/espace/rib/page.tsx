import type { Metadata } from 'next';
import { Carte } from '@lerenom/ui';
import { formateIban } from '@lerenom/core';
import { FormulaireRib } from '@/composants/FormulaireRib';
import { etatBancaire } from '@/lib/rib-pro';
import { dateSeule } from '@/lib/affichage';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le compte bancaire du professionnel : celui qui figure sur ses factures.
 *
 * La page montre aussi les comptes remplacés, et pourquoi ils ne s'effacent pas. Un
 * professionnel qui ne verrait que son compte actuel se demanderait, un jour, pourquoi une
 * vieille facture indique un IBAN qu'il ne reconnaît plus.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon compte bancaire',
  robots: { index: false, follow: false },
};

export default async function PageRib() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const etat = await etatBancaire(pro.entrepriseId);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mon compte bancaire</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        C’est le compte qui figure sur vos factures. Il y est figé au moment de l’émission : un
        client qui paie une facture de l’an dernier la paie sur le compte qui y est inscrit, pas sur
        le dernier que vous avez enregistré.
      </p>

      <div className="mt-7 grid max-w-3xl gap-6">
        {etat.actif === null ? (
          <Carte className="p-5">
            <p className="text-encre text-sm font-bold">Aucun compte enregistré</p>
            <p className="text-encre-70 mt-2 text-sm">
              Vos factures s’émettent quand même — un client peut payer autrement — mais elles
              n’indiquent pas où virer.
            </p>
          </Carte>
        ) : (
          <Carte className="p-5">
            <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Compte actif
            </p>
            <p className="text-encre mt-3 font-semibold">{etat.actif.titulaire}</p>
            <p className="text-encre-70 mt-1 font-mono text-sm break-all">
              {formateIban(etat.actif.iban)}
            </p>
            <p className="text-encre-55 mt-1 font-mono text-xs">{etat.actif.bic}</p>
            {etat.actif.banque !== null && (
              <p className="text-encre-55 mt-1 text-xs">{etat.actif.banque}</p>
            )}
            {etat.actif.confirmeParSmsLe !== null && (
              <p className="text-encre-55 mt-3 text-xs">
                Confirmé par SMS le {dateSeule(etat.actif.confirmeParSmsLe)}.
                {etat.actif.facturesEmises > 0 &&
                  ` ${String(etat.actif.facturesEmises)} facture${etat.actif.facturesEmises > 1 ? 's' : ''} émise${etat.actif.facturesEmises > 1 ? 's' : ''} sur ce compte.`}
              </p>
            )}
          </Carte>
        )}

        <FormulaireRib
          mobileMasque={etat.mobileMasque}
          ribEnAttenteId={etat.enAttente?.id ?? null}
          remplacement={etat.actif !== null}
        />

        {etat.anciens.length > 0 && (
          <Carte className="p-5">
            <p className="text-encre text-sm font-bold">Comptes remplacés</p>
            <p className="text-encre-70 mt-2 text-sm">
              Ils ne s’effacent pas : des factures déjà émises les désignent, et ces factures ne se
              modifient plus.
            </p>
            <ul className="mt-4 space-y-3">
              {etat.anciens.map((ancien) => (
                <li key={ancien.id} className="border-bordure border-l-2 pl-3">
                  <p className="text-encre-70 font-mono text-xs break-all">
                    {formateIban(ancien.iban)}
                  </p>
                  <p className="text-encre-55 mt-0.5 text-xs">
                    {ancien.titulaire}
                    {ancien.remplaceLe !== null && ` · remplacé le ${dateSeule(ancien.remplaceLe)}`}
                    {ancien.facturesEmises > 0 &&
                      ` · ${String(ancien.facturesEmises)} facture${ancien.facturesEmises > 1 ? 's' : ''}`}
                  </p>
                </li>
              ))}
            </ul>
          </Carte>
        )}
      </div>
    </>
  );
}
