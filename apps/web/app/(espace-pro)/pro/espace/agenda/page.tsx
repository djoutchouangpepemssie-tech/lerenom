import type { Metadata } from 'next';
import { SemaineAgenda } from '@/composants/SemaineAgenda';
import { clientsDuPro, semaineDuPro } from '@/lib/agenda-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'agenda du professionnel, semaine par semaine.
 *
 * La semaine affichée est dans l'adresse (`?semaine=2026-03-03`) plutôt que dans l'état du
 * composant : un agenda se partage, se met en favori et se recharge. Une semaine qui
 * n'existerait que dans la mémoire du navigateur se perdrait à chaque rafraîchissement.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon agenda',
  robots: { index: false, follow: false },
};

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Le premier du mois s'écrit « 1er », les autres en chiffres simples.
 *
 * Un détail, mais c'est celui qui distingue une date écrite d'une date recrachée par une
 * machine — et une semaine sur quatre tombe dessus.
 */
function quantieme(date: Date): string {
  return date.getDate() === 1 ? '1er' : String(date.getDate());
}

/** « Du 2 au 8 mars 2026 », en évitant de répéter le mois quand il est le même. */
function libelleDe(premier: Date, dernier: Date): string {
  const memeMois = premier.getMonth() === dernier.getMonth();
  const debut = memeMois
    ? quantieme(premier)
    : `${quantieme(premier)} ${MOIS[premier.getMonth()] ?? ''}`;
  return `Du ${debut} au ${quantieme(dernier)} ${MOIS[dernier.getMonth()] ?? ''} ${String(dernier.getFullYear())}`;
}

function jourISO(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export default async function PageAgenda({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly semaine?: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) return null;

  const { semaine } = await searchParams;
  // Une adresse trafiquée ne doit pas produire une page en erreur : on retombe sur
  // aujourd'hui, ce que l'utilisateur voulait voir neuf fois sur dix.
  const demande = semaine === undefined ? new Date() : new Date(`${semaine}T12:00:00`);
  const jour = Number.isFinite(demande.getTime()) ? demande : new Date();

  const [{ jours, plages }, clients] = await Promise.all([
    semaineDuPro(pro.entrepriseId, jour),
    clientsDuPro(pro.entrepriseId),
  ]);
  const premier = jours[0];
  const dernier = jours[6];
  if (premier === undefined || dernier === undefined) return null;

  const precedente = new Date(premier);
  precedente.setDate(precedente.getDate() - 7);
  const suivante = new Date(premier);
  suivante.setDate(suivante.getDate() + 7);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mon agenda</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Vos interventions, vos visites et vos indisponibilités. Un créneau proposé à un client
        réserve l’horaire jusqu’à sa réponse, puis le libère de lui-même au bout de deux jours.
      </p>

      <div className="mt-7">
        <SemaineAgenda
          jours={jours.map((date) => date.toISOString())}
          plages={plages.map((plage) => ({
            id: plage.id,
            rendezVousId: plage.rendezVousId,
            type: plage.type,
            debut: plage.debut.toISOString(),
            fin: plage.fin.toISOString(),
            expireLe: plage.expireLe?.toISOString() ?? null,
            clientNom: plage.clientNom,
            demandeReference: plage.demandeReference,
            statutRendezVous: plage.statutRendezVous,
          }))}
          semainePrecedente={`/pro/espace/agenda?semaine=${jourISO(precedente)}`}
          semaineSuivante={`/pro/espace/agenda?semaine=${jourISO(suivante)}`}
          libelleSemaine={libelleDe(premier, dernier)}
          clients={clients}
        />
      </div>
    </>
  );
}
