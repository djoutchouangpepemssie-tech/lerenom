import { prisma } from '@lerenom/db';
import { PARAMETRES_PAR_DEFAUT } from '@lerenom/core';
import { telephoneLisible } from '@/lib/affichage';

/**
 * Les agences d'un professionnel.
 *
 * Une agence est un point sur la carte et un rayon autour : c'est elle qui décide si une
 * demande est à portée. L'inscription en crée une, posée sur la commune du siège avec le
 * rayon par défaut. Sans cet écran, une entreprise à deux adresses ne pouvait en déclarer
 * qu'une, et personne ne pouvait corriger un rayon.
 *
 * **Ce que cet écran ne fait pas, et qu'il dit** : il ne géocode pas, et c'est plus grave
 * qu'il n'y paraît. Aucune commune du jeu de données n'a de coordonnées — les colonnes
 * existent, le géocodage n'a jamais tourné. Le rayon n'a donc **aucun effet aujourd'hui** :
 * l'éligibilité se décide sur la liste des villes du périmètre, pas sur une distance.
 *
 * Le rayon est tout de même saisissable, et l'écran dit pourquoi : il s'appliquera au
 * raccordement sans que le professionnel ait à y revenir. Laisser croire qu'il agit
 * maintenant serait pire — quelqu'un réglerait son périmètre sur une règle inerte. Le détail
 * du manque est consigné en Q26.
 */

/** Le rayon le plus large qu'on accepte de déclarer. */
export const RAYON_MAXIMUM_KM = 100;
/** En deçà, une agence ne couvre plus rien d'utile. */
export const RAYON_MINIMUM_KM = 1;

export interface AgenceDuPro {
  readonly id: string;
  readonly nom: string;
  readonly adresse: string;
  readonly codePostal: string;
  readonly communeId: string;
  readonly communeNom: string;
  readonly rayonKm: number;
  readonly contactNom: string;
  readonly contactTelephone: string;
  readonly contactEmail: string;
  readonly notifierParSms: boolean;
  readonly notifierParEmail: boolean;
  readonly principale: boolean;
  /** Vrai quand l'agence a des coordonnées : sans elles, seule la commune compte. */
  readonly positionnee: boolean;
}

export interface AgencesDuPro {
  readonly agences: readonly AgenceDuPro[];
  /** Les communes où le professionnel intervient : une agence s'y pose, pas ailleurs. */
  readonly communes: readonly { readonly code: string; readonly nom: string }[];
  readonly rayonParDefautKm: number;
}

export async function agencesDuPro(entrepriseId: string): Promise<AgencesDuPro | null> {
  const entreprise = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: {
      agences: {
        orderBy: [{ principale: 'desc' }, { creeLe: 'asc' }],
        include: { commune: { select: { nom: true } } },
      },
      zones: { include: { commune: { select: { code: true, nom: true } } } },
    },
  });
  if (entreprise === null) return null;

  return {
    agences: entreprise.agences.map((agence) => ({
      id: agence.id,
      nom: agence.nom ?? '',
      adresse: agence.adresse,
      codePostal: agence.codePostal,
      communeId: agence.communeId,
      communeNom: agence.commune.nom,
      rayonKm: agence.rayonKm,
      contactNom: agence.contactNom ?? '',
      // Par paires de chiffres, comme partout ailleurs : un « +33199000010 » brut dans un
      // champ qu'on vient modifier est une donnée de base montrée telle quelle.
      contactTelephone: telephoneLisible(agence.contactTelephone ?? ''),
      contactEmail: agence.contactEmail ?? '',
      notifierParSms: agence.notifierParSms,
      notifierParEmail: agence.notifierParEmail,
      principale: agence.principale,
      positionnee: agence.latitude !== null && agence.longitude !== null,
    })),
    communes: entreprise.zones
      .map((zone) => ({ code: zone.commune.code, nom: zone.commune.nom }))
      .toSorted((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    rayonParDefautKm: PARAMETRES_PAR_DEFAUT.rayonAgenceParDefautKm,
  };
}

export interface SaisieAgence {
  /** Absent pour une agence nouvelle. */
  readonly id?: string | undefined;
  readonly nom: string;
  readonly adresse: string;
  readonly codePostal: string;
  readonly communeId: string;
  readonly rayonKm: number;
  readonly contactNom: string;
  readonly contactTelephone: string;
  readonly contactEmail: string;
  readonly notifierParSms: boolean;
  readonly notifierParEmail: boolean;
  readonly principale: boolean;
}

export type ResultatAgences =
  { readonly ok: true; readonly nombre: number } | { readonly ok: false; readonly message: string };

/**
 * Enregistre la liste complète des agences.
 *
 * Liste complète et non modification unitaire : les agences forment un ensemble dont une
 * seule est principale, et traiter cette contrainte agence par agence laisserait forcément
 * passer un état où il y en a zéro ou deux.
 */
export async function enregistreAgences(
  entrepriseId: string,
  saisies: readonly SaisieAgence[],
): Promise<ResultatAgences> {
  if (saisies.length === 0) {
    return {
      ok: false,
      message:
        'Gardez au moins une agence : c’est elle qui décide quelles demandes sont à votre portée.',
    };
  }

  const principales = saisies.filter((agence) => agence.principale);
  if (principales.length !== 1) {
    return {
      ok: false,
      message:
        'Désignez exactement une agence principale : c’est son adresse qui figure sur votre fiche.',
    };
  }

  for (const agence of saisies) {
    if (agence.rayonKm < RAYON_MINIMUM_KM || agence.rayonKm > RAYON_MAXIMUM_KM) {
      return {
        ok: false,
        message: `Un rayon se situe entre ${String(RAYON_MINIMUM_KM)} et ${String(RAYON_MAXIMUM_KM)} km.`,
      };
    }
    if (agence.adresse.trim() === '') {
      return { ok: false, message: 'Chaque agence a besoin d’une adresse.' };
    }
  }

  // Une agence se pose dans une commune où l'entreprise intervient : ailleurs, elle recevrait
  // des demandes qu'elle a elle-même exclues de son périmètre.
  const zones = await prisma.zonePro.findMany({
    where: { entrepriseId },
    select: { communeId: true },
  });
  const couvertes = new Set(zones.map((zone) => zone.communeId));
  const horsZone = saisies.filter((agence) => !couvertes.has(agence.communeId));
  if (horsZone.length > 0) {
    return {
      ok: false,
      message:
        'Une agence est posée dans une ville absente de votre périmètre. Ajoutez d’abord cette ville, ou déplacez l’agence.',
    };
  }

  const existantes = await prisma.agence.findMany({
    where: { entrepriseId },
    select: { id: true },
  });
  const connues = new Set(existantes.map((agence) => agence.id));
  const gardees = new Set(saisies.map((agence) => agence.id).filter((id) => id !== undefined));

  const inconnues = [...gardees].filter((id) => !connues.has(id));
  if (inconnues.length > 0) {
    return { ok: false, message: 'Une agence modifiée n’existe plus.' };
  }

  // Les coordonnées viennent de la commune : aucun géocodage n'est raccordé, et une agence
  // sans position n'est éligible à rien.
  const communes = await prisma.commune.findMany({
    where: { code: { in: saisies.map((agence) => agence.communeId) } },
    select: { code: true, latitude: true, longitude: true },
  });
  const positions = new Map(communes.map((commune) => [commune.code, commune]));

  await prisma.$transaction(async (tx) => {
    const aSupprimer = [...connues].filter((id) => !gardees.has(id));
    if (aSupprimer.length > 0) {
      await tx.agence.deleteMany({ where: { id: { in: aSupprimer }, entrepriseId } });
    }

    for (const saisie of saisies) {
      const commune = positions.get(saisie.communeId);
      const champs = {
        nom: saisie.nom.trim() === '' ? null : saisie.nom.trim(),
        adresse: saisie.adresse.trim(),
        codePostal: saisie.codePostal.trim(),
        communeId: saisie.communeId,
        rayonKm: saisie.rayonKm,
        contactNom: saisie.contactNom.trim() === '' ? null : saisie.contactNom.trim(),
        contactTelephone:
          saisie.contactTelephone.trim() === '' ? null : saisie.contactTelephone.trim(),
        contactEmail: saisie.contactEmail.trim() === '' ? null : saisie.contactEmail.trim(),
        notifierParSms: saisie.notifierParSms,
        notifierParEmail: saisie.notifierParEmail,
        principale: saisie.principale,
        latitude: commune?.latitude ?? null,
        longitude: commune?.longitude ?? null,
      };

      if (saisie.id === undefined) {
        await tx.agence.create({ data: { entrepriseId, ...champs } });
      } else {
        await tx.agence.update({ where: { id: saisie.id }, data: champs });
      }
    }
  });

  return { ok: true, nombre: saisies.length };
}
