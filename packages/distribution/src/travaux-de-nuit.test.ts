import { describe, expect, it } from 'vitest';
import { estUnTravailDeNuit, executeTravailDeNuit, TRAVAUX_DE_NUIT } from './travaux-de-nuit.ts';

describe('travaux de nuit', () => {
  it('connaît les travaux planifiés, et eux seuls', () => {
    // La liste est écrite en entier plutôt que comptée : un travail ajouté sans planification
    // dans le worker ne tournerait jamais, et un travail retiré du worker sans l'être d'ici
    // ne se verrait pas. L'énumération oblige à passer par les deux.
    expect(Object.keys(TRAVAUX_DE_NUIT).sort()).toEqual([
      'confirmations-intervention',
      'expedition',
      'invitations-avis',
      'peremption',
      'rappels-rendez-vous',
      'relances-rendez-vous',
      'scores',
    ]);
  });

  it('reconnaît un nom connu', () => {
    for (const nom of Object.keys(TRAVAUX_DE_NUIT)) {
      expect(estUnTravailDeNuit(nom)).toBe(true);
    }
  });

  it.each(['score', 'Scores', 'invitations_avis', ''])('refuse « %s »', (nom) => {
    expect(estUnTravailDeNuit(nom)).toBe(false);
  });

  it('lève sur un nom inconnu, en disant lesquels existent', async () => {
    // Une planification mal orthographiée ne doit pas passer six mois sans rien faire.
    await expect(executeTravailDeNuit('peremtion')).rejects.toThrow(/peremtion/);
    await expect(executeTravailDeNuit('peremtion')).rejects.toThrow(/peremption/);
  });

  it('ne se laisse pas tromper par une propriété héritée d’Object', () => {
    expect(estUnTravailDeNuit('toString')).toBe(false);
    expect(estUnTravailDeNuit('constructor')).toBe(false);
  });
});
