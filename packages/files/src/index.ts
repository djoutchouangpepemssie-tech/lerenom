/**
 * Les files de tâches.
 *
 * Chaque étape de la cascade est une tâche : l'envoi, le minuteur de 30 minutes ou de 2 heures,
 * le passage au suivant, la péremption à 72 heures. Une tâche échouée est réessayée avec un
 * recul croissant ; une tâche réussie est conservée un temps, pour que le centre de
 * distribution puisse montrer ce qui s'est passé.
 *
 * Tout est construit à la demande, jamais à l'import. Deux raisons :
 *   * le build de l'application charge les modules des routes sans que Redis tourne — une
 *     connexion ouverte à l'import ferait échouer un `next build` sur une machine nue ;
 *   * les tests qui ne touchent pas aux files n'ont pas à ouvrir de connexion.
 */

import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

export interface TacheCascade {
  readonly demandeId: string;
}

export interface TacheEcheance {
  readonly distributionId: string;
}

export interface TacheNuit {
  readonly travail: string;
}

let connexionPartagee: IORedis | null = null;

/** La connexion Redis partagée, ouverte au premier usage réel. */
export function connexion(): IORedis {
  connexionPartagee ??= new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379', {
    // BullMQ exige que les commandes bloquantes ne soient jamais abandonnées.
    maxRetriesPerRequest: null,
  });
  return connexionPartagee;
}

function options(): QueueOptions {
  return {
    connection: connexion(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 5_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  };
}

const construites = new Map<string, Queue>();

function file<T>(nom: string): Queue<T> {
  let existante = construites.get(nom);
  if (existante === undefined) {
    existante = new Queue(nom, options());
    construites.set(nom, existante);
  }
  return existante as Queue<T>;
}

/** Avancer la cascade d'une demande : premier envoi, puis chaque passage au suivant. */
export function fileCascade(): Queue<TacheCascade> {
  return file<TacheCascade>('cascade');
}

/** L'échéance d'une proposition : 30 minutes pour l'Exclusif, 2 heures pour les autres. */
export function fileEcheances(): Queue<TacheEcheance> {
  return file<TacheEcheance>('echeances');
}

/** Les travaux de nuit : recalcul des scores, péremption des demandes, rapports. */
export function fileNuit(): Queue<TacheNuit> {
  return file<TacheNuit>('nuit');
}

/** Programme le contrôle d'échéance d'une proposition, à la seconde près. */
export async function programmeEcheance(distributionId: string, echeance: Date): Promise<void> {
  const delai = Math.max(0, echeance.getTime() - Date.now());
  await fileEcheances().add(
    'echeance',
    { distributionId },
    // L'identifiant fixe rend la programmation idempotente : relancer la cascade ne crée pas
    // deux minuteurs sur la même proposition.
    { jobId: `echeance-${distributionId}`, delay: delai },
  );
}

/** Demande au worker d'avancer la cascade, tout de suite ou après un délai. */
export async function programmeCascade(demandeId: string, delaiMs = 0): Promise<void> {
  await fileCascade().add('cascade', { demandeId }, { delay: delaiMs });
}

/** Ferme ce qui a été ouvert, et rien d'autre. */
export async function fermeFiles(): Promise<void> {
  await Promise.all([...construites.values()].map((queue) => queue.close()));
  construites.clear();
  if (connexionPartagee !== null) {
    await connexionPartagee.quit();
    connexionPartagee = null;
  }
}
