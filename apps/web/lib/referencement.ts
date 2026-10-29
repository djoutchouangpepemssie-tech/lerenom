import { baseDuSite } from './site';

/**
 * Le référencement technique : adresses canoniques, partage, données structurées.
 *
 * Trois manques, trouvés en auditant l'existant plutôt qu'en suivant une liste.
 *
 * **Aucune page n'annonçait d'adresse canonique.** C'est le plus coûteux, et il vient de la
 * nature du produit : un annuaire filtrable. `?urgence=1`, `?tri=note`, `?dispo=1` servent la
 * même page à quelques lignes près. Sans canonique, un moteur découvre une dizaine d'adresses
 * pour un seul contenu, répartit entre elles le crédit de la page, et n'en indexe aucune
 * correctement.
 *
 * **Rien n'était prévu pour le partage.** Une fiche collée dans une conversation n'affichait
 * ni titre, ni description, ni image — et c'est pourtant par là que passent les
 * recommandations entre voisins, qui sont le bouche-à-oreille de ce métier.
 *
 * **Les données structurées se limitaient au fil d'Ariane.** Un annuaire local sans
 * `LocalBusiness` se prive de ce qui fait exister une fiche dans la recherche locale.
 */

/**
 * L'adresse canonique d'un chemin.
 *
 * **Sans aucun paramètre de requête, jamais.** C'est tout l'objet : la canonique d'une page
 * filtrée est la page non filtrée. Laisser passer les paramètres reviendrait à déclarer que
 * chaque combinaison de filtres est une page à part entière — exactement ce qu'on cherche à
 * éviter.
 *
 * L'adresse est absolue, parce qu'une canonique relative n'a de sens que si le moteur a déjà
 * résolu le domaine correctement, et qu'on ne peut pas en faire l'hypothèse.
 */
export function canonique(chemin: string): string {
  const propre = chemin.split('?')[0]?.split('#')[0] ?? '/';
  const normalise = propre.startsWith('/') ? propre : `/${propre}`;
  // La racine garde sa barre oblique ; toutes les autres la perdent. Deux adresses qui ne
  // diffèrent que par une barre finale sont deux pages pour un moteur.
  const sansBarreFinale = normalise.length > 1 ? normalise.replace(/\/+$/, '') : '/';
  return `${baseDuSite()}${sansBarreFinale}`;
}

export interface PartageSocial {
  readonly titre: string;
  readonly description: string;
  readonly chemin: string;
  /**
   * Image de partage, absolue. À ne renseigner que pour désigner une image qui n'est pas
   * celle du segment de route — sinon, laisser `opengraph-image.tsx` s'en charger.
   */
  readonly image?: string;
}

/**
 * Les métadonnées de partage, OpenGraph et Twitter.
 *
 * Le type est `website` partout sauf mention contraire : une fiche d'entreprise n'est pas un
 * `article`, et annoncer un type d'article sur une page qui n'a ni auteur ni date de
 * publication produit des aperçus incomplets.
 */
export function partage(options: PartageSocial) {
  const url = canonique(options.chemin);

  // **Aucune image n'est désignée ici.** Les images de partage sont produites par les
  // fichiers `opengraph-image.tsx`, que Next rattache automatiquement à leur segment de
  // route et fait hériter aux pages filles. Une image désignée dans les métadonnées
  // l'emporterait sur ces fichiers : on annoncerait une adresse fixe à la place de l'image
  // générée pour la page, et la plus précise des deux serait ignorée.
  return {
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      locale: 'fr_FR',
      siteName: 'Le Renom',
      title: options.titre,
      description: options.description,
      url,
      ...(options.image === undefined ? {} : { images: [{ url: options.image }] }),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: options.titre,
      description: options.description,
      ...(options.image === undefined ? {} : { images: [options.image] }),
    },
  };
}

export interface EntrepriseStructuree {
  readonly nom: string;
  readonly slug: string;
  readonly description: string | null;
  readonly telephone: string | null;
  readonly siteWeb: string | null;
  readonly adresse: string | null;
  readonly codePostal: string | null;
  readonly commune: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly metier: string | null;
  readonly noteMoyenne: number | null;
  readonly nombreAvis: number;
  /** Statut de diffusion SIRENE. Faux : ni nom précis, ni adresse, ni géolocalisation. */
  readonly diffusible: boolean;
}

/**
 * Le balisage `LocalBusiness` d'une fiche.
 *
 * Deux refus, et ils ne sont pas du même ordre.
 *
 * **Une entreprise non diffusible n'est pas balisée du tout.** Le statut de diffusion SIRENE
 * est une obligation, pas une préférence : publier l'adresse d'une entreprise qui l'a refusée
 * serait une faute, et la publier dans des données structurées la rendrait en plus
 * réutilisable par des tiers. On rend `null` plutôt que de baliser partiellement.
 *
 * **La note n'est publiée que s'il y a de vrais avis.** `aggregateRating` sans avis, ou avec
 * une note de repli, est une déclaration fausse adressée à un moteur de recherche — c'est
 * sanctionné, et ce serait mérité. Sans avis publié, le bloc n'apparaît pas.
 */
export function jsonLdEntreprise(entreprise: EntrepriseStructuree): object | null {
  if (!entreprise.diffusible) return null;

  const adressePostale =
    entreprise.adresse === null || entreprise.commune === null
      ? undefined
      : {
          '@type': 'PostalAddress',
          streetAddress: entreprise.adresse,
          ...(entreprise.codePostal === null ? {} : { postalCode: entreprise.codePostal }),
          addressLocality: entreprise.commune,
          addressCountry: 'FR',
        };

  const geo =
    entreprise.latitude === null || entreprise.longitude === null
      ? undefined
      : {
          '@type': 'GeoCoordinates',
          latitude: entreprise.latitude,
          longitude: entreprise.longitude,
        };

  const note =
    entreprise.noteMoyenne === null || entreprise.nombreAvis === 0
      ? undefined
      : {
          '@type': 'AggregateRating',
          ratingValue: entreprise.noteMoyenne,
          reviewCount: entreprise.nombreAvis,
          bestRating: 5,
          worstRating: 1,
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': canonique(`/entreprise/${entreprise.slug}`),
    name: entreprise.nom,
    url: canonique(`/entreprise/${entreprise.slug}`),
    ...(entreprise.description === null ? {} : { description: entreprise.description }),
    ...(entreprise.telephone === null ? {} : { telephone: entreprise.telephone }),
    ...(entreprise.siteWeb === null ? {} : { sameAs: [entreprise.siteWeb] }),
    ...(entreprise.metier === null ? {} : { knowsAbout: entreprise.metier }),
    ...(adressePostale === undefined ? {} : { address: adressePostale }),
    ...(geo === undefined ? {} : { geo }),
    ...(note === undefined ? {} : { aggregateRating: note }),
  };
}

export interface ElementListe {
  readonly nom: string;
  readonly slug: string;
}

/**
 * Le balisage `ItemList` d'une page de résultats.
 *
 * Il décrit l'ordre réellement servi, emplacements payés compris. Masquer les sponsorisés du
 * balisage donnerait aux moteurs un classement différent de celui que voit le visiteur, et
 * un écart entre les deux est précisément ce qu'un moteur sanctionne.
 */
export function jsonLdListeResultats(
  titre: string,
  elements: readonly ElementListe[],
): object | null {
  if (elements.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titre,
    numberOfItems: elements.length,
    itemListElement: elements.map((element, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: element.nom,
      url: canonique(`/entreprise/${element.slug}`),
    })),
  };
}

/**
 * Le balisage de l'organisation et du site, pour l'accueil.
 *
 * `SearchAction` n'est **pas** déclaré : il promet à un moteur une adresse de recherche
 * générique que le site n'expose pas — la recherche passe par un métier et une ville. Le
 * déclarer quand même donnerait des liens cassés dans les résultats de recherche.
 */
export function jsonLdSite(): object {
  const base = baseDuSite();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organisation`,
    name: 'Le Renom',
    url: base,
    description:
      'Annuaire de professionnels d’Île-de-France : avis vérifiés, demande de devis gratuite.',
    areaServed: { '@type': 'AdministrativeArea', name: 'Île-de-France' },
  };
}
