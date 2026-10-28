import { describe, expect, it } from 'vitest';
import { FORMULES, RANG_FORMULE, REGLES_VALIDEES, prixAnnuelHT } from './regles-validees.ts';
import { PARAMETRES_PAR_DEFAUT, avecParametres, sommePoidsScore } from './parametres.ts';

/**
 * Ces tests ne vérifient pas un calcul : ils gardent les décisions d'Arcel.
 * Si l'un d'eux échoue, c'est qu'une valeur validée a bougé sans décision.
 */
describe('décisions validées du 27 octobre 2026', () => {
  it('fixe les prix mensuels HT à 0, 29, 79 et 229 €', () => {
    expect(REGLES_VALIDEES.prixMensuelHT).toEqual({
      gratuit: 0,
      essentiel: 29,
      premium: 79,
      exclusif: 229,
    });
  });

  it('offre 2 mois sur l’abonnement annuel', () => {
    expect(prixAnnuelHT('essentiel')).toBe(290);
    expect(prixAnnuelHT('premium')).toBe(790);
    expect(prixAnnuelHT('exclusif')).toBe(2290);
    expect(prixAnnuelHT('gratuit')).toBe(0);
  });

  it('n’engage que l’Exclusif, et pour 12 mois', () => {
    expect(REGLES_VALIDEES.moisEngagement.exclusif).toBe(12);
    expect(REGLES_VALIDEES.moisEngagement.premium).toBe(0);
    expect(REGLES_VALIDEES.moisEngagement.essentiel).toBe(0);
    expect(REGLES_VALIDEES.moisEngagement.gratuit).toBe(0);
  });

  it('inclut 5 demandes en Premium et 15 en Exclusif, puis 12 € et 9 €', () => {
    expect(REGLES_VALIDEES.demandesIncluses).toEqual({
      gratuit: 0,
      essentiel: 0,
      premium: 5,
      exclusif: 15,
    });
    expect(REGLES_VALIDEES.prixDemandePartagee).toEqual({
      gratuit: 15,
      essentiel: 15,
      premium: 12,
      exclusif: 9,
    });
  });

  it('réserve les demandes urgentes aux formules payantes, à 25, 20 et 15 €', () => {
    expect(REGLES_VALIDEES.prixDemandeUrgente.gratuit).toBeNull();
    expect(REGLES_VALIDEES.prixDemandeUrgente.essentiel).toBe(25);
    expect(REGLES_VALIDEES.prixDemandeUrgente.premium).toBe(20);
    expect(REGLES_VALIDEES.prixDemandeUrgente.exclusif).toBe(15);
  });

  it('limite les villes à 2, 5, 15 puis sans limite', () => {
    expect(REGLES_VALIDEES.villesMax).toEqual({
      gratuit: 2,
      essentiel: 5,
      premium: 15,
      exclusif: null,
    });
  });

  it('limite les agences à 1, 1, 3 puis sans limite', () => {
    expect(REGLES_VALIDEES.agencesMax).toEqual({
      gratuit: 1,
      essentiel: 1,
      premium: 3,
      exclusif: null,
    });
  });

  it('ne dépasse jamais 3 emplacements payés : 1 Exclusif et 2 Premium', () => {
    expect(REGLES_VALIDEES.emplacementsExclusif).toBe(1);
    expect(REGLES_VALIDEES.emplacementsPremium).toBe(2);
    expect(
      REGLES_VALIDEES.emplacementsExclusif + REGLES_VALIDEES.emplacementsPremium,
    ).toBeLessThanOrEqual(REGLES_VALIDEES.emplacementsPayesMax);
  });

  it('plafonne à 6 Premium par métier × ville, soit au moins un affichage sur trois', () => {
    expect(REGLES_VALIDEES.premiumMaxParMetierVille).toBe(6);
    const part = REGLES_VALIDEES.emplacementsPremium / REGLES_VALIDEES.premiumMaxParMetierVille;
    expect(part).toBeGreaterThanOrEqual(1 / 3);
  });

  it('ne propose jamais une demande à plus de 3 pros, ni après 72 heures', () => {
    expect(REGLES_VALIDEES.prosMaxParDemande).toBe(3);
    expect(REGLES_VALIDEES.heuresFraicheurDemande).toBe(72);
  });

  it('tient l’acceptation pour définitive et le refus pour gratuit et motivé', () => {
    expect(REGLES_VALIDEES.acceptationDefinitive).toBe(true);
    expect(REGLES_VALIDEES.motifRefusObligatoire).toBe(true);
  });

  it('n’ouvre aucun espace client et ne montre aucun contenu de référencement', () => {
    expect(REGLES_VALIDEES.espaceClient).toBe(false);
    expect(REGLES_VALIDEES.contenuSeoVisible).toBe(false);
  });

  it('fixe la garantie Exclusif à moins de 5 demandes sur 3 mois, fiche complète et 80 % de réponse', () => {
    expect(REGLES_VALIDEES.garantieExclusif).toEqual({
      moisConsecutifs: 3,
      demandesMinimum: 5,
      tauxReponseMinimum: 0.8,
      ficheCompleteRequise: true,
    });
  });

  it('annonce 18 univers, 69 métiers et 479 prestations', () => {
    expect(REGLES_VALIDEES.catalogueAnnonce).toEqual({
      univers: 18,
      metiers: 69,
      prestations: 479,
    });
  });

  it('ordonne les formules de la moins à la plus engageante', () => {
    expect(FORMULES).toEqual(['gratuit', 'essentiel', 'premium', 'exclusif']);
    expect(RANG_FORMULE.gratuit).toBeLessThan(RANG_FORMULE.essentiel);
    expect(RANG_FORMULE.essentiel).toBeLessThan(RANG_FORMULE.premium);
    expect(RANG_FORMULE.premium).toBeLessThan(RANG_FORMULE.exclusif);
  });
});

describe('paramètres', () => {
  it('reprend les valeurs validées comme valeurs par défaut', () => {
    expect(PARAMETRES_PAR_DEFAUT.prixMensuelHT).toBe(REGLES_VALIDEES.prixMensuelHT);
    expect(PARAMETRES_PAR_DEFAUT.demandesIncluses).toBe(REGLES_VALIDEES.demandesIncluses);
    expect(PARAMETRES_PAR_DEFAUT.prosMaxParDemande).toBe(REGLES_VALIDEES.prosMaxParDemande);
  });

  it('pondère le score à 30, 25, 20, 15 et 10 %, pour une somme de 1', () => {
    expect(PARAMETRES_PAR_DEFAUT.poidsScore).toEqual({
      avis: 0.3,
      activite: 0.25,
      pertinence: 0.2,
      reactivite: 0.15,
      fraicheur: 0.1,
    });
    expect(sommePoidsScore(PARAMETRES_PAR_DEFAUT.poidsScore)).toBeCloseTo(1, 10);
  });

  it('fixe les délais de la cascade à 30 minutes, 2 heures et 72 heures', () => {
    expect(PARAMETRES_PAR_DEFAUT.minutesExclusiviteExclusif).toBe(30);
    expect(PARAMETRES_PAR_DEFAUT.minutesReponseAutresPros).toBe(120);
    expect(PARAMETRES_PAR_DEFAUT.heuresFraicheurDemande).toBe(72);
  });

  it('fixe la note minimale à 3,5 et l’alerte de forfait à 80 %', () => {
    expect(PARAMETRES_PAR_DEFAUT.noteMinimale).toBe(3.5);
    expect(PARAMETRES_PAR_DEFAUT.seuilAlerteForfait).toBe(0.8);
  });

  it('laisse 7 jours pour contester et 48 heures pour trancher (QUESTIONS.md Q6)', () => {
    expect(PARAMETRES_PAR_DEFAUT.joursContestation).toBe(7);
    expect(PARAMETRES_PAR_DEFAUT.heuresTraitementContestation).toBe(48);
  });

  it('fait remonter les Premium en l’absence d’Exclusif (QUESTIONS.md Q2)', () => {
    expect(PARAMETRES_PAR_DEFAUT.premiumRemontentSansExclusif).toBe(true);
  });

  it('se laisse surcharger sans modifier les valeurs par défaut', () => {
    const modifie = avecParametres({ noteMinimale: 4 });
    expect(modifie.noteMinimale).toBe(4);
    expect(modifie.minutesExclusiviteExclusif).toBe(30);
    expect(PARAMETRES_PAR_DEFAUT.noteMinimale).toBe(3.5);
  });
});
