import {
  MENTION_AUTOLIQUIDATION,
  MENTION_FRANCHISE_TVA,
  phrasePenalites,
  totauxRamenesA,
  xmlFacturx,
  type CodeNote,
  type FactureFacturx,
} from '@lerenom/core';
import { factureAImprimer, type DocumentAImprimer } from '@/lib/document-a-imprimer';

/**
 * Le XML Factur-X d'une facture, à partir du document déjà assemblé.
 *
 * **Même source que le PDF.** C'est tout l'enjeu : Factur-X existe pour qu'un fichier unique
 * se lise à l'œil et se traite à la machine, et un XML construit depuis une seconde lecture de
 * la base finirait un jour par contredire la facture qu'il accompagne. On part donc de
 * `factureAImprimer`, le même assemblage qui produit la page.
 *
 * **Les mentions du pied deviennent des notes.** Le XML doit porter ce que le PDF affiche :
 * une facture dont les pénalités de retard figurent sur le papier mais pas dans les données
 * n'est pas la même facture selon qu'on la lit ou qu'on la traite.
 */

/** Les notes du document, avec le code qui dit à quoi chacune se rapporte. */
function notesDe(document: DocumentAImprimer): { code: CodeNote; texte: string }[] {
  const { emetteur } = document;
  const notes: { code: CodeNote; texte: string }[] = [];

  const identite = [
    emetteur.formeJuridique,
    emetteur.capitalSocialEuros === null
      ? null
      : `capital ${emetteur.capitalSocialEuros.toLocaleString('fr-FR')} EUR`,
  ].filter((morceau): morceau is string => morceau !== null);
  if (identite.length > 0) notes.push({ code: 'REG', texte: identite.join(', ') });

  if (emetteur.immatriculation !== null && emetteur.immatriculation.lieu !== '') {
    const registre = emetteur.immatriculation.registre === 'rcs' ? 'RCS' : 'RM';
    notes.push({ code: 'ABL', texte: `${registre} ${emetteur.immatriculation.lieu}` });
  }

  if (emetteur.franchiseTva) notes.push({ code: 'AAI', texte: MENTION_FRANCHISE_TVA });
  if (document.autoliquidation) notes.push({ code: 'AAI', texte: MENTION_AUTOLIQUIDATION });

  notes.push({ code: 'PMD', texte: phrasePenalites(document.tauxPenalites) });
  if (document.escompte !== null) notes.push({ code: 'AAB', texte: document.escompte });

  if (emetteur.batiment && emetteur.assurance !== null) {
    notes.push({
      code: 'AAI',
      texte: `Assurance professionnelle : ${emetteur.assurance.assureur} — couverture : ${emetteur.assurance.couverture}`,
    });
  }
  if (!document.destinataire.professionnel && emetteur.mediateur !== null) {
    notes.push({
      code: 'AAI',
      texte: `Médiation de la consommation : ${emetteur.mediateur.nom} — ${emetteur.mediateur.url}`,
    });
  }

  return notes;
}

/** Le document imprimable, traduit en facture Factur-X. */
export function facturxDepuisDocument(document: DocumentAImprimer): FactureFacturx | null {
  // Une facture non émise n'a ni numéro ni date : elle n'est pas encore une facture, et en
  // produire le XML reviendrait à faire circuler un document comptable qui n'existe pas.
  if (document.numero === null || document.emiseLe === null) return null;

  return {
    numero: document.numero,
    emiseLe: document.emiseLe,
    echeanceLe: document.echeanceLe,
    livreeLe: document.prestationLe,
    avoir: document.type === 'avoir',
    vendeur: {
      nom: document.emetteur.nom,
      siret: document.emetteur.siret,
      numeroTva: document.emetteur.numeroTva,
      adresse: document.emetteur.adresse,
    },
    acheteur: {
      nom: document.destinataire.nom,
      // Le SIREN d'un client professionnel tient lieu d'identifiant légal ; un particulier
      // n'en a pas, et le champ reste vide plutôt que d'être rempli de son nom.
      siret: document.destinataire.siren,
      numeroTva: null,
      adresse: document.destinataire.adresse,
    },
    // Une facture d'acompte porte les lignes du chantier entier mais n'en réclame qu'une
    // fraction. Le PDF le dit en toutes lettres ; le XML ne le peut pas — la norme exige que
    // `GrandTotal − Prepaid = DuePayable`, et déclarer la différence comme déjà payée serait
    // un mensonge : rien n'a été versé. On ramène donc le document à ce qu'il réclame.
    totaux: document.acompte
      ? totauxRamenesA(document.totaux, document.montantAPayerTTC)
      : document.totaux,
    acompteDejaFactureTTC: document.acompteDejaFactureTTC,
    montantAPayerTTC: document.montantAPayerTTC,
    iban: document.rib?.iban ?? null,
    franchiseTva: document.emetteur.franchiseTva,
    autoliquidation: document.autoliquidation,
    notes: notesDe(document),
  };
}

/**
 * Le XML Factur-X d'une facture émise, ou `null`.
 *
 * `null` couvre trois cas qu'on ne distingue pas : la facture n'existe pas, elle appartient à
 * une autre entreprise, ou elle n'est pas émise. Les séparer apprendrait quelque chose à qui
 * devine des identifiants.
 */
export async function facturxDeLaFacture(
  entrepriseId: string,
  factureId: string,
): Promise<string | null> {
  const document = await factureAImprimer(entrepriseId, factureId);
  if (document === null) return null;
  const facture = facturxDepuisDocument(document);
  return facture === null ? null : xmlFacturx(facture);
}
