/**
 * L'expédition des messages : ce qui part, ce qui attend, ce qui ne partira plus.
 *
 * Le produit entier repose sur des messages. Une demande distribuée prévient trois
 * professionnels ; un devis s'ouvre par un lien reçu ; un rendez-vous se propose, se rappelle,
 * s'annule par SMS. Rien de cela n'a de valeur tant que les messages restent en base.
 *
 * Ce fichier ne les envoie pas — il décide. Trois règles, et chacune évite un dégât précis.
 *
 * **Un message périmé ne part pas.** C'est la plus importante, et elle n'existe que parce que
 * la file s'est remplie avant d'avoir un fournisseur. Le jour où l'on en raccorde un, deux
 * cent quatre-vingt-six messages attendent : des rappels pour des rendez-vous passés, des
 * propositions expirées, des devis caducs. Les envoyer d'un coup serait pire que ne jamais
 * les avoir envoyés — le client reçoit dix SMS qui parlent de la semaine dernière, et il
 * bloque l'expéditeur. Au-delà de son délai, un message est **abandonné et dit pourquoi** ;
 * il reste en base, consultable, et personne ne l'a reçu par surprise.
 *
 * **Un message ne part jamais deux fois.** Un envoi en double sur un canal payant coûte de
 * l'argent et de la confiance. L'état est la seule autorité : seul `en_attente` part.
 *
 * **Un échec se réessaie, mais pas indéfiniment.** Un fournisseur qui répond mal se rétablit
 * souvent en quelques minutes ; un numéro invalide ne se rétablira jamais. On distingue donc
 * l'échec passager de l'échec définitif, et on espace les tentatives.
 */

export type CanalMessage = 'sms' | 'email' | 'push';
export type StatutMessage = 'en_attente' | 'envoye' | 'livre' | 'echec';

/**
 * Le délai au-delà duquel un message n'a plus lieu d'être envoyé.
 *
 * Vingt-quatre heures, et c'est un **défaut prudent, pas une règle du métier** : voir
 * `QUESTIONS.md` §Q36. Le raisonnement : presque tous nos messages parlent d'un événement
 * daté — une demande à saisir vite, un rendez-vous demain, un créneau qui expire. Passé un
 * jour, ils informent moins qu'ils ne déroutent. Un devis reçu avec deux jours de retard
 * serait, lui, encore utile ; c'est le cas que cette durée unique traite mal, et c'est ce
 * qu'il faut trancher.
 */
export const PEREMPTION_MESSAGE_HEURES = 24;

/** Nombre de tentatives au-delà duquel on cesse d'insister. */
export const TENTATIVES_MAXIMALES = 5;

/**
 * L'attente avant la nième tentative, en minutes.
 *
 * Doublement à chaque fois : une minute, deux, quatre, huit, seize. Un fournisseur en panne
 * n'est pas aidé par un client qui le martèle, et une file qui réessaie toutes les secondes
 * dépense son quota sur le premier message bloqué.
 */
export function attenteAvantTentative(tentatives: number): number {
  if (tentatives <= 0) return 0;
  return 2 ** Math.min(tentatives - 1, 6);
}

export interface MessageAExpedier {
  readonly canal: CanalMessage;
  readonly statut: StatutMessage;
  readonly destinataire: string;
  readonly creeLe: Date;
  readonly tentatives: number;
  /** Date de la dernière tentative, pour savoir si l'attente est écoulée. */
  readonly derniereTentativeLe: Date | null;
}

/**
 * Ce qu'il faut faire d'un message.
 *
 * `attendre` n'est pas un refus : c'est un « pas maintenant », et le message sera repris.
 * `abandonner` est définitif, et porte toujours sa raison — un message abandonné en silence
 * est un message dont personne ne saura jamais qu'il n'est pas parti.
 */
export type DecisionExpedition =
  | { readonly action: 'expedier' }
  | { readonly action: 'attendre'; readonly raison: string }
  | { readonly action: 'abandonner'; readonly raison: string };

function heuresEntre(debut: Date, fin: Date): number {
  return (fin.getTime() - debut.getTime()) / 3_600_000;
}

/** Un destinataire vide n'est pas une adresse : on n'essaie pas, et on le dit. */
function destinataireUtilisable(message: MessageAExpedier): boolean {
  return message.destinataire.trim() !== '';
}

export function decideExpedition(
  message: MessageAExpedier,
  maintenant: Date = new Date(),
  peremptionHeures: number = PEREMPTION_MESSAGE_HEURES,
): DecisionExpedition {
  // L'état d'abord : un message déjà parti ne repart pas, quel que soit le reste. C'est la
  // garantie la moins chère et la plus importante de ce fichier.
  if (message.statut !== 'en_attente') {
    return { action: 'attendre', raison: `déjà ${message.statut}` };
  }

  if (!destinataireUtilisable(message)) {
    return { action: 'abandonner', raison: 'destinataire vide' };
  }

  // La péremption passe avant les tentatives : inutile de réessayer ce qui n'a plus d'objet.
  const age = heuresEntre(message.creeLe, maintenant);
  if (age >= peremptionHeures) {
    return {
      action: 'abandonner',
      raison: `périmé : créé il y a ${Math.floor(age)} h, au-delà des ${String(peremptionHeures)} h admises`,
    };
  }

  if (message.tentatives >= TENTATIVES_MAXIMALES) {
    return {
      action: 'abandonner',
      raison: `${String(message.tentatives)} tentatives sans succès`,
    };
  }

  if (message.derniereTentativeLe !== null) {
    const attendues = attenteAvantTentative(message.tentatives);
    const ecoulees = (maintenant.getTime() - message.derniereTentativeLe.getTime()) / 60_000;
    if (ecoulees < attendues) {
      return {
        action: 'attendre',
        raison: `nouvelle tentative dans ${String(Math.ceil(attendues - ecoulees))} min`,
      };
    }
  }

  return { action: 'expedier' };
}

/** Le résultat rendu par un fournisseur. */
export type ResultatEnvoi =
  | { readonly ok: true; readonly fournisseurId: string | null }
  | { readonly ok: false; readonly erreur: string; readonly definitif: boolean };

/**
 * L'état dans lequel laisser un message après une tentative.
 *
 * Un échec **définitif** — numéro inexistant, adresse refusée — ne se réessaie pas : insister
 * ne changera rien et consomme le quota. Un échec passager laisse le message en attente, et
 * c'est `decideExpedition` qui décidera quand le reprendre.
 */
export function apresEnvoi(resultat: ResultatEnvoi): {
  readonly statut: StatutMessage;
  readonly erreur: string | null;
} {
  if (resultat.ok) return { statut: 'envoye', erreur: null };
  if (resultat.definitif) return { statut: 'echec', erreur: resultat.erreur };
  return { statut: 'en_attente', erreur: resultat.erreur };
}
