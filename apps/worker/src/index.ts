/**
 * Le worker de Le Renom.
 *
 * Il fait tourner la cascade de distribution, les minuteurs, la péremption des demandes et le
 * recalcul nocturne des scores. Il ne décide de rien : toutes les règles viennent de
 * `@lerenom/core`, et tous les seuils de la table `parametres`, que le back-office modifie.
 */

import process from 'node:process';
import { Worker } from 'bullmq';
import { exigeConfiguration } from '@lerenom/securite';
import { prisma } from '@lerenom/db';
import { avanceCascade, executeTravailDeNuit, expire } from '@lerenom/distribution';
import { connexion, fermeFiles, fileNuit, programmeEcheance } from '@lerenom/files';
import type { TacheCascade, TacheEcheance } from '@lerenom/files';

// Avant toute connexion : un secret absent est une erreur de déploiement, pas un incident à
// découvrir au premier client qui valide son numéro.
exigeConfiguration(process.env);

const options = { connection: connexion(), concurrency: 8 };

/**
 * Avance la cascade d'une demande, puis programme l'échéance de chaque proposition envoyée.
 * C'est ce couplage — un envoi, un minuteur — qui garantit qu'aucune demande ne reste bloquée
 * parce qu'un professionnel ne répond pas.
 */
const workerCascade = new Worker<TacheCascade>(
  'cascade',
  async (tache) => {
    const resultat = await avanceCascade(tache.data.demandeId);

    if (resultat.envoyes.length > 0) {
      const envoyees = await prisma.distribution.findMany({
        where: { demandeId: tache.data.demandeId, statut: 'envoyee' },
        select: { id: true, echeanceLe: true },
      });
      await Promise.all(envoyees.map((d) => programmeEcheance(d.id, d.echeanceLe)));
    }

    return resultat;
  },
  options,
);

/** L'échéance d'une proposition : passé le délai, la demande va au suivant, sans rien facturer. */
const workerEcheances = new Worker<TacheEcheance>(
  'echeances',
  async (tache) => expire(tache.data.distributionId),
  options,
);

const workerNuit = new Worker<{ travail: string }>(
  'nuit',
  async (tache) => executeTravailDeNuit(tache.data.travail),
  { connection: connexion(), concurrency: 1 },
);

for (const worker of [workerCascade, workerEcheances, workerNuit]) {
  worker.on('failed', (tache, erreur) => {
    // Aucune donnée personnelle dans les journaux : on nomme la tâche, pas son contenu.
    console.error(
      `[worker] ${worker.name} · tâche ${tache?.id ?? '?'} en échec : ${erreur.message}`,
    );
  });
}

/**
 * Les travaux de nuit, programmés une fois pour toutes. L'identifiant fixe rend l'opération
 * idempotente : redémarrer le worker ne crée pas de second calendrier.
 */
await fileNuit().upsertJobScheduler(
  'scores-nocturnes',
  { pattern: '0 3 * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'scores' } },
);
await fileNuit().upsertJobScheduler(
  'peremption-horaire',
  { pattern: '7 * * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'peremption' } },
);

// Les invitations à déposer un avis partent le matin : un SMS à trois heures du matin est une
// faute de goût, et il ne sera pas lu.
await fileNuit().upsertJobScheduler(
  'invitations-avis',
  { pattern: '20 10 * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'invitations-avis' } },
);

// La question « l'intervention a-t-elle eu lieu ? » part en fin de matinée, à distance de
// l'invitation à l'avis : deux messages dans la même heure seraient mal reçus.
await fileNuit().upsertJobScheduler(
  'confirmations-intervention',
  { pattern: '40 11 * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'confirmations-intervention' } },
);

// La relance des propositions de rendez-vous : trois fois par jour, aux heures où un SMS se
// lit. Elle ne part qu'une fois par proposition — c'est la règle qui le garantit, pas le
// rythme du planificateur.
await fileNuit().upsertJobScheduler(
  'relances-rendez-vous',
  { pattern: '15 9,13,18 * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'relances-rendez-vous' } },
);

// Les rappels, eux, tournent **toutes les heures** : la fenêtre de deux heures avant le
// rendez-vous ne se rattrape pas d'une nuit sur l'autre. Le travail ne regarde que les
// trente heures à venir, il ne coûte donc presque rien.
await fileNuit().upsertJobScheduler(
  'rappels-rendez-vous',
  { pattern: '5 * * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'rappels-rendez-vous' } },
);

// L'expédition des messages tourne **toutes les minutes**. C'est le seul travail dont le
// rythme se mesure en minutes, et pour cause : une demande distribuée à 9 h 02 qui prévient
// les professionnels la nuit suivante n'a prévenu personne. La minute est le plus long délai
// qu'un client accepte entre « j'ai envoyé » et « j'ai reçu la confirmation ».
await fileNuit().upsertJobScheduler(
  'expedition',
  { pattern: '* * * * *', tz: 'Europe/Paris' },
  { name: 'nuit', data: { travail: 'expedition' } },
);

console.warn('[worker] Le Renom · cascade, échéances et travaux de nuit en écoute.');

async function arrete(signal: string): Promise<void> {
  console.warn(`[worker] ${signal} reçu, arrêt propre.`);
  await Promise.all([workerCascade.close(), workerEcheances.close(), workerNuit.close()]);
  await prisma.$disconnect();
  await fermeFiles();
  process.exit(0);
}

process.on('SIGTERM', () => void arrete('SIGTERM'));
process.on('SIGINT', () => void arrete('SIGINT'));
