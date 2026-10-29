import type { Metadata } from 'next';
import Link from 'next/link';
import { Bouton, Carte, Chiffre, Jauge, Note } from '@lerenom/ui';
import { chiffresDuMois, demandesEnAttente } from '@/lib/espace-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le tableau de bord.
 *
 * Quatre indicateurs au maximum, c'est la règle de mise en page du projet, et elle vaut aussi
 * ici : un tableau de bord qui affiche quinze chiffres n'en fait lire aucun. Ce qui compte
 * pour un artisan, c'est ce qui attend une réponse — le reste est du contexte.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tableau de bord',
  robots: { index: false, follow: false },
};

const FORMULES: Readonly<Record<string, string>> = {
  gratuit: 'Gratuit',
  essentiel: 'Essentiel',
  premium: 'Premium',
  exclusif: 'Exclusif',
};

export default async function PageTableauDeBord() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const [chiffres, enAttente] = await Promise.all([
    chiffresDuMois(pro.entrepriseId),
    demandesEnAttente(pro.entrepriseId),
  ]);

  const prochaine = enAttente[0];

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Bonjour {pro.nom.split(' ')[0]}</h1>
      <p className="text-encre-70 mt-2">
        {pro.entreprise}
        {chiffres.ville !== null && ` · ${chiffres.ville}`} · formule{' '}
        {FORMULES[chiffres.formule] ?? chiffres.formule}
      </p>

      {/* ── Ce qui attend une réponse ──────────────────────────────────── */}
      <Carte className={chiffres.enAttente > 0 ? 'border-or/40 bg-or/[0.06] mt-7 p-5' : 'mt-7 p-5'}>
        {chiffres.enAttente > 0 && prochaine !== undefined ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-bold">
                {chiffres.enAttente === 1
                  ? 'Une demande attend votre réponse'
                  : `${String(chiffres.enAttente)} demandes attendent votre réponse`}
              </p>
              <p className="text-encre-70 mt-1 text-sm">
                La plus urgente : {prochaine.besoin} à {prochaine.ville}.
              </p>
            </div>
            <Link href="/pro/espace/demandes">
              <Bouton aspect="or">Voir mes demandes</Bouton>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-bold">Rien n’attend votre réponse</p>
              <p className="text-encre-70 mt-1 text-sm">
                Vous recevrez un SMS dès qu’une demande vous est proposée.
              </p>
            </div>
            <Link href="/pro/espace/demandes">
              <Bouton aspect="contour">Voir l’historique</Bouton>
            </Link>
          </div>
        )}
      </Carte>

      {/* ── Les quatre chiffres ────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Carte className="p-5">
          <dl>
            <Chiffre
              valeur={String(chiffres.demandesAcceptees)}
              libelle="Demandes acceptées ce mois"
            />
          </dl>
          {chiffres.demandesIncluses > 0 && (
            <Jauge
              className="mt-4"
              valeur={Math.min(chiffres.demandesAcceptees, chiffres.demandesIncluses)}
              maximum={chiffres.demandesIncluses}
              etiquette="Forfait du mois"
              detail={`${String(chiffres.demandesAcceptees)} sur ${String(chiffres.demandesIncluses)} incluses`}
            />
          )}
        </Carte>

        <Carte className="p-5">
          <dl>
            <Chiffre
              valeur={`${chiffres.depenseHT.toFixed(2).replace('.', ',')} €`}
              libelle="Dépensé hors forfait ce mois (HT)"
            />
          </dl>
        </Carte>

        <Carte className="p-5">
          <dl>
            <Chiffre
              valeur={
                chiffres.tauxReponse === null
                  ? '—'
                  : `${String(Math.round(chiffres.tauxReponse * 100))} %`
              }
              libelle="Taux de réponse"
            />
          </dl>
          <p className="text-encre-55 mt-3 text-xs leading-relaxed">
            Part des demandes reçues auxquelles vous avez répondu, acceptation ou refus.
          </p>
        </Carte>

        <Carte className="p-5">
          <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Vos avis
          </p>
          <div className="mt-3">
            <Note note={chiffres.note} nombreAvis={chiffres.nombreAvis} taille="grande" />
          </div>
          <p className="text-encre-55 mt-3 text-xs leading-relaxed">
            {chiffres.nombreAvis === 0
              ? 'Vos premiers avis arriveront après vos premières interventions.'
              : 'Chaque avis vient d’une intervention réellement effectuée.'}
          </p>
        </Carte>
      </div>
    </>
  );
}
