import { imagePartage, TAILLE_PARTAGE, TYPE_PARTAGE } from '@/lib/image-partage';
import { entrepriseParSlug } from '@/lib/donnees';
import { nomVille } from '@/lib/affichage';

/**
 * L'aperçu d'une fiche d'entreprise.
 *
 * Il porte la note **seulement si elle repose sur de vrais avis** : afficher « 4,3 / 5 » par
 * défaut, comme le classement le fait faute d'historique, reviendrait à prêter à une
 * entreprise une réputation qu'elle n'a pas encore. Une fiche sans avis dit simplement son
 * métier et sa ville.
 */

export const alt = 'Le Renom';
export const size = TAILLE_PARTAGE;
export const contentType = TYPE_PARTAGE;

export default async function Image({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const entreprise = await entrepriseParSlug(slug);

  if (entreprise === null) {
    return imagePartage({ titre: 'Trouvez le bon professionnel près de chez vous' });
  }

  const metier =
    entreprise.metiers.find((m) => m.principal)?.metier.nom ??
    entreprise.metiers[0]?.metier.nom ??
    'Professionnel';
  const ville = nomVille(entreprise.agences[0]?.commune.nom ?? 'Île-de-France');

  const note =
    entreprise.noteMoyenne !== null && entreprise.nombreAvis > 0
      ? `${entreprise.noteMoyenne.toFixed(1).replace('.', ',')} / 5 sur ${entreprise.nombreAvis} avis`
      : undefined;

  return imagePartage({
    surtitre: `${metier} · ${ville}`,
    // Le nom de l'entreprise, jamais tronqué par le gabarit avant 72 caractères — au-delà,
    // ce n'est plus un nom d'entreprise mais une raison sociale complète.
    titre: entreprise.nom,
    ...(note === undefined ? {} : { soustitre: note }),
  });
}
