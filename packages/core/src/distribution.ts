/**
 * La cascade de distribution d'une demande : le cœur de la plateforme.
 *
 * L'ordre n'est jamais une question de goût, c'est la règle vendue aux professionnels :
 *   1. l'Exclusif de la zone reçoit la demande **seul pendant 30 minutes** ;
 *   2. puis 1 ou 2 **Premium**, en servant d'abord celui qui a reçu le moins de demandes ce
 *      mois-ci par rapport à son forfait — l'équité avant la proximité ;
 *   3. puis les **autres pros**, classés à 60 % sur la qualité et à 40 % sur la proximité,
 *      jusqu'à 3 professionnels au total, jamais plus.
 *
 * Une demande n'est jamais proposée à plus de 3 pros, ni après 72 heures. Un refus et une
 * expiration ne coûtent rien et ne décomptent rien. Une acceptation est définitive.
 */

import { couvre, distanceKm, scoreProximite } from './geo';
import type { Point } from './geo';
import type { Parametres } from './parametres';
import type { Formule } from './regles-validees';
import type { TypeDemande } from './quotas';

export type MotifRefus = 'indisponible' | 'trop-loin' | 'pas-mon-metier' | 'budget-trop-bas';

export const MOTIFS_REFUS: Readonly<Record<MotifRefus, string>> = Object.freeze({
  indisponible: 'Je ne suis pas disponible',
  'trop-loin': 'C’est trop loin de mon agence',
  'pas-mon-metier': 'Ce n’est pas mon métier',
  'budget-trop-bas': 'Le budget annoncé est trop bas',
});

/** Pourquoi un pro occupe ce rang dans la cascade. Affiché tel quel dans le back-office. */
export type RaisonRangCascade =
  | 'exclusif-de-la-zone'
  | 'premium-le-moins-servi'
  | 'score-et-proximite'
  | 'choix-du-client'
  | 'envoi-manuel'
  | 're-proposition';

export interface AgencePro {
  readonly agenceId: string;
  /** Position de l'agence. Absente tant que le géocodage n'a pas tourné. */
  readonly position?: Point | undefined;
  readonly rayonKm: number;
  /**
   * Communes couvertes par cette agence, par code INSEE.
   *
   * Le cahier des charges autorise deux façons de déclarer une zone : une adresse et un rayon,
   * **ou une liste de communes**. La seconde ne dépend d'aucune coordonnée : elle reste donc
   * juste même quand le géocodage n'a pas encore tourné, et c'est elle qui fait foi lorsque
   * l'agence ou l'adresse n'ont pas de position.
   */
  readonly communesCouvertes?: readonly string[] | undefined;
}

/** Où se passent les travaux : une commune toujours, une position quand on l'a. */
export interface AdresseDemande {
  readonly communeCode: string;
  readonly position?: Point | undefined;
}

export interface ProCandidat {
  readonly entrepriseId: string;
  readonly formule: Formule;
  /** Score de qualité, entre 0 et 1. */
  readonly score: number;
  readonly note: number | null;
  /** L'entreprise détient-elle l'exclusivité du métier demandé sur cette zone ? */
  readonly titulaireExclusivite?: boolean;
  /** Le métier de la demande fait-il partie des métiers déclarés ? */
  readonly metierCorrespond: boolean;
  /** Le pro s'est-il déclaré disponible ? */
  readonly disponible: boolean;
  /** Abonnement à jour, compte non suspendu. */
  readonly compteAJour: boolean;
  readonly agences: readonly AgencePro[];
  /** Demandes partagées acceptées ce mois-ci. */
  readonly demandesAccepteesCeMois: number;
}

export type RaisonExclusion =
  | 'metier-different'
  | 'hors-zone'
  | 'indisponible'
  | 'note-insuffisante'
  | 'compte-non-a-jour'
  | 'forfait-epuise-sans-recharge';

export interface ProEcarte {
  readonly entrepriseId: string;
  readonly raison: RaisonExclusion;
  /** Phrase affichée dans le back-office, par exemple « Hors zone : 6,7 km pour un rayon de 4 km ». */
  readonly explication: string;
}

export interface ProRetenu {
  readonly entrepriseId: string;
  readonly formule: Formule;
  readonly score: number;
  /** L'agence la plus proche qui couvre l'adresse : c'est elle qui reçoit la demande. */
  readonly agenceId: string;
  /** `null` quand la couverture a été établie par liste de communes, sans coordonnées. */
  readonly distanceKm: number | null;
  readonly titulaireExclusivite: boolean;
  readonly demandesAccepteesCeMois: number;
}

export interface Rapprochement {
  readonly retenus: readonly ProRetenu[];
  readonly ecartes: readonly ProEcarte[];
}

function formateKm(km: number): string {
  return km.toFixed(1).replace('.', ',');
}

/**
 * Rattache chaque pro à son agence la plus proche couvrant l'adresse, et écarte les autres en
 * disant pourquoi. La raison est affichée à Arcel : c'est elle qui lui permet de comprendre une
 * demande sans preneur sans ouvrir la base.
 */
export function rapproche(
  candidats: readonly ProCandidat[],
  adresse: AdresseDemande,
  parametres: Parametres,
): Rapprochement {
  const retenus: ProRetenu[] = [];
  const ecartes: ProEcarte[] = [];

  for (const pro of candidats) {
    if (!pro.metierCorrespond) {
      ecartes.push({
        entrepriseId: pro.entrepriseId,
        raison: 'metier-different',
        explication: 'Le métier demandé ne fait pas partie de ses métiers déclarés.',
      });
      continue;
    }

    if (!pro.compteAJour) {
      ecartes.push({
        entrepriseId: pro.entrepriseId,
        raison: 'compte-non-a-jour',
        explication: 'Compte suspendu ou abonnement impayé.',
      });
      continue;
    }

    if (pro.note !== null && pro.note < parametres.noteMinimale) {
      ecartes.push({
        entrepriseId: pro.entrepriseId,
        raison: 'note-insuffisante',
        explication: `Note de ${pro.note.toFixed(1).replace('.', ',')} sur 5, en dessous du minimum de ${parametres.noteMinimale.toFixed(1).replace('.', ',')}.`,
      });
      continue;
    }

    // L'agence la plus proche parmi celles qui couvrent réellement l'adresse.
    let meilleure: { agenceId: string; distanceKm: number | null } | null = null;
    let plusProcheHorsZone: { distanceKm: number; rayonKm: number } | null = null;

    for (const agence of pro.agences) {
      const couvreParCommune = agence.communesCouvertes?.includes(adresse.communeCode) === true;

      // Sans position de part et d'autre, seule la liste de communes peut trancher.
      if (agence.position === undefined || adresse.position === undefined) {
        if (couvreParCommune && meilleure === null) {
          meilleure = { agenceId: agence.agenceId, distanceKm: null };
        }
        continue;
      }

      const d = distanceKm(agence.position, adresse.position);
      if (couvreParCommune || couvre(agence.position, agence.rayonKm, adresse.position)) {
        if (meilleure === null || meilleure.distanceKm === null || d < meilleure.distanceKm) {
          meilleure = { agenceId: agence.agenceId, distanceKm: d };
        }
      } else if (plusProcheHorsZone === null || d < plusProcheHorsZone.distanceKm) {
        plusProcheHorsZone = { distanceKm: d, rayonKm: agence.rayonKm };
      }
    }

    if (meilleure === null) {
      const explication =
        pro.agences.length === 0
          ? 'Aucune agence enregistrée.'
          : plusProcheHorsZone === null
            ? 'Aucune agence ne couvre cette commune.'
            : `Hors zone : ${formateKm(plusProcheHorsZone.distanceKm)} km pour un rayon de ${formateKm(plusProcheHorsZone.rayonKm)} km.`;
      ecartes.push({ entrepriseId: pro.entrepriseId, raison: 'hors-zone', explication });
      continue;
    }

    // La disponibilité se vérifie en dernier : un pro indisponible mais dans la zone reste
    // visible dans le back-office comme « indisponible », et non comme « hors zone ».
    if (!pro.disponible) {
      ecartes.push({
        entrepriseId: pro.entrepriseId,
        raison: 'indisponible',
        explication: 'S’est déclaré indisponible sur cette période.',
      });
      continue;
    }

    retenus.push({
      entrepriseId: pro.entrepriseId,
      formule: pro.formule,
      score: pro.score,
      agenceId: meilleure.agenceId,
      distanceKm: meilleure.distanceKm,
      titulaireExclusivite: pro.titulaireExclusivite === true,
      demandesAccepteesCeMois: pro.demandesAccepteesCeMois,
    });
  }

  return { retenus, ecartes };
}

export interface EtapeCascade {
  readonly entrepriseId: string;
  readonly agenceId: string;
  /** Rang dans la cascade, à partir de 1. */
  readonly rang: number;
  /** Tour d'envoi : 1 l'Exclusif, 2 les Premium, 3 les autres. */
  readonly tour: 1 | 2 | 3;
  readonly raisonRang: RaisonRangCascade;
  /** Minutes après le dépôt de la demande avant l'envoi à ce pro. */
  readonly minutesApresDepot: number;
  /** Minutes dont ce pro dispose pour répondre avant passage au suivant. */
  readonly minutesPourRepondre: number;
}

/** Équité Premium : la part de forfait déjà consommée. Le moins servi passe devant. */
function partConsommee(pro: ProRetenu, parametres: Parametres): number {
  const incluses = parametres.demandesIncluses[pro.formule];
  if (incluses <= 0) return 1;
  return Math.min(1, pro.demandesAccepteesCeMois / incluses);
}

/**
 * Classe les pros non abonnés : 60 % sur la qualité, 40 % sur la proximité.
 * Le rayon de référence de la proximité est le rayon par défaut d'une agence.
 */
export function noteMixte(pro: ProRetenu, parametres: Parametres): number {
  // Sans distance connue, la proximité est neutre : on ne récompense ni ne pénalise un pro
  // parce que son agence n'a pas encore été géocodée.
  const proximite =
    pro.distanceKm === null
      ? 0.5
      : scoreProximite(pro.distanceKm, parametres.rayonAgenceParDefautKm);
  const partQualite = parametres.partQualiteHorsAbonnes;
  return partQualite * pro.score + (1 - partQualite) * proximite;
}

/**
 * Construit la cascade d'une demande partagée : qui reçoit quoi, dans quel ordre et à quel
 * moment. Le worker transforme chaque étape en tâche BullMQ ; le back-office l'affiche telle
 * quelle, avec la raison du rang et le temps restant.
 */
export function planifieCascadePartagee(
  retenus: readonly ProRetenu[],
  parametres: Parametres,
): readonly EtapeCascade[] {
  const etapes: EtapeCascade[] = [];
  const objectif = parametres.prosMaxParDemande;
  let rang = 0;

  const exclusif = retenus.find((p) => p.formule === 'exclusif' && p.titulaireExclusivite);

  if (exclusif !== undefined) {
    rang += 1;
    etapes.push({
      entrepriseId: exclusif.entrepriseId,
      agenceId: exclusif.agenceId,
      rang,
      tour: 1,
      raisonRang: 'exclusif-de-la-zone',
      minutesApresDepot: 0,
      minutesPourRepondre: parametres.minutesExclusiviteExclusif,
    });
  }

  // Les Premium entrent après la fenêtre d'exclusivité — ou tout de suite s'il n'y a pas
  // d'Exclusif sur la zone.
  const departPremium = exclusif === undefined ? 0 : parametres.minutesExclusiviteExclusif;
  const premium = retenus
    .filter((p) => p.formule === 'premium')
    .sort((a, b) => {
      const pa = partConsommee(a, parametres);
      const pb = partConsommee(b, parametres);
      if (pa !== pb) return pa - pb; // le moins servi ce mois-ci d'abord
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      if (b.score !== a.score) return b.score - a.score;
      return a.entrepriseId.localeCompare(b.entrepriseId);
    })
    .slice(0, Math.max(0, objectif - etapes.length));

  for (const p of premium) {
    rang += 1;
    etapes.push({
      entrepriseId: p.entrepriseId,
      agenceId: p.agenceId,
      rang,
      tour: 2,
      raisonRang: 'premium-le-moins-servi',
      minutesApresDepot: departPremium,
      minutesPourRepondre: parametres.minutesReponseAutresPros,
    });
  }

  // Les places restantes vont aux Essentiel et Gratuit, et aux Exclusif hors de leur zone
  // d'exclusivité — qui y sont traités comme des Premium déjà servis.
  const dejaPlaces = new Set(etapes.map((e) => e.entrepriseId));
  const autres = retenus
    .filter((p) => !dejaPlaces.has(p.entrepriseId))
    .sort((a, b) => {
      const na = noteMixte(a, parametres);
      const nb = noteMixte(b, parametres);
      if (nb !== na) return nb - na;
      return a.entrepriseId.localeCompare(b.entrepriseId);
    })
    .slice(0, Math.max(0, objectif - etapes.length));

  const departAutres =
    departPremium + (premium.length > 0 ? parametres.minutesReponseAutresPros : 0);

  for (const p of autres) {
    rang += 1;
    etapes.push({
      entrepriseId: p.entrepriseId,
      agenceId: p.agenceId,
      rang,
      tour: 3,
      raisonRang: 'score-et-proximite',
      minutesApresDepot: departAutres,
      minutesPourRepondre: parametres.minutesReponseAutresPros,
    });
  }

  return etapes;
}

/**
 * Demande urgente : l'Exclusif et les Premium de la zone sont alertés en même temps, avec
 * 5 minutes d'avance ; passé ce délai, tous les pros disponibles reçoivent l'alerte. Le premier
 * qui accepte la prend — le verrou qui le garantit est posé en base, pas ici.
 */
export function planifieCascadeUrgente(
  retenus: readonly ProRetenu[],
  parametres: Parametres,
): readonly EtapeCascade[] {
  const abonnes = retenus.filter((p) => p.formule === 'premium' || p.formule === 'exclusif');
  const abonnesIds = new Set(abonnes.map((p) => p.entrepriseId));
  const autres = retenus.filter(
    (p) => !abonnesIds.has(p.entrepriseId) && parametres.prixDemandeUrgente[p.formule] !== null,
  );

  const etape = (p: ProRetenu, rang: number, minutes: number): EtapeCascade => ({
    entrepriseId: p.entrepriseId,
    agenceId: p.agenceId,
    rang,
    tour: minutes === 0 ? 1 : 2,
    raisonRang: p.titulaireExclusivite ? 'exclusif-de-la-zone' : 'score-et-proximite',
    minutesApresDepot: minutes,
    minutesPourRepondre: parametres.minutesAlerteUrgenceSansPreneur,
  });

  const tries = (liste: readonly ProRetenu[]): readonly ProRetenu[] =>
    [...liste].sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.entrepriseId.localeCompare(b.entrepriseId);
    });

  let rang = 0;
  const etapes: EtapeCascade[] = [];
  for (const p of tries(abonnes)) etapes.push(etape(p, (rang += 1), 0));
  for (const p of tries(autres))
    etapes.push(etape(p, (rang += 1), parametres.minutesAvanceUrgence));
  return etapes;
}

export type StatutDemande =
  | 'en-distribution'
  | 'en-attente-de-relance'
  | 'complete'
  | 'sans-preneur'
  | 'en-pause'
  | 'suspecte'
  | 'directe-quota-atteint';

export interface EtatDistribution {
  /** Nombre de pros visé : 3 pour une partagée, 1 pour une urgente ou une directe. */
  readonly objectif: number;
  readonly acceptes: readonly string[];
  readonly refus: readonly { readonly entrepriseId: string; readonly motif: MotifRefus }[];
  readonly expires: readonly string[];
  readonly enCours: readonly string[];
  /** Heures écoulées depuis le dépôt de la demande. */
  readonly heuresDepuisDepot: number;
  readonly enPause?: boolean;
  readonly suspecte?: boolean;
}

/** L'objectif d'une demande selon son type : 3 pros pour une partagée, 1 sinon. */
export function objectifPros(type: TypeDemande, parametres: Parametres): number {
  return type === 'partagee' ? parametres.prosMaxParDemande : 1;
}

export function demandeComplete(etat: EtatDistribution): boolean {
  return etat.acceptes.length >= etat.objectif;
}

/** Au-delà de 72 heures, une demande n'est plus jamais proposée : elle n'a plus de valeur. */
export function demandePerimee(etat: EtatDistribution, parametres: Parametres): boolean {
  return etat.heuresDepuisDepot >= parametres.heuresFraicheurDemande;
}

/**
 * Peut-on encore envoyer la demande à quelqu'un ?
 *
 * Le plafond de 3 porte sur les professionnels qui **obtiennent** la demande, pas sur ceux à qui
 * elle a été proposée : un pro qui refuse ou laisse expirer n'a jamais vu les coordonnées du
 * client et ne le contactera pas. C'est bien ce que dit la règle — « jamais revendue à plus de
 * 3 pros » — et c'est ce qui permet à la cascade de continuer après un refus, comme elle le
 * doit. Sans cela, trois refus condamneraient une demande parfaitement valable.
 *
 * Les propositions en cours comptent avec les acceptations : chacune peut encore devenir une
 * acceptation, et quatre pros ne doivent jamais pouvoir obtenir la même demande.
 */
export function peutEncoreDistribuer(etat: EtatDistribution, parametres: Parametres): boolean {
  if (etat.enPause === true || etat.suspecte === true) return false;
  if (demandeComplete(etat)) return false;
  if (demandePerimee(etat, parametres)) return false;
  return placesRestantes(etat) > 0;
}

/**
 * Combien de professionnels peuvent encore obtenir cette demande.
 * Les acceptations sont acquises, les propositions en cours sont réservées.
 */
export function placesRestantes(etat: EtatDistribution): number {
  return Math.max(0, etat.objectif - etat.acceptes.length - etat.enCours.length);
}

/** Nombre de pros déjà sollicités : acceptations, refus, expirations et envois en cours. */
export function solliciter(etat: EtatDistribution): number {
  const ids = new Set<string>([
    ...etat.acceptes,
    ...etat.refus.map((r) => r.entrepriseId),
    ...etat.expires,
    ...etat.enCours,
  ]);
  return ids.size;
}

/**
 * Le statut à afficher dans le centre de distribution.
 *
 * « Sans preneur » n'est pas déduit ici : c'est une conclusion de la distribution, qui seule
 * sait s'il reste un professionnel éligible à solliciter. Cette fonction dit ce que l'état
 * permet de dire, et rien de plus.
 */
export function statutDemande(etat: EtatDistribution, parametres: Parametres): StatutDemande {
  if (etat.suspecte === true) return 'suspecte';
  if (etat.enPause === true) return 'en-pause';
  if (demandeComplete(etat)) return 'complete';
  if (demandePerimee(etat, parametres)) return 'sans-preneur';
  if (etat.enCours.length > 0) return 'en-distribution';
  return 'en-attente-de-relance';
}

/**
 * Un pro qui a refusé peut-il recevoir à nouveau la demande ?
 *
 * Une seule fois par demande, jamais après un « pas mon métier » — ce refus-là signale un
 * problème de classement, pas une indisponibilité. Le second tour automatique ne vaut que pour
 * « indisponible », quand plus personne d'autre n'est disponible ; l'administrateur peut forcer
 * les autres motifs en un clic.
 */
export function peutEtreRePropose(
  motif: MotifRefus,
  dejaRePropose: boolean,
  parAdministrateur: boolean,
): boolean {
  if (dejaRePropose) return false;
  if (motif === 'pas-mon-metier') return false;
  if (parAdministrateur) return true;
  return motif === 'indisponible';
}

/** Les rayons s'élargissent de 50 % quand personne n'accepte, avant d'alerter l'administrateur. */
export function rayonElargi(rayonKm: number, parametres: Parametres): number {
  return rayonKm * parametres.facteurElargissementRayon;
}
