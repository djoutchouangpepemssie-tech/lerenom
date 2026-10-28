/**
 * L'avoir : la seule façon de corriger une facture émise.
 *
 * Une facture émise n'est ni modifiable ni supprimable — la base l'interdit par déclencheur.
 * Ce n'est pas une rigidité gratuite : une facture est remise à un client, comptabilisée des
 * deux côtés, et parfois déjà payée. La corriger en silence rendrait impossible de dire,
 * plus tard, quel montant faisait foi.
 *
 * L'avoir résout cela en **ajoutant** un document au lieu d'en retoucher un : il constate une
 * dette de l'artisan envers son client, porte son propre numéro dans sa propre série, et
 * laisse la facture d'origine telle qu'elle a été remise. Les deux se lisent ensemble.
 *
 * Trois règles gouvernent ce fichier.
 *
 * **On ne crédite que ce qui a été facturé.** La somme des avoirs d'une facture ne peut pas
 * dépasser son montant. Sans cette borne, un artisan devrait de l'argent à un client qui ne
 * lui en a jamais versé autant — et l'écart apparaîtrait à la liasse fiscale, pas avant.
 *
 * **Un avoir se motive.** Le motif n'est pas une politesse : il est ce qui permet, un an plus
 * tard, de dire pourquoi la somme due a changé. « Erreur » n'explique rien ; l'écran demande
 * une phrase.
 *
 * **Un avoir est définitif dès sa création.** Il n'a pas de brouillon, pas d'étape d'émission.
 * Un avoir qu'on pourrait retoucher ne vaudrait pas mieux que la facture qu'il corrige.
 */

/** Les statuts de facture depuis lesquels un avoir a un sens. */
export type StatutFacturable = 'prete' | 'emise' | 'payee' | 'annulee_par_avoir';

/**
 * La longueur minimale d'un motif d'avoir.
 *
 * Vingt caractères : de quoi écrire « Erreur de quantité » et pas seulement « erreur ». Le
 * seuil est un garde-fou contre le remplissage machinal, pas une mesure de la qualité d'une
 * explication — personne ne peut vérifier qu'un motif dit vrai. Voir docs/QUESTIONS.md Q29.
 */
export const MOTIF_LONGUEUR_MINIMALE = 20;

/** Ce qu'il faut savoir de la facture pour décider si elle peut être créditée, et de combien. */
export interface FactureACrediter {
  readonly statut: StatutFacturable;
  /** Le montant réclamé au client par cette facture, toutes taxes comprises. */
  readonly montantAPayerTTC: number;
  /** La somme des avoirs déjà émis sur elle. */
  readonly dejaCrediteTTC: number;
}

export interface SaisieAvoir {
  readonly montantTTC: number;
  readonly motif: string;
}

export interface ProblemeAvoir {
  readonly champ: 'facture' | 'montantTTC' | 'motif';
  readonly message: string;
}

/** Les centimes, pour que deux sommes égales se comparent égales. */
function centimes(montant: number): number {
  return Math.round(montant * 100);
}

function euros(centimes: number): number {
  return Math.round(centimes) / 100;
}

/**
 * Ce qu'il reste créditable sur une facture, au centime.
 *
 * Jamais négatif : si les avoirs dépassaient déjà le montant — ce que les contrôles
 * interdisent, mais qu'une reprise de données pourrait produire — on affiche zéro plutôt
 * qu'un reste négatif, qui se lirait comme un crédit disponible.
 */
export function resteACrediter(facture: FactureACrediter): number {
  return euros(Math.max(0, centimes(facture.montantAPayerTTC) - centimes(facture.dejaCrediteTTC)));
}

/**
 * Tous les problèmes d'un avoir, d'un coup.
 *
 * D'un coup, et non le premier rencontré : corriger un formulaire erreur après erreur est
 * une façon sûre de faire renoncer celui qui le remplit.
 */
export function problemesAvoir(
  saisie: SaisieAvoir,
  facture: FactureACrediter,
): readonly ProblemeAvoir[] {
  const problemes: ProblemeAvoir[] = [];

  // Une facture non émise n'a rien à corriger : elle se modifie, ou se jette. Lui opposer un
  // avoir créerait un document de correction pour une erreur que personne n'a jamais reçue.
  if (facture.statut === 'prete') {
    problemes.push({
      champ: 'facture',
      message:
        'Cette facture n’est pas encore émise : corrigez-la directement, un avoir n’a de sens que pour un document déjà remis au client.',
    });
  }

  const reste = resteACrediter(facture);
  if (facture.statut !== 'prete' && centimes(reste) === 0) {
    problemes.push({
      champ: 'facture',
      message: 'Cette facture est déjà entièrement créditée : il n’y a plus rien à corriger.',
    });
  }

  if (!Number.isFinite(saisie.montantTTC) || centimes(saisie.montantTTC) <= 0) {
    problemes.push({ champ: 'montantTTC', message: 'Indiquez le montant à créditer.' });
  } else if (centimes(saisie.montantTTC) > centimes(reste) && centimes(reste) > 0) {
    problemes.push({
      champ: 'montantTTC',
      message: `Un avoir ne peut pas dépasser ce qui reste à créditer sur cette facture, soit ${reste.toFixed(2).replace('.', ',')} €.`,
    });
  }

  const motif = saisie.motif.trim();
  if (motif.length === 0) {
    problemes.push({ champ: 'motif', message: 'Expliquez pourquoi vous émettez cet avoir.' });
  } else if (motif.length < MOTIF_LONGUEUR_MINIMALE) {
    problemes.push({
      champ: 'motif',
      message:
        'Une phrase complète : ce motif figure sur le document et doit rester compréhensible dans un an.',
    });
  }

  return problemes;
}

export interface AvoirPrepare {
  readonly motif: string;
  readonly montantTTC: number;
  /**
   * `true` quand cet avoir ramène à zéro ce que la facture réclame.
   *
   * La facture passe alors au statut `annulee_par_avoir`. Elle n'est pas effacée pour autant :
   * une facture annulée reste au livre, avec son avoir en face. C'est précisément la
   * différence entre annuler et supprimer.
   */
  readonly annuleLaFacture: boolean;
}

/**
 * L'avoir à écrire, ou la liste de ce qui s'y oppose.
 *
 * Le numéro n'est pas ici : il s'attribue au moment de l'écriture, dans la transaction qui
 * consulte le dernier numéro de la série. Le calculer ailleurs ouvrirait la porte à deux
 * avoirs portant le même.
 */
export function prepareAvoir(
  saisie: SaisieAvoir,
  facture: FactureACrediter,
):
  | { readonly ok: true; readonly avoir: AvoirPrepare }
  | {
      readonly ok: false;
      readonly problemes: readonly ProblemeAvoir[];
    } {
  const problemes = problemesAvoir(saisie, facture);
  if (problemes.length > 0) return { ok: false, problemes };

  const montantTTC = euros(centimes(saisie.montantTTC));
  return {
    ok: true,
    avoir: {
      motif: saisie.motif.trim(),
      montantTTC,
      annuleLaFacture: centimes(montantTTC) === centimes(resteACrediter(facture)),
    },
  };
}
