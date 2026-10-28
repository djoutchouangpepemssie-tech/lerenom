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

/* ------------------------------------------------------------------------- */
/* Confirmation de l'intervention par le client                              */
/* ------------------------------------------------------------------------- */

/**
 * Faut-il demander au client si l'intervention a eu lieu ?
 *
 * Toute la chaîne des avis part de l'étape « travaux réalisés ». Si seul le professionnel
 * pouvait la déclarer, celui qui ne déclare jamais rien n'aurait jamais de mauvais avis :
 * l'intérêt du pro et celui de la plateforme divergeraient, et le système d'avis se viderait
 * de sa substance. C'est le client qui tranche, et il est le mieux placé pour le faire.
 *
 * On interroge, on ne harcèle pas : la première question part quelques jours après
 * l'acceptation, les relances sont espacées et plafonnées.
 */
export interface EtatConfirmation {
  readonly accepteeLe: Date;
  /** Le pro ou le client a-t-il déjà déclaré quelque chose ? */
  readonly travauxDejaDeclares: boolean;
  readonly demandeAnnuleeLe: Date | null;
  readonly relancesEnvoyees: number;
  readonly derniereRelanceLe: Date | null;
}

export interface ReglesConfirmation {
  readonly joursConfirmationIntervention: number;
  readonly joursEntreRelancesConfirmation: number;
  readonly relancesConfirmationMax: number;
}

export function confirmationInterventionDue(
  etat: EtatConfirmation,
  regles: ReglesConfirmation,
  maintenant: Date = new Date(),
): boolean {
  if (etat.travauxDejaDeclares) return false;
  if (etat.demandeAnnuleeLe !== null) return false;
  // `relancesConfirmationMax` compte les relances : la première question n'en est pas une.
  if (etat.relancesEnvoyees > regles.relancesConfirmationMax) return false;

  const jour = 24 * 60 * 60 * 1000;

  if (etat.relancesEnvoyees === 0 || etat.derniereRelanceLe === null) {
    return (
      maintenant.getTime() >=
      etat.accepteeLe.getTime() + regles.joursConfirmationIntervention * jour
    );
  }

  return (
    maintenant.getTime() >=
    etat.derniereRelanceLe.getTime() + regles.joursEntreRelancesConfirmation * jour
  );
}

/** Les trois réponses possibles du client à « l'intervention a-t-elle eu lieu ? ». */
export type ReponseConfirmation = 'oui' | 'pas-encore' | 'non';

/* ------------------------------------------------------------------------- */
/* Caviardage                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Les mentions substituées. Elles sont explicites : un caviardage silencieux serait une
 * réécriture, et une plateforme d'avis n'a pas à réécrire ce qu'on lui confie.
 */
export const MENTIONS_CAVIARDAGE: Readonly<Record<'telephone' | 'email' | 'lien', string>> =
  Object.freeze({
    telephone: '[numéro retiré]',
    email: '[adresse retirée]',
    lien: '[lien retiré]',
  });

export interface Caviardage {
  readonly texte: string;
  /** Ce qui a été retiré, pour que le relecteur voie ce qu'il publie. */
  readonly retraits: readonly ('telephone' | 'email' | 'lien')[];
}

/**
 * Retire d'un commentaire ce qui ne doit pas être publié, en le disant.
 *
 * Le choix est délibéré : plutôt que de refuser en bloc un avis contenant un numéro de
 * téléphone, on publie l'avis sans le numéro. L'auteur a pris la peine d'écrire, son avis
 * compte, et il n'a généralement pas voulu mal faire. Mais le retrait est **visible** —
 * « [numéro retiré] » — parce que modifier le propos de quelqu'un sans le dire serait pire
 * que de ne rien publier.
 *
 * Le texte d'origine n'est jamais écrasé : c'est la version publiée qui est caviardée, et le
 * relecteur garde sous les yeux ce que l'auteur avait écrit.
 */
export function caviarde(commentaire: string): Caviardage {
  const retraits = new Set<'telephone' | 'email' | 'lien'>();
  let texte = commentaire;

  // L'ordre compte : une adresse électronique contient un point, un lien aussi, et un numéro
  // mal découpé pourrait se cacher dans l'un ou l'autre. On retire du plus spécifique au moins.
  texte = texte.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, () => {
    retraits.add('email');
    return MENTIONS_CAVIARDAGE.email;
  });

  texte = texte.replace(/\b(?:https?:\/\/|www\.)\S+/gi, () => {
    retraits.add('lien');
    return MENTIONS_CAVIARDAGE.lien;
  });

  texte = texte.replace(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g, () => {
    retraits.add('telephone');
    return MENTIONS_CAVIARDAGE.telephone;
  });

  // Les espaces laissés par les retraits ne doivent pas déformer la mise en page.
  texte = texte.replace(/[ \t]{2,}/g, ' ').trim();

  return { texte, retraits: [...retraits] };
}
