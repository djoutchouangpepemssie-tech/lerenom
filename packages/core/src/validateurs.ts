/**
 * Contrôles de validité : SIRET, IBAN.
 *
 * Ces contrôles ne remplacent pas la vérification réelle (SIRENE pour le SIRET, le réseau
 * bancaire pour l'IBAN) : ils rejettent tout de suite une saisie qui ne peut pas être correcte,
 * avant d'appeler un service externe. Pour le RIB, c'est aussi une première barrière contre la
 * fraude au changement de coordonnées bancaires — la seconde étant le code SMS obligatoire.
 */

/**
 * Clé de Luhn du SIRET : 14 chiffres, somme pondérée divisible par 10.
 *
 * Exception documentée par l'Insee : La Poste (SIREN 356000000) ne respecte pas la clé de Luhn.
 * Pour ses établissements, la somme des chiffres doit être un multiple de 5.
 *
 * La clé de Luhn seule ne suffit pas : `00000000000000` la satisfait, puisque la somme vaut
 * zéro. Or l'Insee n'attribue pas le SIREN `000000000`, et c'est précisément la saisie que
 * produit quelqu'un qui veut passer l'étape sans donner son numéro. On la refuse donc
 * explicitement, de même qu'un numéro d'établissement nul.
 */
export function siretValide(siret: string): boolean {
  const chiffres = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(chiffres)) return false;
  if (chiffres.slice(0, 9) === '000000000' || chiffres.slice(9) === '00000') return false;

  if (chiffres.startsWith('356000000')) {
    const somme = [...chiffres].reduce((s, c) => s + Number(c), 0);
    return somme % 5 === 0;
  }

  return luhn(chiffres);
}

/** Clé de Luhn du SIREN : 9 chiffres. `000000000` n'est pas attribué. */
export function sirenValide(siren: string): boolean {
  const chiffres = siren.replace(/\s/g, '');
  if (!/^\d{9}$/.test(chiffres)) return false;
  if (chiffres === '000000000') return false;
  if (chiffres === '356000000') return true;
  return luhn(chiffres);
}

function luhn(chiffres: string): boolean {
  let somme = 0;
  // On double un chiffre sur deux en partant de la droite.
  for (let i = chiffres.length - 1; i >= 0; i -= 1) {
    let n = Number(chiffres[i]);
    const position = chiffres.length - i;
    if (position % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

/** Longueur officielle d'un IBAN par pays, pour les pays où Le Renom encaisse. */
const LONGUEURS_IBAN: Readonly<Record<string, number>> = Object.freeze({
  FR: 27,
  MC: 27,
  BE: 16,
  LU: 20,
  DE: 22,
  ES: 24,
  IT: 27,
  PT: 25,
  NL: 18,
  CH: 21,
  GB: 22,
  IE: 22,
  AT: 20,
});

/**
 * Validité d'un IBAN : longueur attendue pour le pays, puis clé de contrôle modulo 97.
 * Le reste de la division du nombre réarrangé par 97 doit valoir 1 (norme ISO 13616).
 */
export function ibanValide(iban: string): boolean {
  const propre = iban.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(propre)) return false;

  const pays = propre.slice(0, 2);
  const longueurAttendue = LONGUEURS_IBAN[pays];
  if (longueurAttendue !== undefined && propre.length !== longueurAttendue) return false;
  if (propre.length < 15 || propre.length > 34) return false;

  // Les 4 premiers caractères passent à la fin, les lettres deviennent des nombres (A=10…Z=35).
  const rearrange = propre.slice(4) + propre.slice(0, 4);
  let reste = 0;
  for (const caractere of rearrange) {
    const valeur = /\d/.test(caractere)
      ? caractere
      : String(caractere.charCodeAt(0) - 'A'.charCodeAt(0) + 10);
    for (const chiffre of valeur) {
      reste = (reste * 10 + Number(chiffre)) % 97;
    }
  }
  return reste === 1;
}

/** IBAN formaté par groupes de 4, comme sur un relevé bancaire. */
export function formateIban(iban: string): string {
  const propre = iban.replace(/[\s-]/g, '').toUpperCase();
  return (propre.match(/.{1,4}/g) ?? []).join(' ');
}

/**
 * IBAN partiellement masqué, pour l'affichage à l'écran et sur la page de paiement du client :
 * le pays, la clé et les quatre derniers caractères restent lisibles, le reste est masqué.
 */
export function masqueIban(iban: string): string {
  const propre = iban.replace(/[\s-]/g, '').toUpperCase();
  if (propre.length < 8) return '••••';
  const debut = propre.slice(0, 4);
  const fin = propre.slice(-4);
  const masque = '•'.repeat(Math.max(0, propre.length - 8));
  return (`${debut}${masque}${fin}`.match(/.{1,4}/g) ?? []).join(' ');
}

/** Un mobile français, au format national ou international. */
export function mobileFrancaisValide(numero: string): boolean {
  const propre = numero.replace(/[\s.\-()]/g, '');
  return /^(?:(?:\+|00)33|0)[67]\d{8}$/.test(propre);
}

/** Normalise un mobile français au format E.164 (+33…), celui attendu par l'envoi de SMS. */
export function normaliseMobileFrancais(numero: string): string | null {
  const propre = numero.replace(/[\s.\-()]/g, '');
  if (!mobileFrancaisValide(propre)) return null;
  const sansPrefixe = propre.replace(/^(?:\+33|0033|0)/, '');
  return `+33${sansPrefixe}`;
}
