/**
 * Les mentions obligatoires d'une facture.
 *
 * Ces tests sont écrits à l'envers des autres : chacun part d'une facture **complète** et
 * retire une seule chose. C'est la seule façon de prouver qu'un contrôle sert — un test qui
 * part d'un objet vide et vérifie qu'il manque quinze mentions passerait encore si quatorze
 * des quinze vérifications disparaissaient.
 */

import { describe, expect, it } from 'vitest';
import {
  DELAI_PAIEMENT_LEGAL_JOURS,
  INDEMNITE_RECOUVREMENT_EUROS,
  echeanceDe,
  factureConforme,
  phrasePenalites,
  type AdressePostale,
  type MentionsFacture,
} from './document.ts';

const ADRESSE: AdressePostale = {
  voie: '12 rue des Lilas',
  codePostal: '75011',
  commune: 'Paris',
};

const EMISE_LE = new Date('2026-03-10T09:00:00');

/** Une facture à un particulier, complète : le point de départ de presque tous les tests. */
function complete(): MentionsFacture {
  return {
    numero: 'FA-2026-0007',
    emiseLe: EMISE_LE,
    prestationLe: new Date('2026-03-09T08:00:00'),
    emetteur: {
      nom: 'Plomberie Exemple',
      formeJuridique: 'EI',
      adresse: ADRESSE,
      siret: '12345678900017',
      numeroTva: 'FR12345678900',
      franchiseTva: false,
      immatriculation: { registre: 'rm', lieu: 'Paris' },
      capitalSocialEuros: null,
      assurance: { assureur: 'Assureur Exemple', couverture: 'France métropolitaine' },
      mediateur: { nom: 'Médiateur Exemple', url: 'https://exemple.test/mediation' },
      batiment: true,
      societe: false,
    },
    destinataire: {
      nom: 'Madame Dupuis',
      adresse: { voie: '3 allée des Tilleuls', codePostal: '93100', commune: 'Montreuil' },
      siren: null,
      professionnel: false,
    },
    reglement: {
      echeanceLe: echeanceDe(EMISE_LE),
      tauxPenalites: { mode: 'legal' },
      escompte: null,
    },
    categorieOperation: 'mixte',
    adresseLivraison: null,
    tvaSurLesDebits: false,
    autoliquidation: false,
  };
}

/** La facture complète, avec une modification. */
function sauf(modification: (facture: MentionsFacture) => MentionsFacture): MentionsFacture {
  return modification(complete());
}

describe('factureConforme', () => {
  it('accepte une facture complète', () => {
    const resultat = factureConforme(complete());
    expect(resultat.manquants).toEqual([]);
    expect(resultat.conforme).toBe(true);
  });

  it.each([
    [
      'la forme juridique',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, formeJuridique: null } }),
    ],
    ['le SIRET', (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, siret: null } })],
    [
      'l’adresse du siège',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, adresse: null } }),
    ],
    [
      'l’immatriculation',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, immatriculation: null } }),
    ],
    [
      'le numéro de TVA',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, numeroTva: null } }),
    ],
    [
      'l’assurance',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, assurance: null } }),
    ],
    [
      'le médiateur',
      (f: MentionsFacture) => ({ ...f, emetteur: { ...f.emetteur, mediateur: null } }),
    ],
    [
      'le nom du client',
      (f: MentionsFacture) => ({ ...f, destinataire: { ...f.destinataire, nom: '' } }),
    ],
    [
      'l’adresse du client',
      (f: MentionsFacture) => ({ ...f, destinataire: { ...f.destinataire, adresse: null } }),
    ],
    ['le numéro', (f: MentionsFacture) => ({ ...f, numero: null })],
    ['la date d’émission', (f: MentionsFacture) => ({ ...f, emiseLe: null })],
    ['la date de prestation', (f: MentionsFacture) => ({ ...f, prestationLe: null })],
    ['la catégorie de l’opération', (f: MentionsFacture) => ({ ...f, categorieOperation: null })],
    [
      'l’échéance',
      (f: MentionsFacture) => ({ ...f, reglement: { ...f.reglement, echeanceLe: null } }),
    ],
  ])('refuse une facture sans %s', (_quoi, retire) => {
    const resultat = factureConforme(sauf(retire));
    expect(resultat.conforme).toBe(false);
    expect(resultat.manquants).toHaveLength(1);
  });

  it('accepte une adresse avec complément, refuse une adresse à trous', () => {
    const avecComplement = sauf((f) => ({
      ...f,
      emetteur: { ...f.emetteur, adresse: { ...ADRESSE, complement: 'Bâtiment B' } },
    }));
    expect(factureConforme(avecComplement).conforme).toBe(true);

    // Une voie faite d'espaces n'est pas une adresse : un champ vide ne prouve rien, un champ
    // rempli d'espaces non plus.
    const voieVide = sauf((f) => ({
      ...f,
      emetteur: { ...f.emetteur, adresse: { ...ADRESSE, voie: '   ' } },
    }));
    expect(factureConforme(voieVide).conforme).toBe(false);
  });

  describe('ce que le régime de l’entreprise change', () => {
    it('dispense de numéro de TVA en franchise en base', () => {
      // Exiger un numéro que le professionnel n'a pas le bloquerait sans rien protéger.
      const franchise = sauf((f) => ({
        ...f,
        emetteur: { ...f.emetteur, numeroTva: null, franchiseTva: true },
      }));
      expect(factureConforme(franchise).conforme).toBe(true);
    });

    it('exige le capital social d’une société, et non d’une entreprise individuelle', () => {
      const societe = sauf((f) => ({
        ...f,
        emetteur: { ...f.emetteur, societe: true, formeJuridique: 'SASU' },
      }));
      expect(factureConforme(societe).manquants).toEqual(['Capital social']);

      const avecCapital = sauf((f) => ({
        ...f,
        emetteur: {
          ...f.emetteur,
          societe: true,
          formeJuridique: 'SASU',
          capitalSocialEuros: 1000,
        },
      }));
      expect(factureConforme(avecCapital).conforme).toBe(true);
    });

    it('n’exige l’assurance que des métiers du bâtiment', () => {
      const horsBatiment = sauf((f) => ({
        ...f,
        emetteur: { ...f.emetteur, batiment: false, assurance: null },
      }));
      expect(factureConforme(horsBatiment).conforme).toBe(true);
    });

    it('refuse une assurance sans couverture géographique', () => {
      // Une assurance sans territoire ne dit rien : le client doit savoir avant de signer.
      const sansCouverture = sauf((f) => ({
        ...f,
        emetteur: {
          ...f.emetteur,
          assurance: { assureur: 'Assureur Exemple', couverture: '' },
        },
      }));
      expect(factureConforme(sansCouverture).manquants).toEqual([
        'Couverture géographique de l’assurance',
      ]);
    });
  });

  describe('ce que la qualité du client change', () => {
    it('exige le SIREN d’un client professionnel', () => {
      const pro = sauf((f) => ({
        ...f,
        destinataire: { ...f.destinataire, professionnel: true },
      }));
      expect(factureConforme(pro).manquants).toEqual(['Numéro SIREN du client']);
    });

    it('n’exige pas de médiateur face à un professionnel', () => {
      // La médiation de la consommation ne concerne que les particuliers.
      const pro = sauf((f) => ({
        ...f,
        emetteur: { ...f.emetteur, mediateur: null },
        destinataire: { ...f.destinataire, professionnel: true, siren: '123456789' },
      }));
      expect(factureConforme(pro).conforme).toBe(true);
    });
  });

  it('refuse un taux de pénalités stipulé à zéro', () => {
    // Stipuler un taux nul n'est pas licite : on ne peut pas renoncer d'avance aux pénalités.
    const nul = sauf((f) => ({
      ...f,
      reglement: { ...f.reglement, tauxPenalites: { mode: 'stipule' as const, tauxAnnuel: 0 } },
    }));
    expect(factureConforme(nul).manquants).toEqual(['Taux des pénalités de retard']);
  });

  it('énumère tout ce qui manque, et pas seulement le premier', () => {
    // Le professionnel doit pouvoir tout compléter en une fois.
    const vide = sauf((f) => ({
      ...f,
      numero: null,
      emiseLe: null,
      emetteur: { ...f.emetteur, siret: null, formeJuridique: null },
    }));
    expect(factureConforme(vide).manquants).toHaveLength(4);
  });
});

describe('phrasePenalites', () => {
  it('imprime la formule au taux légal, et non le chiffre du semestre', () => {
    // Un taux périmé sur une facture est plus dangereux qu'une formule : il a l'air juste.
    const phrase = phrasePenalites({ mode: 'legal' });
    expect(phrase).toContain('Banque centrale européenne');
    expect(phrase).toContain('dix points de pourcentage');
    expect(phrase).not.toMatch(/\d+,\d+ %/);
  });

  it('imprime le taux stipulé quand il y en a un', () => {
    expect(phrasePenalites({ mode: 'stipule', tauxAnnuel: 12.15 })).toContain('12,15 %');
  });

  it('rappelle l’indemnité forfaitaire dans les deux cas', () => {
    for (const taux of [{ mode: 'legal' as const }, { mode: 'stipule' as const, tauxAnnuel: 10 }]) {
      expect(phrasePenalites(taux)).toContain(`${String(INDEMNITE_RECOUVREMENT_EUROS)} €`);
      expect(phrasePenalites(taux)).toContain('de plein droit');
    }
  });
});

describe('echeanceDe', () => {
  it('applique le délai légal de trente jours par défaut', () => {
    expect(DELAI_PAIEMENT_LEGAL_JOURS).toBe(30);
    expect(echeanceDe(new Date('2026-03-10T09:00:00')).toISOString().slice(0, 10)).toBe(
      '2026-04-09',
    );
  });

  it('franchit les fins de mois sans se tromper', () => {
    // Février 2028 est bissextile : une addition de jours faite à la main se trompe ici.
    expect(echeanceDe(new Date('2028-02-10T09:00:00'), 30).toISOString().slice(0, 10)).toBe(
      '2028-03-11',
    );
  });

  it('ne modifie pas la date qu’on lui donne', () => {
    const emiseLe = new Date('2026-03-10T09:00:00');
    echeanceDe(emiseLe);
    expect(emiseLe.getDate()).toBe(10);
  });
});
