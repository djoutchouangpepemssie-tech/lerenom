/**
 * Le rendu serveur d'un document imprimable.
 *
 * **Le PDF est produit à partir de la page que le professionnel voit déjà.** C'est le choix
 * structurant de ce module, et il a un coût : il faut un navigateur sur le serveur. L'autre
 * voie — redessiner la facture avec une bibliothèque PDF — donnerait un fichier plus léger à
 * produire et deux mises en page à maintenir. Elles divergeraient, et la divergence se
 * verrait le jour où un client comparerait le document reçu à celui qu'il avait à l'écran.
 * Une facture est une pièce qui fait foi ; elle n'a pas deux versions.
 *
 * ## La dépendance au navigateur, dite franchement
 *
 * Ce module ne fonctionne que si un Chromium est installé à côté. En développement, celui de
 * Playwright suffit. **Sur le serveur de production, il n'y en a pas aujourd'hui** : l'image
 * est construite par détection automatique, sans navigateur. La route qui appelle ce module
 * renvoie donc un message explicite plutôt qu'une erreur technique, et le professionnel garde
 * l'impression depuis son navigateur, qui marche.
 *
 * Installer un Chromium dans l'image de production est une décision d'infrastructure — elle
 * triple le poids de l'image et modifie le déploiement d'un site en ligne. Elle n'est pas
 * prise ici.
 */

/** Le chemin d'un Chromium déjà présent, quand l'environnement en fournit un. */
const CHEMIN_CHROMIUM = process.env['CHEMIN_CHROMIUM'];

export class NavigateurAbsent extends Error {
  constructor(cause: unknown) {
    super('Aucun navigateur n’est disponible pour produire le PDF.');
    this.name = 'NavigateurAbsent';
    this.cause = cause;
  }
}

/**
 * Rend une page en PDF A4.
 *
 * Le cookie de session est posé avant la navigation : la page du document est protégée, et un
 * navigateur anonyme n'obtiendrait qu'une redirection vers la connexion — c'est-à-dire un PDF
 * d'une page blanche, parfaitement valide et parfaitement vide.
 *
 * `print` plutôt que `screen` : la feuille de style d'impression existe déjà, elle règle les
 * marges A4, retire la barre d'impression et force les couleurs. Rendre en `screen`
 * produirait un document qui ne ressemble pas à ce que donne l'impression navigateur.
 */
async function lanceChromium() {
  const { chromium } = await import('playwright');
  return chromium.launch({
    ...(CHEMIN_CHROMIUM === undefined ? {} : { executablePath: CHEMIN_CHROMIUM }),
    // Les conteneurs n'accordent pas les privilèges que le bac à sable de Chromium réclame.
    args: ['--no-sandbox'],
  });
}

export async function rendEnPdf(
  adresse: string,
  cookies: readonly { readonly nom: string; readonly valeur: string; readonly domaine: string }[],
): Promise<Uint8Array> {
  // Import dynamique, et non en tête de fichier : Playwright est un outil de développement,
  // absent de l'image de production. Une importation statique ferait échouer la construction
  // du site entier pour une fonction que la plupart des pages n'appellent jamais.
  let navigateur: Awaited<ReturnType<typeof lanceChromium>>;
  try {
    navigateur = await lanceChromium();
  } catch (erreur) {
    throw new NavigateurAbsent(erreur);
  }

  try {
    const contexte = await navigateur.newContext();
    await contexte.addCookies(
      cookies.map((cookie) => ({
        name: cookie.nom,
        value: cookie.valeur,
        domain: cookie.domaine,
        path: '/',
      })),
    );
    const onglet = await contexte.newPage();
    await onglet.goto(adresse, { waitUntil: 'networkidle' });
    await onglet.emulateMedia({ media: 'print' });
    return await onglet.pdf({
      format: 'A4',
      printBackground: true,
      // Les marges sont déjà posées par `@page` dans la feuille d'impression. En ajouter ici
      // les doublerait, et la facture se retrouverait centrée dans un cadre trop étroit.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await navigateur.close();
  }
}
