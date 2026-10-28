/**
 * Les liens à action unique : les règles.
 *
 * Le Renom n'a pas de compte client. Tout ce qu'un client peut faire — voir qui a accepté sa
 * demande, l'annuler, déposer un avis — passe par un lien reçu par SMS ou par courriel. Ce lien
 * est la seule clé, donc il obéit à trois principes :
 *
 *   * **un lien, une portée.** Le lien de suivi donne accès à *une* demande — la sienne — et à
 *     ce qu'on peut faire dessus : voir qui a accepté, l'annuler. Il n'ouvre pas le devis d'un
 *     autre dossier, ne signe rien, ne paie rien. Ce qui engage juridiquement ou financièrement
 *     — signer un devis, régler une facture — a son propre lien, à usage unique, pour qu'un lien
 *     de suivi qui traîne dans une boîte mail ne puisse pas engager son destinataire ;
 *   * **il expire.** Une boîte mail lue dix ans plus tard ne doit pas rouvrir un dossier ;
 *   * **il se consomme**, quand l'action ne se refait pas. Signer deux fois n'a pas de sens ;
 *     revenir sur les coordonnées d'un plombier, si.
 *
 * Le tirage et le hachage du jeton vivent dans `@lerenom/securite`. Ici, uniquement les règles.
 */

/** Les actions qu'un lien peut porter, telles que la base les nomme. */
export type ActionLien =
  | 'modifier_demande'
  | 'annuler_demande'
  | 'voir_pros'
  | 'choisir_creneau'
  | 'envoyer_photos'
  | 'signer_devis'
  | 'payer_facture'
  | 'deposer_avis'
  | 'confirmer_ouverture';

/**
 * Combien de temps chaque lien reste ouvert.
 *
 * Les durées suivent l'usage, pas une règle unique : on revient longtemps sur les coordonnées
 * d'un artisan qu'on a retenu, on n'annule pas une demande trois semaines après l'avoir
 * déposée — à cette date elle est périmée de toute façon.
 */
export const DUREE_LIEN_JOURS: Readonly<Record<ActionLien, number>> = Object.freeze({
  /** Le temps de la cascade, pas davantage : passé ce délai la demande ne bouge plus. */
  modifier_demande: 3,
  annuler_demande: 7,
  /** On garde l'accès aux coordonnées bien après l'intervention. */
  voir_pros: 90,
  choisir_creneau: 14,
  envoyer_photos: 14,
  signer_devis: 30,
  payer_facture: 60,
  /** L'avis se dépose après les travaux, qui peuvent durer. */
  deposer_avis: 90,
  /** L'ouverture d'une ville peut prendre des mois : ce lien ne doit pas mourir avant. */
  confirmer_ouverture: 180,
});

/**
 * Un lien se rejoue-t-il ?
 *
 * Consulter n'use pas le lien : le client doit pouvoir rouvrir le SMS. Agir l'use, parce que
 * l'action ne se refait pas — et parce qu'un lien consommé est un lien qui ne sert plus à
 * personne s'il fuite ensuite.
 */
export function lienRejouable(action: ActionLien): boolean {
  return action === 'voir_pros' || action === 'modifier_demande';
}

export type EtatLien =
  { readonly issue: 'valide' } | { readonly issue: 'expire' } | { readonly issue: 'deja-utilise' };

export interface LienStocke {
  readonly action: ActionLien;
  readonly expireLe: Date;
  readonly utiliseLe: Date | null;
}

/**
 * Tranche sur un lien présenté.
 *
 * L'expiration passe avant la consommation : un lien périmé est périmé, qu'il ait servi ou non,
 * et c'est la réponse la moins bavarde des deux.
 */
export function decideLien(lien: LienStocke, maintenant: Date = new Date()): EtatLien {
  if (lien.expireLe.getTime() <= maintenant.getTime()) return { issue: 'expire' };
  if (!lienRejouable(lien.action) && lien.utiliseLe !== null) return { issue: 'deja-utilise' };
  return { issue: 'valide' };
}

/** L'instant d'expiration d'un lien créé maintenant. */
export function expirationLien(action: ActionLien, maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + DUREE_LIEN_JOURS[action] * 24 * 60 * 60 * 1000);
}

/**
 * Un jeton est-il bien formé ?
 *
 * 43 caractères de base64url : 32 octets d'aléa. On vérifie la forme avant de toucher la base,
 * pour qu'une adresse au hasard ne coûte pas une requête.
 */
export function jetonBienForme(valeur: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(valeur);
}
