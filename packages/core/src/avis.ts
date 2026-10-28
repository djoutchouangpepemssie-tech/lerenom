/**
 * Les avis : qui peut en déposer un, ce qu'il contient, ce qui doit être relu.
 *
 * La charte publique engage Le Renom sur trois points, et ce module les tient :
 *   * un avis **ne peut venir que d'une demande réelle** dont les travaux ont été déclarés
 *     réalisés. Il n'existe aucun autre chemin : ni formulaire libre, ni import ;
 *   * l'invitation part **quinze jours après les travaux** — le délai est un paramètre, pas un
 *     nombre écrit ici ;
 *   * **aucun avis n'est publié sans relecture**, et un refus est motivé. Un avis n'est jamais
 *     refusé parce qu'il est négatif.
 *
 * Ce module ne modère pas : il **signale**. La décision revient à un humain, parce qu'un
 * automate qui refuserait seul finirait par refuser un client mécontent et honnête.
 */

/** Les quatre critères notés, en plus de la note d'ensemble. */
export const CRITERES_AVIS = Object.freeze([
  { cle: 'qualite', libelle: 'Qualité du travail' },
  { cle: 'delai', libelle: 'Respect des délais' },
  { cle: 'proprete', libelle: 'Propreté du chantier' },
  { cle: 'prix', libelle: 'Rapport qualité-prix' },
] as const);

export type CritereAvis = (typeof CRITERES_AVIS)[number]['cle'];

export const NOTE_MIN = 1;
export const NOTE_MAX = 5;
/** En-deçà, un commentaire n'apprend rien ; au-delà, personne ne le lit. */
export const COMMENTAIRE_MIN = 10;
export const COMMENTAIRE_MAX = 1500;

export interface EtatAvis {
  /** Les travaux ont-ils été déclarés réalisés, et quand ? `null` si non. */
  readonly travauxRealisesLe: Date | null;
  /** Un avis existe-t-il déjà pour cette demande ? Une demande, un avis. */
  readonly avisDejaDepose: boolean;
  readonly demandeAnnuleeLe: Date | null;
}

export type DroitAvis =
  | { readonly issue: 'peut-deposer' }
  | { readonly issue: 'travaux-non-realises' }
  | { readonly issue: 'deja-depose' }
  | { readonly issue: 'demande-annulee' };

/**
 * Le client peut-il déposer un avis ?
 *
 * On ne demande **pas** que le délai de quinze jours soit écoulé : ce délai dit quand
 * l'invitation part, pas à partir de quand l'avis est recevable. Un client qui répond le jour
 * même parce qu'il est content n'a pas à attendre.
 */
export function droitDeDeposerUnAvis(etat: EtatAvis): DroitAvis {
  if (etat.demandeAnnuleeLe !== null) return { issue: 'demande-annulee' };
  if (etat.avisDejaDepose) return { issue: 'deja-depose' };
  if (etat.travauxRealisesLe === null) return { issue: 'travaux-non-realises' };
  return { issue: 'peut-deposer' };
}

/**
 * L'invitation à déposer un avis doit-elle partir ?
 *
 * Quinze jours après les travaux, une fois et une seule. Le délai vient des paramètres :
 * Arcel peut le changer depuis le back-office, sans déploiement.
 */
export function invitationAvisDue(
  travauxRealisesLe: Date,
  dejaInvite: boolean,
  joursDemandeAvis: number,
  maintenant: Date = new Date(),
): boolean {
  if (dejaInvite) return false;
  const echeance = travauxRealisesLe.getTime() + joursDemandeAvis * 24 * 60 * 60 * 1000;
  return maintenant.getTime() >= echeance;
}

export interface AvisSaisi {
  readonly note: number;
  readonly criteres?: Partial<Record<CritereAvis, number>> | undefined;
  readonly commentaire?: string | undefined;
}

export type ErreurAvis =
  | 'note-hors-bornes'
  | 'note-non-entiere'
  | 'critere-hors-bornes'
  | 'commentaire-trop-court'
  | 'commentaire-trop-long';

/** Valide une saisie. Les erreurs sont rendues toutes ensemble : on ne corrige pas au compte-gouttes. */
export function valideAvis(saisi: AvisSaisi): readonly ErreurAvis[] {
  const erreurs: ErreurAvis[] = [];

  if (!Number.isInteger(saisi.note)) erreurs.push('note-non-entiere');
  else if (saisi.note < NOTE_MIN || saisi.note > NOTE_MAX) erreurs.push('note-hors-bornes');

  for (const valeur of Object.values(saisi.criteres ?? {})) {
    if (!Number.isInteger(valeur) || valeur < NOTE_MIN || valeur > NOTE_MAX) {
      erreurs.push('critere-hors-bornes');
      break;
    }
  }

  const commentaire = saisi.commentaire?.trim() ?? '';
  if (commentaire !== '') {
    if (commentaire.length < COMMENTAIRE_MIN) erreurs.push('commentaire-trop-court');
    if (commentaire.length > COMMENTAIRE_MAX) erreurs.push('commentaire-trop-long');
  }

  return erreurs;
}

/**
 * Les mots dont la présence appelle une relecture attentive.
 *
 * La liste est courte et volontairement grossière : elle ne décide de rien, elle fait monter
 * l'avis en tête de la pile de modération. Un avis dur mais correct passe sans encombre.
 */
const INJURES = [
  'connard',
  'connards',
  'enculé',
  'enculés',
  'salaud',
  'salauds',
  'salope',
  'salopes',
  'pute',
  'putes',
  'bâtard',
  'bâtards',
  'abruti',
  'abrutis',
];

export type SignalAvis =
  | 'coordonnees-telephoniques'
  | 'adresse-electronique'
  | 'lien-externe'
  | 'injure-possible'
  | 'cris'
  | 'accusation-grave';

/**
 * Les signaux qui appellent une relecture.
 *
 * Deux familles : ce qui ne doit **pas être publié tel quel** — un numéro, une adresse, un lien
 * — et ce qui demande un œil humain : injure possible, texte tout en capitales, accusation
 * grave (vol, escroquerie) qui engage la responsabilité de la plateforme si elle est fausse.
 */
export function signauxDeModeration(commentaire: string): readonly SignalAvis[] {
  const signaux = new Set<SignalAvis>();
  const texte = commentaire.trim();
  if (texte === '') return [];

  // Un numéro français, écrit avec ou sans séparateurs.
  if (/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/.test(texte)) {
    signaux.add('coordonnees-telephoniques');
  }
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(texte)) signaux.add('adresse-electronique');
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(texte)) signaux.add('lien-externe');

  const minuscules = texte.toLowerCase();
  if (INJURES.some((mot) => new RegExp(`\\b${mot}\\b`, 'i').test(minuscules))) {
    signaux.add('injure-possible');
  }

  // Tout en capitales sur une longueur significative : on demande à l'auteur de reformuler.
  const lettres = texte.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (lettres.length >= 25 && lettres === lettres.toUpperCase()) signaux.add('cris');

  if (/\b(?:vol|volé|voleur|escroc|escroquerie|arnaque|arnaqueur|fraude)\b/i.test(minuscules)) {
    signaux.add('accusation-grave');
  }

  return [...signaux];
}

/**
 * La moyenne des critères, quand ils sont renseignés.
 *
 * Elle ne remplace jamais la note d'ensemble : c'est le client qui note, pas une formule.
 * Elle sert à l'affichage et au détail de la fiche.
 */
export function moyenneDesCriteres(
  criteres: Partial<Record<CritereAvis, number>> | undefined,
): number | null {
  const valeurs = Object.values(criteres ?? {}).filter((v): v is number => typeof v === 'number');
  if (valeurs.length === 0) return null;
  return valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length;
}
