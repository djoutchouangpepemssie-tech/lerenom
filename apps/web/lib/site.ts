/**
 * L'adresse publique du site.
 *
 * Une seule définition. Elle était écrite en dur (`https://lerenom.fr`) dans les métadonnées
 * de la disposition racine, alors que `LERENOM_URL` existe déjà et désigne, sur chaque
 * environnement, l'adresse réelle. Sur une préproduction, les adresses canoniques annonçaient
 * donc la production : un moteur de recherche y voit deux sites qui se réclament des mêmes
 * pages, et c'est le genre d'erreur dont on paie les conséquences des mois plus tard.
 *
 * La valeur par défaut est `localhost` et non le domaine de production, pour la même raison :
 * mieux vaut une adresse visiblement fausse qu'une adresse plausible et trompeuse.
 */
export function baseDuSite(): string {
  return (process.env['LERENOM_URL'] ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Le site est-il celui qui doit être indexé ?
 *
 * Une préproduction indexée vole son référencement à la production. `LERENOM_ENV` dit
 * lequel est lequel ; en son absence on refuse l'indexation, parce que se tromper dans ce
 * sens-là se répare, et dans l'autre sens beaucoup moins.
 */
export function siteIndexable(): boolean {
  return process.env['LERENOM_ENV'] === 'production';
}
