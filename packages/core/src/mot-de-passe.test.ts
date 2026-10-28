import { describe, expect, it } from 'vitest';
import {
  faiblessesMotDePasse,
  LONGUEUR_MOT_DE_PASSE_MAXIMALE,
  LONGUEUR_MOT_DE_PASSE_MINIMALE,
  MESSAGES_FAIBLESSE,
  type FaiblesseMotDePasse,
} from './mot-de-passe.ts';

describe('faiblessesMotDePasse', () => {
  it('accepte une phrase de passe ordinaire, sans exiger de caractère spécial', () => {
    expect(faiblessesMotDePasse('le chat dort sur le toit')).toEqual([]);
    expect(faiblessesMotDePasse('plomberiemartin2026')).toEqual([]);
  });

  it('refuse un mot de passe trop court, même très compliqué', () => {
    // C'est tout l'intérêt de la règle : « Xy7!z » est court, donc faible.
    expect(faiblessesMotDePasse('Xy7!zQ#2')).toEqual(['trop-court']);
  });

  it('refuse au-delà de la longueur maximale', () => {
    expect(faiblessesMotDePasse('a'.repeat(LONGUEUR_MOT_DE_PASSE_MAXIMALE + 1))).toContain(
      'trop-long',
    );
  });

  it('accepte exactement la longueur minimale', () => {
    expect(faiblessesMotDePasse('abcdefghijkl')).toEqual([]);
    expect('abcdefghijkl').toHaveLength(LONGUEUR_MOT_DE_PASSE_MINIMALE);
  });

  it('refuse un mot de passe quasiment sans caractères différents', () => {
    expect(faiblessesMotDePasse('aaaaaaaaaaaaaa')).toContain('trop-repetitif');
    expect(faiblessesMotDePasse('ababababababab')).toContain('trop-repetitif');
  });

  it('refuse les mots de passe que tout le monde essaie en premier', () => {
    expect(faiblessesMotDePasse('motdepasse1')).toContain('trop-courant');
    expect(faiblessesMotDePasse('AZERTYUIOP')).toContain('trop-courant');
    expect(faiblessesMotDePasse('lerenom12345')).toContain('trop-courant');
  });

  it('refuse un mot de passe bâti sur l’adresse électronique', () => {
    expect(faiblessesMotDePasse('martin-plomberie-2026', 'martin@exemple.fr')).toContain(
      'contient-l-email',
    );
  });

  it('ne se trompe pas sur un identifiant très court', () => {
    // « jp@… » ne doit pas disqualifier tout mot de passe contenant « jp ».
    expect(faiblessesMotDePasse('le toit de la maison jp', 'jp@exemple.fr')).toEqual([]);
  });

  it('rend toutes les faiblesses d’un coup', () => {
    const faiblesses = faiblessesMotDePasse('aaaa', 'aaaa@exemple.fr');
    expect(faiblesses).toContain('trop-court');
    expect(faiblesses).toContain('trop-repetitif');
    expect(faiblesses).toContain('contient-l-email');
  });

  it('a un message pour chaque faiblesse : aucun refus muet', () => {
    const toutes: FaiblesseMotDePasse[] = [
      'trop-court',
      'trop-long',
      'trop-repetitif',
      'trop-courant',
      'contient-l-email',
    ];
    for (const faiblesse of toutes) {
      expect(MESSAGES_FAIBLESSE[faiblesse].length).toBeGreaterThan(10);
    }
  });
});
