import { describe, expect, it } from 'vitest';
import {
  caviarde,
  COMMENTAIRE_MAX,
  COMMENTAIRE_MIN,
  confirmationInterventionDue,
  CRITERES_AVIS,
  droitDeDeposerUnAvis,
  invitationAvisDue,
  moyenneDesCriteres,
  signauxDeModeration,
  valideAvis,
  type EtatAvis,
  type EtatConfirmation,
} from './avis.ts';

const MAINTENANT = new Date('2026-10-28T10:00:00Z');
const TRAVAUX = new Date('2026-10-01T10:00:00Z');

function etat(partiel: Partial<EtatAvis> = {}): EtatAvis {
  return {
    travauxRealisesLe: TRAVAUX,
    avisDejaDepose: false,
    demandeAnnuleeLe: null,
    ...partiel,
  };
}

describe('droitDeDeposerUnAvis', () => {
  it('autorise après des travaux déclarés réalisés', () => {
    expect(droitDeDeposerUnAvis(etat())).toEqual({ issue: 'peut-deposer' });
  });

  it('refuse tant que les travaux ne sont pas déclarés réalisés', () => {
    expect(droitDeDeposerUnAvis(etat({ travauxRealisesLe: null }))).toEqual({
      issue: 'travaux-non-realises',
    });
  });

  it('refuse un second avis : une demande, un avis', () => {
    expect(droitDeDeposerUnAvis(etat({ avisDejaDepose: true }))).toEqual({ issue: 'deja-depose' });
  });

  it('refuse sur une demande annulée, avant tout le reste', () => {
    const annulee = etat({ demandeAnnuleeLe: MAINTENANT, avisDejaDepose: true });
    expect(droitDeDeposerUnAvis(annulee)).toEqual({ issue: 'demande-annulee' });
  });

  it('n’impose aucun délai au client : content le jour même, il peut écrire', () => {
    const aujourdhui = etat({ travauxRealisesLe: MAINTENANT });
    expect(droitDeDeposerUnAvis(aujourdhui)).toEqual({ issue: 'peut-deposer' });
  });
});

describe('invitationAvisDue', () => {
  it('part quinze jours après les travaux, comme l’annonce la charte', () => {
    expect(invitationAvisDue(TRAVAUX, false, 15, new Date('2026-10-16T10:00:00Z'))).toBe(true);
    expect(invitationAvisDue(TRAVAUX, false, 15, new Date('2026-10-15T23:59:00Z'))).toBe(false);
  });

  it('ne part jamais deux fois', () => {
    expect(invitationAvisDue(TRAVAUX, true, 15, MAINTENANT)).toBe(false);
  });

  it('suit le paramètre, pas une constante écrite dans le code', () => {
    expect(invitationAvisDue(TRAVAUX, false, 30, new Date('2026-10-20T10:00:00Z'))).toBe(false);
    expect(invitationAvisDue(TRAVAUX, false, 1, new Date('2026-10-02T11:00:00Z'))).toBe(true);
  });
});

describe('valideAvis', () => {
  it('accepte une note seule, sans commentaire', () => {
    expect(valideAvis({ note: 4 })).toEqual([]);
  });

  it.each([0, 6, -1, 42])('refuse la note %s', (note) => {
    expect(valideAvis({ note })).toContain('note-hors-bornes');
  });

  it('refuse une note à virgule : on note par étoiles entières', () => {
    expect(valideAvis({ note: 4.5 })).toEqual(['note-non-entiere']);
  });

  it('refuse un critère hors bornes, une seule fois', () => {
    const erreurs = valideAvis({ note: 4, criteres: { qualite: 9, delai: 0 } });
    expect(erreurs).toEqual(['critere-hors-bornes']);
  });

  it('refuse un commentaire trop court, mais accepte l’absence de commentaire', () => {
    expect(valideAvis({ note: 5, commentaire: 'bien' })).toEqual(['commentaire-trop-court']);
    expect(valideAvis({ note: 5, commentaire: '   ' })).toEqual([]);
    expect(valideAvis({ note: 5, commentaire: 'a'.repeat(COMMENTAIRE_MIN) })).toEqual([]);
  });

  it('refuse un commentaire trop long', () => {
    expect(valideAvis({ note: 5, commentaire: 'a'.repeat(COMMENTAIRE_MAX + 1) })).toEqual([
      'commentaire-trop-long',
    ]);
  });

  it('rend toutes les erreurs ensemble', () => {
    const erreurs = valideAvis({ note: 9, criteres: { prix: 0 }, commentaire: 'non' });
    expect(erreurs).toContain('note-hors-bornes');
    expect(erreurs).toContain('critere-hors-bornes');
    expect(erreurs).toContain('commentaire-trop-court');
  });
});

describe('signauxDeModeration', () => {
  it('ne signale rien sur un avis ordinaire, même sévère', () => {
    expect(
      signauxDeModeration(
        'Travail bâclé, le joint fuit toujours et il a fallu rappeler deux fois. Je ne recommande pas.',
      ),
    ).toEqual([]);
  });

  it('repère un numéro de téléphone, quelle que soit sa ponctuation', () => {
    expect(signauxDeModeration('Appelez-moi au 06 12 34 56 78')).toContain(
      'coordonnees-telephoniques',
    );
    expect(signauxDeModeration('mon numéro : 0612345678')).toContain('coordonnees-telephoniques');
    expect(signauxDeModeration('joignable au +33 6 12 34 56 78')).toContain(
      'coordonnees-telephoniques',
    );
  });

  it('repère une adresse électronique et un lien', () => {
    expect(signauxDeModeration('écrivez à jean@exemple.fr')).toContain('adresse-electronique');
    expect(signauxDeModeration('voir https://exemple.fr/preuve')).toContain('lien-externe');
    expect(signauxDeModeration('allez sur www.exemple.fr')).toContain('lien-externe');
  });

  it('repère une injure probable', () => {
    expect(signauxDeModeration('Ce plombier est un abruti fini.')).toContain('injure-possible');
  });

  it('ne confond pas une injure avec un mot qui la contient', () => {
    expect(signauxDeModeration('La pose du carrelage est impeccable, vraiment.')).toEqual([]);
  });

  it('repère un texte tout en capitales, au-delà d’une longueur significative', () => {
    expect(signauxDeModeration('TRAVAIL ABSOLUMENT LAMENTABLE DU DEBUT A LA FIN')).toContain(
      'cris',
    );
    expect(signauxDeModeration('TRÈS BIEN')).not.toContain('cris');
  });

  it('repère une accusation grave, qui engage la plateforme si elle est fausse', () => {
    expect(signauxDeModeration('C’est une arnaque pure et simple.')).toContain('accusation-grave');
    expect(signauxDeModeration('Il m’a volé 400 euros.')).toContain('accusation-grave');
  });

  it('ne signale rien sur un commentaire vide', () => {
    expect(signauxDeModeration('   ')).toEqual([]);
  });
});

describe('moyenneDesCriteres', () => {
  it('fait la moyenne des critères renseignés', () => {
    expect(moyenneDesCriteres({ qualite: 5, delai: 4, proprete: 3, prix: 4 })).toBe(4);
  });

  it('ignore les critères absents', () => {
    expect(moyenneDesCriteres({ qualite: 5, delai: 3 })).toBe(4);
  });

  it('rend null quand rien n’est renseigné', () => {
    expect(moyenneDesCriteres(undefined)).toBeNull();
    expect(moyenneDesCriteres({})).toBeNull();
  });
});

describe('CRITERES_AVIS', () => {
  it('couvre les quatre critères annoncés, sans doublon', () => {
    expect(CRITERES_AVIS).toHaveLength(4);
    expect(new Set(CRITERES_AVIS.map((c) => c.cle)).size).toBe(4);
  });
});

describe('confirmationInterventionDue', () => {
  const REGLES = {
    joursConfirmationIntervention: 7,
    joursEntreRelancesConfirmation: 7,
    relancesConfirmationMax: 2,
  };

  function confirmation(partiel: Partial<EtatConfirmation> = {}): EtatConfirmation {
    return {
      accepteeLe: new Date('2026-10-01T10:00:00Z'),
      travauxDejaDeclares: false,
      demandeAnnuleeLe: null,
      relancesEnvoyees: 0,
      derniereRelanceLe: null,
      ...partiel,
    };
  }

  it('attend le délai avant de poser la question', () => {
    expect(
      confirmationInterventionDue(confirmation(), REGLES, new Date('2026-10-07T09:00:00Z')),
    ).toBe(false);
    expect(
      confirmationInterventionDue(confirmation(), REGLES, new Date('2026-10-08T11:00:00Z')),
    ).toBe(true);
  });

  it('ne demande rien quand les travaux sont déjà déclarés', () => {
    const declares = confirmation({ travauxDejaDeclares: true });
    expect(confirmationInterventionDue(declares, REGLES, new Date('2026-11-01T10:00:00Z'))).toBe(
      false,
    );
  });

  it('ne demande rien sur une demande annulée', () => {
    const annulee = confirmation({ demandeAnnuleeLe: new Date('2026-10-03T10:00:00Z') });
    expect(confirmationInterventionDue(annulee, REGLES, new Date('2026-11-01T10:00:00Z'))).toBe(
      false,
    );
  });

  it('espace les relances', () => {
    const relance = confirmation({
      relancesEnvoyees: 1,
      derniereRelanceLe: new Date('2026-10-08T10:00:00Z'),
    });
    expect(confirmationInterventionDue(relance, REGLES, new Date('2026-10-14T10:00:00Z'))).toBe(
      false,
    );
    expect(confirmationInterventionDue(relance, REGLES, new Date('2026-10-15T11:00:00Z'))).toBe(
      true,
    );
  });

  it('s’arrête après le nombre de relances autorisé : on interroge, on ne harcèle pas', () => {
    const epuise = confirmation({
      relancesEnvoyees: REGLES.relancesConfirmationMax + 1,
      derniereRelanceLe: new Date('2026-10-22T10:00:00Z'),
    });
    expect(confirmationInterventionDue(epuise, REGLES, new Date('2026-12-01T10:00:00Z'))).toBe(
      false,
    );
  });

  it('autorise exactement une question et deux relances', () => {
    const jour = 24 * 3_600_000;
    const depart = new Date('2026-10-01T10:00:00Z');
    let etat = confirmation();
    const envois: Date[] = [];

    for (let j = 0; j <= 40; j += 1) {
      const jourJ = new Date(depart.getTime() + j * jour);
      if (confirmationInterventionDue(etat, REGLES, jourJ)) {
        envois.push(jourJ);
        etat = { ...etat, relancesEnvoyees: etat.relancesEnvoyees + 1, derniereRelanceLe: jourJ };
      }
    }

    expect(envois).toHaveLength(3);
  });
});

describe('caviarde', () => {
  it('retire un numéro de téléphone en le disant', () => {
    const resultat = caviarde('Très bien, rappelez-moi au 06 12 34 56 78 si besoin.');
    expect(resultat.texte).toBe('Très bien, rappelez-moi au [numéro retiré] si besoin.');
    expect(resultat.retraits).toEqual(['telephone']);
  });

  it('retire une adresse électronique et un lien', () => {
    const resultat = caviarde('Écrivez à jean@exemple.fr ou voyez https://exemple.fr/preuve');
    expect(resultat.texte).toContain('[adresse retirée]');
    expect(resultat.texte).toContain('[lien retiré]');
    expect(resultat.retraits).toContain('email');
    expect(resultat.retraits).toContain('lien');
  });

  it('ne confond pas l’adresse électronique avec le lien qui la suit', () => {
    const resultat = caviarde('jean@exemple.fr et www.exemple.fr');
    expect(resultat.texte).toBe('[adresse retirée] et [lien retiré]');
  });

  it('retire plusieurs occurrences, pas seulement la première', () => {
    const resultat = caviarde('Au 06 12 34 56 78 ou au 07 98 76 54 32.');
    expect(resultat.texte).toBe('Au [numéro retiré] ou au [numéro retiré].');
    expect(resultat.retraits).toEqual(['telephone']);
  });

  it('laisse intact un avis qui n’a rien à cacher', () => {
    const texte = 'Travail soigné, ponctuel, et le chantier était propre en partant.';
    expect(caviarde(texte)).toEqual({ texte, retraits: [] });
  });

  it('ne laisse pas de double espace derrière un retrait', () => {
    expect(caviarde('Appelez  06 12 34 56 78  vite').texte).toBe('Appelez [numéro retiré] vite');
  });

  it('ne touche pas aux nombres qui ne sont pas des numéros', () => {
    const texte = 'Facture de 1250 euros pour 12 heures de travail en 2026.';
    expect(caviarde(texte).retraits).toEqual([]);
  });

  it('caviarde exactement ce que la modération signale', () => {
    const texte = 'Arnaque ! joignable au 06 12 34 56 78 et sur jean@exemple.fr';
    const signaux = signauxDeModeration(texte);
    const resultat = caviarde(texte);

    expect(signaux).toContain('coordonnees-telephoniques');
    expect(signaux).toContain('adresse-electronique');
    expect([...resultat.retraits].sort()).toEqual(['email', 'telephone']);
    // L'accusation, elle, n'est pas caviardée : ce n'est pas une donnée personnelle, c'est un
    // propos. Il se publie ou se refuse, il ne se réécrit pas.
    expect(resultat.texte).toContain('Arnaque');
  });
});
