import { describe, expect, it } from 'vitest';
import {
  apresRecredit,
  coutAcceptation,
  etatForfait,
  formatEuros,
  peutRecevoirDemandePartagee,
} from './quotas.ts';
import { PARAMETRES_PAR_DEFAUT } from './parametres.ts';

const P = PARAMETRES_PAR_DEFAUT;

describe('etatForfait', () => {
  it('décompte les 5 demandes du Premium', () => {
    const etat = etatForfait('premium', 2, P);
    expect(etat.incluses).toBe(5);
    expect(etat.consommees).toBe(2);
    expect(etat.restantes).toBe(3);
    expect(etat.part).toBeCloseTo(0.4, 10);
    expect(etat.epuise).toBe(false);
    expect(etat.alerte).toBe(false);
  });

  it('alerte à 80 % du forfait, pas avant', () => {
    expect(etatForfait('premium', 3, P).alerte).toBe(false); // 60 %
    expect(etatForfait('premium', 4, P).alerte).toBe(true); // 80 %
    expect(etatForfait('exclusif', 11, P).alerte).toBe(false); // 73 %
    expect(etatForfait('exclusif', 12, P).alerte).toBe(true); // 80 %
  });

  it('marque épuisé à 100 % et ne descend jamais sous zéro', () => {
    const etat = etatForfait('premium', 9, P);
    expect(etat.restantes).toBe(0);
    expect(etat.epuise).toBe(true);
    expect(etat.part).toBe(1);
  });

  it('considère Gratuit et Essentiel comme sans forfait, donc toujours épuisés', () => {
    for (const formule of ['gratuit', 'essentiel'] as const) {
      const etat = etatForfait(formule, 0, P);
      expect(etat.incluses).toBe(0);
      expect(etat.epuise).toBe(true);
      expect(etat.alerte).toBe(false); // on n'alerte pas sur un forfait qui n'existe pas
    }
  });

  it('ignore un compteur négatif', () => {
    expect(etatForfait('premium', -4, P).consommees).toBe(0);
  });
});

describe('coutAcceptation', () => {
  it('ne facture rien et ne décompte rien sur une demande directe', () => {
    const cout = coutAcceptation('gratuit', 'directe', 0, P);
    expect(cout).toEqual({
      montantHT: 0,
      consommeForfait: false,
      libelleBouton: 'Accepter — incluse',
    });
  });

  it('prend la demande partagée sur le forfait tant qu’il en reste', () => {
    const cout = coutAcceptation('premium', 'partagee', 2, P);
    expect(cout?.montantHT).toBe(0);
    expect(cout?.consommeForfait).toBe(true);
    expect(cout?.libelleBouton).toContain('3 sur 5 restantes');
  });

  it('facture 12 € au Premium une fois son forfait épuisé, sans décompter', () => {
    const cout = coutAcceptation('premium', 'partagee', 5, P);
    expect(cout?.montantHT).toBe(12);
    expect(cout?.consommeForfait).toBe(false);
    expect(cout?.libelleBouton).toBe('Accepter — 12\u00a0€');
  });

  it('facture 9 € à l’Exclusif au-delà de ses 15 demandes', () => {
    expect(coutAcceptation('exclusif', 'partagee', 15, P)?.montantHT).toBe(9);
    expect(coutAcceptation('exclusif', 'partagee', 14, P)?.montantHT).toBe(0);
  });

  it('facture 15 € la demande partagée à un pro sans abonnement', () => {
    expect(coutAcceptation('gratuit', 'partagee', 0, P)?.montantHT).toBe(15);
    expect(coutAcceptation('essentiel', 'partagee', 0, P)?.montantHT).toBe(15);
  });

  it('facture l’urgence à part et ne consomme jamais le forfait', () => {
    const premium = coutAcceptation('premium', 'urgente', 0, P);
    expect(premium?.montantHT).toBe(20);
    expect(premium?.consommeForfait).toBe(false);
    expect(premium?.libelleBouton).toContain('hors forfait');

    // Même avec du forfait disponible, l'urgence se paie.
    expect(coutAcceptation('exclusif', 'urgente', 0, P)?.montantHT).toBe(15);
    expect(coutAcceptation('essentiel', 'urgente', 0, P)?.montantHT).toBe(25);
  });

  it('ne propose jamais d’urgence à une fiche gratuite', () => {
    expect(coutAcceptation('gratuit', 'urgente', 0, P)).toBeNull();
  });
});

describe('peutRecevoirDemandePartagee', () => {
  const sansRecharge = { rechargeAutomatique: false, plafondMensuelHT: null, depenseCeMoisHT: 0 };

  it('accepte tant qu’il reste du forfait', () => {
    expect(peutRecevoirDemandePartagee('premium', 3, sansRecharge, P)).toBe(true);
  });

  it('refuse au forfait épuisé sans recharge automatique : on ne facture pas sans accord', () => {
    expect(peutRecevoirDemandePartagee('premium', 5, sansRecharge, P)).toBe(false);
    expect(peutRecevoirDemandePartagee('gratuit', 0, sansRecharge, P)).toBe(false);
  });

  it('accepte avec recharge automatique et sans plafond', () => {
    expect(
      peutRecevoirDemandePartagee(
        'premium',
        5,
        { rechargeAutomatique: true, plafondMensuelHT: null, depenseCeMoisHT: 500 },
        P,
      ),
    ).toBe(true);
  });

  it('respecte le plafond de dépense mensuel, à l’euro près', () => {
    const reglages = { rechargeAutomatique: true, plafondMensuelHT: 60, depenseCeMoisHT: 48 };
    // 48 + 12 = 60 : exactement le plafond, encore accepté.
    expect(peutRecevoirDemandePartagee('premium', 5, reglages, P)).toBe(true);
    // 49 + 12 = 61 : au-dessus, refusé.
    expect(peutRecevoirDemandePartagee('premium', 5, { ...reglages, depenseCeMoisHT: 49 }, P)).toBe(
      false,
    );
  });
});

describe('apresRecredit', () => {
  it('rend une unité au forfait du mois en cours', () => {
    expect(apresRecredit(5)).toBe(4);
  });

  it('ne descend pas sous zéro', () => {
    expect(apresRecredit(0)).toBe(0);
  });
});

describe('formatEuros', () => {
  // Insécable et non fine insécable : la fine ne se voit pas dans la police du site (1,6 px
  // contre 3,2 px, mesuré). Voir le commentaire dans `quotas.ts`.
  const INSECABLE = '\u00a0';

  it('écrit un entier sans décimale', () => {
    expect(formatEuros(12)).toBe(`12${INSECABLE}€`);
    expect(formatEuros(0)).toBe(`0${INSECABLE}€`);
  });

  it('écrit deux décimales avec une virgule', () => {
    expect(formatEuros(94.8)).toBe(`94,80${INSECABLE}€`);
  });

  it('sépare les milliers par une espace fine insécable', () => {
    // Sur une facture, « 1122 € » se lit mal et « 1 122 » coupé en fin de ligne encore moins.
    expect(formatEuros(1122)).toBe(`1${INSECABLE}122${INSECABLE}€`);
    expect(formatEuros(1234567)).toBe(`1${INSECABLE}234${INSECABLE}567${INSECABLE}€`);
  });

  it('groupe aussi devant les décimales', () => {
    expect(formatEuros(1122.5)).toBe(`1${INSECABLE}122,50${INSECABLE}€`);
  });

  it('ne groupe pas en dessous de mille', () => {
    expect(formatEuros(999)).toBe(`999${INSECABLE}€`);
  });

  it('écrit un montant négatif avec un vrai signe moins', () => {
    // Le trait d'union n'est pas un signe moins : sur un avoir, la différence se voit.
    expect(formatEuros(-50)).toBe(`−50${INSECABLE}€`);
  });

  it('n’utilise jamais d’espace sécable', () => {
    for (const montant of [1122, 1122.5, -1122]) {
      expect(formatEuros(montant)).not.toContain(' ');
    }
  });
});
