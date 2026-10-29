import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { enregistreUnClic } from '@/lib/mesure';

/**
 * Enregistre un clic sur une fiche : ouverture, téléphone, site.
 *
 * Route publique, appelée par le navigateur du visiteur. Elle n'est donc pas protégée, et
 * c'est assumé : il n'y a rien à protéger. On n'y lit rien, on n'y dépose aucun cookie, et
 * ce qu'elle écrit est un compteur par jour — pas un visiteur, pas une adresse, pas un
 * horodatage. Quelqu'un qui l'appellerait en boucle gonflerait un chiffre de tableau de bord
 * sans rien apprendre ni rien atteindre.
 *
 * **Elle répond toujours `204`, même en cas d'échec.** Le navigateur l'appelle en arrière-plan
 * pendant que le visiteur part sur une autre page ; lui renvoyer une erreur n'aiderait
 * personne et salirait sa console. Un compteur perdu n'est pas un incident.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const Clic = z
  .object({
    entrepriseId: z.string().min(1).max(40),
    type: z.enum(['fiche', 'appel', 'site_web', 'whatsapp', 'devis']),
    metierId: z.string().min(1).max(40).nullable().optional(),
    communeId: z.string().min(1).max(20).nullable().optional(),
  })
  .strict();

export async function POST(requete: Request): Promise<NextResponse> {
  const vide = new NextResponse(null, { status: 204 });
  try {
    const analyse = Clic.safeParse(await requete.json());
    if (!analyse.success) return vide;
    const { entrepriseId, type, metierId, communeId } = analyse.data;

    // L'entreprise doit exister : sans ce contrôle, n'importe quel identifiant créerait une
    // ligne, et la table se remplirait de comptes rattachés à personne.
    const existe = await prisma.entreprise.count({ where: { id: entrepriseId } });
    if (existe === 0) return vide;

    await enregistreUnClic(entrepriseId, type, metierId ?? null, communeId ?? null);
  } catch {
    // Volontairement muet : voir le commentaire du module.
  }
  return vide;
}
