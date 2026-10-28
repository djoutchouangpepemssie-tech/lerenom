import { describe, expect, it } from 'vitest';
import { boiteEnglobante, couvre, distanceKm, scoreProximite } from './geo.ts';

const PARIS_11 = { latitude: 48.8594, longitude: 2.3765 };
const MONTREUIL = { latitude: 48.8638, longitude: 2.4485 };
const VERSAILLES = { latitude: 48.8014, longitude: 2.1301 };

describe('distanceKm', () => {
  it('vaut zéro entre un point et lui-même', () => {
    expect(distanceKm(PARIS_11, PARIS_11)).toBe(0);
  });

  it('mesure environ 5,3 km entre Paris 11e et Montreuil', () => {
    // Distance à vol d'oiseau vérifiable sur une carte : 5,2 à 5,4 km.
    expect(distanceKm(PARIS_11, MONTREUIL)).toBeGreaterThan(5);
    expect(distanceKm(PARIS_11, MONTREUIL)).toBeLessThan(5.6);
  });

  it('mesure environ 19 km entre Paris 11e et Versailles', () => {
    expect(distanceKm(PARIS_11, VERSAILLES)).toBeGreaterThan(18);
    expect(distanceKm(PARIS_11, VERSAILLES)).toBeLessThan(20);
  });

  it('est symétrique', () => {
    expect(distanceKm(PARIS_11, VERSAILLES)).toBeCloseTo(distanceKm(VERSAILLES, PARIS_11), 9);
  });

  it('reste juste sur un grand arc (un quart de méridien ≈ 10 007 km)', () => {
    const d = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 90, longitude: 0 });
    expect(d).toBeGreaterThan(10000);
    expect(d).toBeLessThan(10010);
  });
});

describe('boiteEnglobante', () => {
  it('englobe tout le disque : aucun point éligible ne peut être écarté', () => {
    const rayon = 10;
    const boite = boiteEnglobante(PARIS_11, rayon);

    // On teste 36 points sur le cercle : tous doivent tomber dans la boîte.
    for (let angle = 0; angle < 360; angle += 10) {
      const rad = (angle * Math.PI) / 180;
      const dLat = (rayon / 111.32) * Math.cos(rad);
      const dLon =
        (rayon / (111.32 * Math.cos((PARIS_11.latitude * Math.PI) / 180))) * Math.sin(rad);
      const point = { latitude: PARIS_11.latitude + dLat, longitude: PARIS_11.longitude + dLon };

      expect(point.latitude).toBeGreaterThanOrEqual(boite.latitudeMin);
      expect(point.latitude).toBeLessThanOrEqual(boite.latitudeMax);
      expect(point.longitude).toBeGreaterThanOrEqual(boite.longitudeMin);
      expect(point.longitude).toBeLessThanOrEqual(boite.longitudeMax);
    }
  });

  it('ne sort jamais des bornes géographiques', () => {
    const boite = boiteEnglobante({ latitude: 89.9, longitude: 179.9 }, 500);
    expect(boite.latitudeMax).toBeLessThanOrEqual(90);
    expect(boite.longitudeMax).toBeLessThanOrEqual(180);
    expect(boite.latitudeMin).toBeGreaterThanOrEqual(-90);
    expect(boite.longitudeMin).toBeGreaterThanOrEqual(-180);
  });

  it('couvre toute la longitude au pôle, où le parallèle se réduit à un point', () => {
    const boite = boiteEnglobante({ latitude: 90, longitude: 0 }, 10);
    expect(boite.longitudeMin).toBe(-180);
    expect(boite.longitudeMax).toBe(180);
  });
});

describe('couvre', () => {
  it('couvre une adresse dans le rayon', () => {
    expect(couvre(PARIS_11, 10, MONTREUIL)).toBe(true);
  });

  it('ne couvre pas une adresse hors du rayon', () => {
    expect(couvre(PARIS_11, 4, MONTREUIL)).toBe(false);
  });

  it('ne couvre rien avec un rayon nul ou négatif', () => {
    expect(couvre(PARIS_11, 0, PARIS_11)).toBe(false);
    expect(couvre(PARIS_11, -5, PARIS_11)).toBe(false);
  });
});

describe('scoreProximite', () => {
  it('vaut 1 sur place et 0 à la limite du rayon', () => {
    expect(scoreProximite(0, 10)).toBe(1);
    expect(scoreProximite(10, 10)).toBe(0);
    expect(scoreProximite(15, 10)).toBe(0);
  });

  it('décroît linéairement entre les deux', () => {
    expect(scoreProximite(5, 10)).toBeCloseTo(0.5, 10);
    expect(scoreProximite(2.5, 10)).toBeCloseTo(0.75, 10);
  });

  it('vaut 0 si le rayon de référence est nul', () => {
    expect(scoreProximite(1, 0)).toBe(0);
  });
});
