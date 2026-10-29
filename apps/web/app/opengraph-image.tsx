import { imagePartage, TAILLE_PARTAGE, TYPE_PARTAGE } from '@/lib/image-partage';

/**
 * L'image de partage par défaut du site.
 *
 * Posée à la racine, elle est héritée par toutes les pages qui n'en définissent pas une :
 * une page oubliée garde donc un aperçu correct, au lieu du rectangle gris d'avant.
 */

export const alt = 'Le Renom — l’annuaire des professionnels d’Île-de-France';
export const size = TAILLE_PARTAGE;
export const contentType = TYPE_PARTAGE;

export default function Image() {
  return imagePartage({
    surtitre: 'Île-de-France',
    titre: 'Trouvez le bon professionnel près de chez vous',
    soustitre: 'Avis vérifiés · jusqu’à 3 devis gratuits',
  });
}
