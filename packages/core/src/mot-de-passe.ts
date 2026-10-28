/**
 * Les règles d'un mot de passe professionnel.
 *
 * Le parti pris suit les recommandations de la CNIL et de l'ANSSI plutôt que les habitudes des
 * années 2000 : **la longueur prime sur la complexité**. Imposer une majuscule, un chiffre et
 * un caractère spécial produit `Password1!` — court, prévisible, et noté « fort » par la
 * plupart des formulaires. Une phrase de passe de vingt caractères vaut infiniment mieux.
 *
 * On refuse donc peu de choses, mais on les refuse fermement : trop court, trop répétitif, ou
 * figurant dans la liste des mots de passe que tout le monde essaie en premier.
 */

/** Douze caractères minimum, sans exigence de composition : c'est la recommandation CNIL. */
export const LONGUEUR_MOT_DE_PASSE_MINIMALE = 12;
/** Au-delà, c'est une phrase, et le hachage coûterait cher pour rien. */
export const LONGUEUR_MOT_DE_PASSE_MAXIMALE = 200;

/**
 * Les mots de passe les plus essayés, en français et en anglais.
 *
 * La liste est courte à dessein : elle n'est pas une défense, elle est un garde-fou contre
 * l'évidence. La vraie défense est la limitation des tentatives de connexion.
 */
const COURANTS = new Set([
  'motdepasse',
  'motdepasse1',
  'azertyuiop',
  'qwertyuiop',
  'password',
  'password1',
  'password123',
  '123456789012',
  'administrateur',
  'bonjour12345',
  'lerenom12345',
  'jesuislemeilleur',
]);

export type FaiblesseMotDePasse =
  'trop-court' | 'trop-long' | 'trop-repetitif' | 'trop-courant' | 'contient-l-email';

/**
 * Relève les faiblesses d'un mot de passe. Toutes d'un coup : on ne corrige pas au
 * compte-gouttes quelqu'un qui essaie de se protéger.
 */
export function faiblessesMotDePasse(
  motDePasse: string,
  email?: string,
): readonly FaiblesseMotDePasse[] {
  const faiblesses: FaiblesseMotDePasse[] = [];

  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MINIMALE) faiblesses.push('trop-court');
  if (motDePasse.length > LONGUEUR_MOT_DE_PASSE_MAXIMALE) faiblesses.push('trop-long');

  const normalise = motDePasse.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  if (COURANTS.has(normalise)) faiblesses.push('trop-courant');

  // Trois caractères distincts ou moins : « aaaaaaaaaaaa », « ababababab ».
  if (motDePasse.length > 0 && new Set(motDePasse).size <= 3) faiblesses.push('trop-repetitif');

  if (email !== undefined) {
    const identifiant = email.split('@')[0]?.toLowerCase() ?? '';
    if (identifiant.length >= 4 && normalise.includes(identifiant)) {
      faiblesses.push('contient-l-email');
    }
  }

  return faiblesses;
}

/** Le message à montrer, dans la langue du professionnel. */
export const MESSAGES_FAIBLESSE: Readonly<Record<FaiblesseMotDePasse, string>> = Object.freeze({
  'trop-court': `Au moins ${String(LONGUEUR_MOT_DE_PASSE_MINIMALE)} caractères. Une phrase que vous seul connaissez vaut mieux qu’un mot compliqué.`,
  'trop-long': `Pas plus de ${String(LONGUEUR_MOT_DE_PASSE_MAXIMALE)} caractères.`,
  'trop-repetitif': 'Ce mot de passe ne contient presque aucun caractère différent.',
  'trop-courant': 'Ce mot de passe figure parmi les plus essayés : choisissez-en un autre.',
  'contient-l-email': 'Votre mot de passe ne doit pas contenir votre adresse électronique.',
});
