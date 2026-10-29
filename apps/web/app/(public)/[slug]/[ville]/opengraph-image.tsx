import { imagePartage, TAILLE_PARTAGE, TYPE_PARTAGE } from '@/lib/image-partage';
import { communeParSlug, metierParSlug, resultats } from '@/lib/donnees';
import { aLaVille } from '@/lib/affichage';

/**
 * L'aperçu d'une page « métier × ville ».
 *
 * C'est la page la plus partagée du site — « tiens, regarde les plombiers du 11e » — et
 * c'était jusqu'ici un rectangle gris. L'image dit le métier, la ville, et combien de
 * professionnels y sont référencés : les trois choses qu'on veut savoir avant de cliquer.
 */

export const alt = 'Le Renom';
export const size = TAILLE_PARTAGE;
export const contentType = TYPE_PARTAGE;

export default async function Image({
  params,
}: {
  readonly params: Promise<{ readonly slug: string; readonly ville: string }>;
}) {
  const { slug, ville } = await params;
  const [metier, commune] = await Promise.all([metierParSlug(slug), communeParSlug(ville)]);

  // Une page qui n'existe pas garde l'image par défaut du site plutôt qu'une image portant
  // des noms inventés : un aperçu est souvent la seule chose qu'on lit d'un lien.
  if (metier === null || commune === null) {
    return imagePartage({
      surtitre: 'Île-de-France',
      titre: 'Trouvez le bon professionnel près de chez vous',
    });
  }

  const page = await resultats(slug, ville);
  const nombre = page?.pros.length ?? 0;

  return imagePartage({
    surtitre: commune.departement.nom,
    titre: `${metier.nom} ${aLaVille(commune.nom)}`,
    soustitre:
      nombre === 0
        ? 'Avis vérifiés · jusqu’à 3 devis gratuits'
        : // Le pluriel est calculé d'un bloc plutôt qu'interpolé deux fois au milieu de la
          // phrase : la lecture du code y gagne. L'espace un peu large qui suit
          // « professionnels » sur l'image rendue vient du moteur de rendu et non de cette
          // chaîne — vérifié en supprimant l'interpolation, qui n'a rien changé.
          `${nombre} ${nombre > 1 ? 'professionnels référencés' : 'professionnel référencé'} · avis vérifiés`,
  });
}
