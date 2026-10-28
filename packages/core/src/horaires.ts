/**
 * Les horaires d'ouverture d'un professionnel.
 *
 * Un annuaire qui ne dit pas si l'on peut appeler maintenant laisse son visiteur appeler dans
 * le vide. C'est la raison d'être de ce module : il ne range pas des heures, il répond à
 * « est-ce ouvert ? » et « quand est-ce que ça rouvre ? ».
 *
 * Deux partis pris.
 *
 * **Plusieurs créneaux par jour.** La pause du midi n'est pas une exception chez les artisans,
 * c'est la règle. Un modèle à une seule plage par jour obligerait à mentir — annoncer
 * 8 h – 19 h quand on ne décroche pas entre midi et deux.
 *
 * **Aucune heure n'est calculée ici à partir d'une date.** Les fonctions reçoivent le jour et
 * la minute déjà exprimés dans le fuseau du site. Mélanger les règles d'ouverture et
 * l'arithmétique des fuseaux produirait exactement le genre d'écart d'une heure qui ne se voit
 * qu'au changement d'heure, un dimanche d'octobre.
 */

/** Les jours, du lundi au dimanche. L'ordre est celui de la semaine française. */
export const JOURS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

export type Jour = (typeof JOURS)[number];

/** Le libellé affiché pour chaque jour. */
export const LIBELLE_JOUR: Readonly<Record<Jour, string>> = Object.freeze({
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
});

/** Une plage d'ouverture, en minutes depuis minuit. */
export interface Creneau {
  readonly debut: number;
  readonly fin: number;
}

/** Les horaires d'une semaine. Un jour sans créneau est fermé. */
export type Horaires = Readonly<Record<Jour, readonly Creneau[]>>;

/** Une semaine entièrement fermée : le point de départ d'une saisie. */
export function semaineFermee(): Horaires {
  return {
    lundi: [],
    mardi: [],
    mercredi: [],
    jeudi: [],
    vendredi: [],
    samedi: [],
    dimanche: [],
  };
}

const MINUTES_PAR_JOUR = 24 * 60;

/** `08:30` → 510. Rend `null` si le texte n'est pas une heure. */
export function minutesDepuisTexte(texte: string): number | null {
  const trouve = /^(\d{1,2}):(\d{2})$/.exec(texte.trim());
  if (trouve === null) return null;
  const heures = Number(trouve[1]);
  const minutes = Number(trouve[2]);
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
}

/** 510 → `08:30`. */
export function texteDepuisMinutes(minutes: number): string {
  const borne = Math.max(0, Math.min(MINUTES_PAR_JOUR, Math.round(minutes)));
  const heures = Math.floor(borne / 60);
  const reste = borne % 60;
  return `${String(heures).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}

/** `08:30` → `8 h 30`, et `14:00` → `14 h`. La typographie française écrit l'heure ainsi. */
export function heureLisible(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0
    ? `${String(heures)} h`
    : `${String(heures)} h ${String(reste).padStart(2, '0')}`;
}

/** Un créneau, écrit pour être lu : « 8 h – 12 h 30 ». */
export function creneauLisible(creneau: Creneau): string {
  return `${heureLisible(creneau.debut)} – ${heureLisible(creneau.fin)}`;
}

/**
 * Le pas de saisie des horaires, en minutes.
 *
 * Un quart d'heure : c'est la granularité des horaires d'ouverture partout, et elle tient en
 * une liste qu'on parcourt. Au pas de cinq minutes, la liste compterait près de trois cents
 * entrées pour un gain que personne ne demande.
 */
export const PAS_HORAIRE = 15;

/**
 * Les heures proposées à la saisie, du début de journée à minuit.
 *
 * `valeurActuelle` est ajoutée si elle ne tombe pas sur le pas : une fiche enregistrée
 * autrefois à 8 h 05 ne doit pas voir son horaire déplacé par le simple fait de rouvrir
 * l'écran.
 */
export function heuresProposees(valeurActuelle?: number): readonly number[] {
  const proposees: number[] = [];
  for (let minutes = 0; minutes <= 24 * 60; minutes += PAS_HORAIRE) proposees.push(minutes);
  if (valeurActuelle !== undefined && !proposees.includes(valeurActuelle)) {
    proposees.push(valeurActuelle);
    proposees.sort((a, b) => a - b);
  }
  return proposees;
}

/** Ce qui empêche d'enregistrer des horaires. */
export interface ProblemeHoraire {
  readonly jour: Jour;
  readonly message: string;
}

/**
 * Relève ce qui est impossible, pas ce qui est inhabituel.
 *
 * Ouvrir le dimanche à 5 h n'est pas une erreur : c'est le métier de certains. Finir avant
 * d'avoir commencé en est une.
 */
export function problemesHoraires(horaires: Horaires): readonly ProblemeHoraire[] {
  const problemes: ProblemeHoraire[] = [];

  for (const jour of JOURS) {
    const creneaux = horaires[jour];

    for (const creneau of creneaux) {
      if (creneau.debut < 0 || creneau.fin > MINUTES_PAR_JOUR) {
        problemes.push({ jour, message: 'Une heure sort de la journée.' });
        continue;
      }
      if (creneau.fin <= creneau.debut) {
        problemes.push({
          jour,
          message: 'L’heure de fermeture doit venir après l’heure d’ouverture.',
        });
      }
    }

    const ordonnes = [...creneaux].toSorted((a, b) => a.debut - b.debut);
    for (let rang = 1; rang < ordonnes.length; rang += 1) {
      const precedent = ordonnes[rang - 1];
      const courant = ordonnes[rang];
      if (precedent === undefined || courant === undefined) continue;
      if (courant.debut < precedent.fin) {
        problemes.push({ jour, message: 'Deux plages de ce jour se chevauchent.' });
        break;
      }
    }
  }

  return problemes;
}

/**
 * Range les créneaux et fusionne ceux qui se touchent.
 *
 * `8 h – 12 h` et `12 h – 18 h` saisis séparément décrivent une journée continue : les garder
 * distincts afficherait une pause qui n'existe pas.
 */
export function normaliseHoraires(horaires: Horaires): Horaires {
  const resultat: Record<Jour, readonly Creneau[]> = { ...semaineFermee() };

  for (const jour of JOURS) {
    const ordonnes = [...horaires[jour]]
      .filter((creneau) => creneau.fin > creneau.debut)
      .toSorted((a, b) => a.debut - b.debut);

    const fusionnes: Creneau[] = [];
    for (const creneau of ordonnes) {
      const dernier = fusionnes.at(-1);
      if (dernier !== undefined && creneau.debut <= dernier.fin) {
        fusionnes[fusionnes.length - 1] = {
          debut: dernier.debut,
          fin: Math.max(dernier.fin, creneau.fin),
        };
      } else {
        fusionnes.push(creneau);
      }
    }
    resultat[jour] = fusionnes;
  }

  return resultat;
}

/** Y a-t-il au moins un créneau dans la semaine ? */
export function horairesRenseignes(horaires: Horaires): boolean {
  return JOURS.some((jour) => horaires[jour].length > 0);
}

/**
 * Est-ce ouvert ce jour-là, à cette minute ?
 *
 * Le jour et la minute sont fournis par l'appelant, déjà exprimés dans le fuseau du site.
 */
export function estOuvert(horaires: Horaires, jour: Jour, minutes: number): boolean {
  return horaires[jour].some((creneau) => minutes >= creneau.debut && minutes < creneau.fin);
}

/** La prochaine ouverture, à partir d'un instant donné. */
export interface ProchaineOuverture {
  readonly jour: Jour;
  readonly minutes: number;
  /** Nombre de jours à attendre : 0 aujourd'hui, 1 demain. */
  readonly dansNJours: number;
}

/**
 * Quand est-ce que ça rouvre ?
 *
 * Rend `null` quand la semaine est entièrement fermée — il n'y a alors rien à annoncer, et
 * prétendre le contraire serait pire que se taire.
 */
export function prochaineOuverture(
  horaires: Horaires,
  jour: Jour,
  minutes: number,
): ProchaineOuverture | null {
  const depart = JOURS.indexOf(jour);
  if (depart < 0) return null;

  for (let decalage = 0; decalage < 7; decalage += 1) {
    const candidat = JOURS[(depart + decalage) % 7];
    if (candidat === undefined) continue;

    for (const creneau of [...horaires[candidat]].toSorted((a, b) => a.debut - b.debut)) {
      // Aujourd'hui, seuls les créneaux encore à venir comptent.
      if (decalage === 0 && creneau.debut <= minutes) continue;
      return { jour: candidat, minutes: creneau.debut, dansNJours: decalage };
    }
  }

  return null;
}

/** Jusqu'à quelle heure c'est ouvert, si ça l'est maintenant. */
export function fermetureEnCours(horaires: Horaires, jour: Jour, minutes: number): number | null {
  const creneau = horaires[jour].find((plage) => minutes >= plage.debut && minutes < plage.fin);
  return creneau === undefined ? null : creneau.fin;
}

/**
 * Les horaires tels qu'ils sortent de la base : du JSON dont on ne sait rien.
 *
 * La base garde un `Json` libre. Le lire sans le vérifier reviendrait à faire confiance à ce
 * qu'une version précédente du code y a écrit — y compris une version qui n'existe pas encore.
 */
export function horairesDepuisJson(valeur: unknown): Horaires | null {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return null;

  const brut = valeur as Record<string, unknown>;
  const resultat: Record<Jour, readonly Creneau[]> = { ...semaineFermee() };

  for (const jour of JOURS) {
    const creneaux = brut[jour];
    if (creneaux === undefined) continue;
    if (!Array.isArray(creneaux)) return null;

    const lus: Creneau[] = [];
    for (const creneau of creneaux) {
      if (typeof creneau !== 'object' || creneau === null) return null;
      const { debut, fin } = creneau as { debut?: unknown; fin?: unknown };
      if (typeof debut !== 'number' || typeof fin !== 'number') return null;
      if (!Number.isFinite(debut) || !Number.isFinite(fin)) return null;
      lus.push({ debut, fin });
    }
    resultat[jour] = lus;
  }

  return normaliseHoraires(resultat);
}
